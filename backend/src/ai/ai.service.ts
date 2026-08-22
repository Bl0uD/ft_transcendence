import { Injectable, OnModuleInit, InternalServerErrorException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { ChatMessageDto } from './dto/chat-prompt.dto';
import { ChatService } from '../chat/chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { FriendsService } from '../friends/friends.service';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private readonly ollamaUrl = 'http://ai:11434/api/chat';
  
  private readonly systemPrompt = `Tu es une API de routage strict. Tu DOIS classifier la requête selon l'algorithme ci-dessous.
    Réponds UNIQUEMENT avec un objet JSON.

    ALGORITHME DE DÉCISION (Vérifie dans cet ordre) :
    1. SI l'utilisateur demande à lister, voir, ou donner ses amis => action: "GET_FRIENDS_USERS", target: null
    2. SI l'utilisateur utilise le mot "bloque" ou "bloquer" => action: "BLOCK_USER", target: "nom_utilisateur"
    3. SI l'utilisateur utilise le mot "débloque" ou "débloquer" => action: "UNBLOCK_USER", target: "nom_utilisateur"
    4. SI l'utilisateur demande d'ajouter en ami => action: "ADD_FRIEND", target: "nom_utilisateur"
    5. SI l'utilisateur demande de supprimer un ami => action: "DELETE_FRIEND", target: "nom_utilisateur"
    6. SI l'utilisateur demande d'envoyer un message => action: "SEND_MESSAGE", target: "nom_utilisateur", payload: "le message"
    7. SI l'utilisateur demande d'aller sur une page => action: "NAVIGATE", target: "URL"
    8. SINON => action: "NONE", target: null

    EXEMPLES D'ENTRAÎNEMENT ABSOLUS :
    - "liste mes amis" -> {"action": "GET_FRIENDS_USERS", "target": null, "payload": null, "reply": "Recherche de vos amis..."}
    - "donne moi mes amis" -> {"action": "GET_FRIENDS_USERS", "target": null, "payload": null, "reply": "Recherche de vos amis..."}
    - "voir mes amis" -> {"action": "GET_FRIENDS_USERS", "target": null, "payload": null, "reply": "Recherche de vos amis..."}
    - "bloque l'user norabino" -> {"action": "BLOCK_USER", "target": "norabino", "payload": null, "reply": "Blocage en cours..."}
    - "bloque norabino" -> {"action": "BLOCK_USER", "target": "norabino", "payload": null, "reply": "Blocage en cours..."}
    - "salut comment ça va ?" -> {"action": "NONE", "target": null, "payload": null, "reply": "Bonjour ! Je vais bien, merci."}

    IMPORTANT : "null" doit s'écrire sans guillemets dans le JSON.`;

  private aiBotId: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
    private readonly friendsService: FriendsService,
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
    } catch (error) {
      this.logger.error("[IA] Erreur initialisation Bot", error);
    }
  }

  async streamResponse(userMessages: ChatMessageDto[], res: Response, userId: number): Promise<void> {
    const lastUserMessage = userMessages[userMessages.length - 1];

    if (!lastUserMessage || !lastUserMessage.content.trim()) {
      res.write(`data: ${JSON.stringify({ done: true, error: "Message vide." })}\n\n`);
      res.end();
      return;
    }

    try {
      const roomName = `ai-chat-${userId}`; 

      // 1. On récupère ou on crée le vrai salon numérique pour l'IA
      let aiChannel = await this.prisma.channel.findFirst({
        where: { name: roomName }
      });

      if (!aiChannel) {
        aiChannel = await this.prisma.channel.create({
          data: {
            name: roomName,
            type: 'PRIVATE',
            members: {
              create: [
                { userId: userId, role: 'MEMBER' },
                { userId: this.aiBotId, role: 'MEMBER' }
              ]
            }
          }
        });
      }

      const channelId = aiChannel.id;

      // 2. On sauvegarde le message avec channelId
      await this.chatService.saveMessage({
        content: lastUserMessage.content,
        channelId: channelId, 
        authorId: userId,
      });

      const fullConversation = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: lastUserMessage.content },
      ];

      const response = await firstValueFrom(
        this.httpService.post(
          this.ollamaUrl,
          {
            model: 'llama3',
            messages: fullConversation,
            stream: true,
            format: 'json',
            options: {
              temperature: 0.0 
            }
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
              fullAiResponse += parsed.message.content;
            }

            if (parsed.done) {
              if (fullAiResponse.trim()) {
                try {
                  const aiResult = JSON.parse(fullAiResponse);
                  const action = aiResult.action;

                  try {
                    const actionsRequiringTarget = ['SEND_MESSAGE', 'ADD_FRIEND', 'DELETE_FRIEND', 'BLOCK_USER', 'UNBLOCK_USER'];
                    let targetUser: any = null;

                    if (actionsRequiringTarget.includes(action)) {
                      if (!aiResult.target) throw new Error("Nom d'utilisateur cible manquant.");
                      
                      targetUser = await this.prisma.user.findUnique({
                        where: { username: aiResult.target },
                      });
                      
                      if (!targetUser) throw new Error(`L'utilisateur "${aiResult.target}" est introuvable.`);
                    }

                    switch (action) {
                      case 'SEND_MESSAGE':
                        if (!targetUser) break; 
                        const minId = Math.min(userId, targetUser.id);
                        const maxId = Math.max(userId, targetUser.id);
                        
                        // 3. On récupère le DM numérique
                        const { channel: dmChannel } = await this.chatService.getOrCreateDirectMessage(minId, maxId);
                        
                        await this.chatService.saveMessage({
                          content: aiResult.payload,
                          channelId: dmChannel.id,
                          authorId: userId,
                        });
                        break;
                        
                      case 'ADD_FRIEND':
                        if (!targetUser) break;
                        await this.friendsService.sendRequest(userId, targetUser.username);
                        break;
                        
                      case 'DELETE_FRIEND':
                        if (!targetUser) break;
                        await this.friendsService.removeRelation(userId, targetUser.id);
                        break;
                        
                      case 'BLOCK_USER':
                        if (!targetUser) break;
                        await this.friendsService.blockUser(userId, targetUser.id);
                        break;
                        
                      case 'UNBLOCK_USER':
                        if (!targetUser) break;
                        await this.friendsService.unblockUser(userId, targetUser.id);
                        break;
                        
                      case 'GET_FRIENDS_USERS':
                        const friends = await this.friendsService.getFriendsUsers(userId);
                        aiResult.reply = friends.length 
                          ? `Voici vos amis : ${friends.map(f => f.username).join(', ')}.` 
                          : "Vous n'avez pas encore d'amis.";
                        break;
                        
                      case 'GET_BLOCKED_USERS':
                        const blocked = await this.friendsService.getBlockedUsers(userId);
                        aiResult.reply = blocked.length 
                          ? `Utilisateurs bloqués : ${blocked.map(b => b.username).join(', ')}.` 
                          : "Vous n'avez bloqué personne.";
                        break;
                    }
                  } catch (logicError: any) {
                    aiResult.reply = logicError.message || "L'action n'a pas pu être effectuée.";
                  }

                  // 4. Sauvegarde de la réponse de l'IA
                  await this.chatService.saveMessage({
                    content: aiResult.reply || "Action effectuée.",
                    channelId: channelId,
                    authorId: this.aiBotId,
                  });

                  res.write(`data: ${JSON.stringify({ done: true, result: aiResult })}\n\n`);
                } catch (err) {
                  this.logger.error("Erreur parsing JSON IA :", err);
                  res.write(`data: ${JSON.stringify({ done: true, error: "Désolé, je n'ai pas pu formuler ma réponse." })}\n\n`);
                }
              } else {
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
              }
              res.end();
            }
          } catch (parseError) {
            // Silencieux pour le stream incomplet
          }
        }
      });

      response.data.on('error', (err: Error) => {
        this.logger.error('Erreur durant le streaming', err);
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: 'Erreur de génération.' })}\n\n`);
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
}