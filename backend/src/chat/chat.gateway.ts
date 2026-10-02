import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

@WebSocketGateway({
  namespace: 'chat',
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // 🗑️ Adieu la Map 'activeConnections', on utilise la puissance de Socket.io à la place !

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) throw new Error('Aucun jeton de sécurité fourni.');

      const payload = await this.jwtService.verifyAsync(token);
      
      const userId = parseInt(String(payload.sub || payload.id), 10);
      if (isNaN(userId)) throw new Error('ID utilisateur invalide.');

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('Utilisateur inexistant');

      client.data.user = { ...payload, sub: userId, id: userId };
      
      // 🟢 LA SOLUTION EST LÀ : Dès qu'il se connecte, on le place dans une "room" à son nom
      client.join(`user_${userId}`);

      console.log(`[ChatGateway] Connexion réussie. User ID: ${userId}`);
      this.server.emit('user_connected', { userId, status: 'ONLINE' });

    } catch (error) {
      console.log(`[ChatGateway] Connexion rejetée : ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.sub;
    if (userId) {
      console.log(`[ChatGateway] Déconnexion. User ID ${userId} retiré.`);
      this.server.emit('user_disconnected', { userId, status: 'OFFLINE' });
    }
  }

  @SubscribeMessage('joinChannel')
  async handleJoinChannel(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.sub;
    const channelId = Number(data?.channelId);

    if (!userId || isNaN(channelId)) return;
      
    try {
      const channel = await this.chatService.joinChannel(channelId, userId);
      const roomStr = String(channel.id);
      client.join(roomStr);
      
      const history = await this.chatService.getChannelMessages(channel.id, userId);
      client.emit('load_history', history);
      
      return { event: 'joined', status: 'success' };
    } catch (error) {
      console.warn(`[ChatGateway] Blocage joinChannel: ${error.message}`);
      client.emit('error', error.message || "Accès refusé");
    }
  }

  public async notifyNewMessage(channelId: number, authorId: number, savedMessage: any) {
    const roomTarget = String(channelId);
    
    // 1. Envoi au salon (ceux qui ont la fenêtre ouverte)
    this.server.to(roomTarget).emit('receive_message', savedMessage);
    this.server.to(roomTarget).emit('rooms_updated'); 

    // 2. Notification ciblée absolue
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { members: true }, 
    });

    if (channel && channel.members) {
      for (const member of channel.members) {
        // 🟢 On ping la room personnelle du membre (ex: "user_45")
        // L'IA ping TOUT le monde, toi compris ! (React se charge d'ignorer les doublons visuels)
        this.server.to(`user_${member.userId}`).emit('receive_message', savedMessage);
        this.server.to(`user_${member.userId}`).emit('rooms_updated');
      }
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { channelId: number; content: string }, 
  ) {
    const userId = client.data.user?.sub;
    const channelId = Number(payload?.channelId);

    if (!userId || isNaN(channelId)) return;

    try {
      const savedMessage = await this.chatService.saveMessage({
        content: payload.content,
        channelId: channelId,
        authorId: userId,
      });

      await this.notifyNewMessage(channelId, userId, savedMessage);

    } catch (error) {
      console.warn(`[ChatGateway] Erreur envoi message: ${error.message}`);
      client.emit('error', error.message || "Impossible d'envoyer le message.");
    }
  }
}