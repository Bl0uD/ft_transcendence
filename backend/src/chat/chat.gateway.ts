import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';
import { UsePipes, ValidationPipe } from '@nestjs/common';
import { SendMessageDto } from './dto/send-message.dto';

@WebSocketGateway({
  namespace: 'chat',
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeConnections = new Map<any, string>();

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private chatService: ChatService
  ) {}

  async handleConnection(client: Socket) {
    try {
      console.log("Tentative de connexion...");
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) throw new Error('Aucun jeton de sécurité fourni.');

      const payload = await this.jwtService.verifyAsync(token);

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new Error('Utilisateur inexistant');

      client.data.user = payload;
      this.activeConnections.set(payload.sub, client.id);
      
      console.log(`[ChatGateway] Connexion réussie. User ID: ${payload.sub}`);
    } catch (error) {
      console.log(`[ChatGateway] Connexion rejetée : ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`⚠️ Socket déconnecté : ${client.id}`);
    const userId = client.data.user?.sub;
    if (userId) {
      this.activeConnections.delete(userId);
      console.log(`[ChatGateway] Déconnexion propre. User ID ${userId} retiré.`);
    }
  }

  @SubscribeMessage('joinChannel')
  handleJoinChannel(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    // Si ton front envoie un objet ou juste un string/id de room
    const roomId = typeof data === 'string' ? data : data?.roomId;
    if (roomId) {
      client.join(roomId);
      console.log(`Client a rejoint le canal : ${roomId}`);
    }
    return { event: 'joined', data: 'success' };
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket, 
    @MessageBody() payload: SendMessageDto
  ) {
    const userId = client.data.user?.sub;
    if (!userId) return;

    // 1. Sauvegarde du message en base via Prisma
    const savedMessage = await this.chatService.saveMessage({
      content: payload.content,
      roomId: payload.roomId,
      authorId: userId,
    });

    // 2. Diffusion à tous les membres connectés à ce salon
    this.server.to(payload.roomId).emit('receive_message', savedMessage);
  }
}