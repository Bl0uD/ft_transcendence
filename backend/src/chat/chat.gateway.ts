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
// ⚠️ Assure-toi que SendMessageDto attend un `channelId: number` (et non plus un roomId string)
import { SendMessageDto } from './dto/send-message.dto';

@WebSocketGateway({
  namespace: 'chat',
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeConnections = new Map<number, string>();

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
      this.activeConnections.set(userId, client.id);

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
      this.activeConnections.delete(userId);
      console.log(`[ChatGateway] Déconnexion. User ID ${userId} retiré.`);
      this.server.emit('user_disconnected', { userId, status: 'OFFLINE' });
    }
  }

  @SubscribeMessage('joinChannel')
  async handleJoinChannel(
    // 🟢 On s'attend explicitement à recevoir un ID numérique depuis React
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.sub;
    const channelId = Number(data?.channelId);

    if (!userId || isNaN(channelId)) return;
      
    try {
      // 1. On rejoint (le service vérifie la userLimit de 2 places pour les DMs !)
      const channel = await this.chatService.joinChannel(channelId, userId);

      // 2. On rejoint la room côté Socket.io (converti en string pour Socket.io)
      const roomStr = String(channel.id);
      client.join(roomStr);
      
      // 3. Envoi de l'historique
      const history = await this.chatService.getChannelMessages(channel.id, userId);
      client.emit('load_history', history);
      
      return { event: 'joined', status: 'success' };
    } catch (error) {
      console.warn(`[ChatGateway] Blocage joinChannel: ${error.message}`);
      client.emit('error', error.message || "Accès refusé");
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    // 🟢 Le DTO doit utiliser channelId
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

      const roomTarget = String(channelId);
      this.server.to(roomTarget).emit('receive_message', savedMessage);
    } catch (error) {
      console.warn(`[ChatGateway] Erreur envoi message: ${error.message}`);
      client.emit('error', error.message || "Impossible d'envoyer le message.");
    }
  }
}