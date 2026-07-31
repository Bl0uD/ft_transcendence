import { Injectable, OnModuleInit, InternalServerErrorException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { ChatMessageDto } from './dto/chat-prompt.dto';
import { ChatService } from '../chat/chat.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private readonly ollamaUrl = 'http://ai:11434/api/chat';
  private readonly systemPrompt = "Tu es l'assistant de ft_transcendence. Réponds de manière concise et amicale.";

  // Identifiant dynamique du Bot IA récupéré en BDD au démarrage
  private aiBotId: number;

  // Limites pour ne pas saturer le contexte de Llama 3
  private readonly MAX_MESSAGES = 10;
  private readonly MAX_TOTAL_CHARS = 6000;

  constructor(
    private readonly httpService: HttpService,
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * S'exécute automatiquement au lancement du module NestJS
   */
  async onModuleInit() {
    await this.ensureAiBotExists();
  }

  /**
   * Vérifie ou crée l'utilisateur système 'Bot IA' dans PostgreSQL
   */
  private async ensureAiBotExists() {
    const BOT_USERNAME = 'Bot IA';

    try {
      const bot = await this.prisma.user.upsert({
        where: { username: BOT_USERNAME },
        update: {},
        create: {
          username: BOT_USERNAME,
          email: 'bot-ia@transcendence.internal',
          avatar: '/uploads/avatars/ai-avatar.png',
        },
      });

      this.aiBotId = bot.id;
      this.logger.log(`[IA] Bot utilisateur prêt (ID BDD: ${this.aiBotId})`);
    } catch (error) {
      this.logger.error("[IA] Erreur lors de l'initialisation du Bot IA", error);
    }
  }

  async streamResponse(userMessages: ChatMessageDto[], res: Response, userId: number): Promise<void> {
    const roomId = `ai-chat-${userId}`;
    const lastUserMessage = userMessages[userMessages.length - 1];

    try {
      // 1. Sauvegarder le message entrant de l'utilisateur dans PostgreSQL
      if (lastUserMessage && lastUserMessage.role === 'user') {
        await this.chatService.saveMessage({
          content: lastUserMessage.content,
          roomId: roomId,
          authorId: userId,
        });
      }

      // 2. Limiter la taille de l'historique pour Ollama
      const truncatedHistory = this.limitContextWindow(userMessages);

      const fullConversation = [
        { role: 'system', content: this.systemPrompt },
        ...truncatedHistory,
      ];

      // 3. Appel HTTP en streaming vers Ollama
      const response = await firstValueFrom(
        this.httpService.post(
          this.ollamaUrl,
          {
            model: 'llama3',
            messages: fullConversation,
            stream: true,
          },
          { responseType: 'stream' },
        ),
      );

      // En-têtes HTTP SSE (Server-Sent Events)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let buffer = '';
      let fullAiResponse = '';

      // 4. Traitement du flux réseau
      response.data.on('data', async (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Conserver la dernière ligne incomplet dans le tampon

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed);

            if (parsed.message?.content) {
              const content = parsed.message.content;
              fullAiResponse += content;

              // Envoi du fragment au frontend
              res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
            }

            if (parsed.done) {
              // 5. Génération terminée : sauvegarde de la réponse globale dans PostgreSQL
              await this.chatService.saveMessage({
                content: fullAiResponse,
                roomId: roomId,
                authorId: this.aiBotId,
              });

              res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
              res.end();
            }
          } catch {
            // Ignorer les fragments JSON incomplets
          }
        }
      });

      // Gestion des erreurs pendant la lecture du flux
      response.data.on('error', (err: Error) => {
        this.logger.error('Erreur durant le streaming', err);
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: 'Erreur durant la génération.' })}\n\n`);
          res.end();
        }
      });

      // Arrêter la requête vers Ollama si le client ferme sa connexion
      res.on('close', () => {
        response.data.destroy();
      });

    } catch (error) {
      this.logger.error('Ollama est injoignable', error);
      throw new InternalServerErrorException("L'assistant IA est indisponible.");
    }
  }

  /**
   * Conserve uniquement les messages récents sous une limite de caractères
   */
  private limitContextWindow(messages: ChatMessageDto[]): ChatMessageDto[] {
    const recent = messages.slice(-this.MAX_MESSAGES);
    const filtered: ChatMessageDto[] = [];
    let currentChars = 0;

    for (let i = recent.length - 1; i >= 0; i--) {
      const msg = recent[i];
      const msgLength = msg.content.length;

      if (currentChars + msgLength > this.MAX_TOTAL_CHARS && filtered.length > 0) {
        break;
      }

      filtered.unshift(msg);
      currentChars += msgLength;
    }

    return filtered;
  }
}