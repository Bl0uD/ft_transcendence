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

  private aiBotId: number;
  private readonly MAX_MESSAGES = 10;
  private readonly MAX_TOTAL_CHARS = 6000;

  constructor(
    private readonly httpService: HttpService,
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.ensureAiBotExists();
  }

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
      // 1. Sauvegarder uniquement le dernier message utilisateur s'il existe
      if (lastUserMessage && lastUserMessage.role === 'user' && lastUserMessage.content.trim()) {
        await this.chatService.saveMessage({
          content: lastUserMessage.content,
          roomId: roomId,
          authorId: userId,
        });
      }

      // 2. Charger les messages depuis Prisma
      const dbMessages = await this.chatService.getMessagesByRoomId(roomId, this.MAX_MESSAGES);

      // 3. Mapping ultra-solide du rôle pour Ollama (vérification par senderId ET username)
      const formattedHistory: ChatMessageDto[] = dbMessages.map((msg: any) => {
        const isBot = msg.senderId === this.aiBotId || msg.sender?.username === 'Bot IA';
        return {
          role: isBot ? 'assistant' : 'user',
          content: msg.content,
        };
      });

      // 4. Limiter le contexte
      const truncatedHistory = this.limitContextWindow(formattedHistory);

      const fullConversation = [
        { role: 'system', content: this.systemPrompt },
        ...truncatedHistory,
      ];

      // 5. Envoi à Ollama
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

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let buffer = '';
      let fullAiResponse = '';

      response.data.on('data', async (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed);

            if (parsed.message?.content) {
              const content = parsed.message.content;
              fullAiResponse += content;

              res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
            }

            if (parsed.done) {
              // 6. Sauvegarder la réponse de l'IA une fois terminée
              if (fullAiResponse.trim()) {
                await this.chatService.saveMessage({
                  content: fullAiResponse,
                  roomId: roomId,
                  authorId: this.aiBotId,
                });
              }

              res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
              res.end();
            }
          } catch {
            // Fragment partiel ignoré
          }
        }
      });

      response.data.on('error', (err: Error) => {
        this.logger.error('Erreur durant le streaming', err);
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: 'Erreur durant la génération.' })}\n\n`);
          res.end();
        }
      });

      res.on('close', () => {
        response.data.destroy();
      });

    } catch (error) {
      this.logger.error('Ollama est injoignable', error);
      throw new InternalServerErrorException("L'assistant IA est indisponible.");
    }
  }

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