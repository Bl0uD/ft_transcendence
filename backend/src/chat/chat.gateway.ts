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
import { UsePipes, ValidationPipe } from '@nestjs/common';
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
    const userId = client.data.user?.sub;
    if (userId) {
      this.activeConnections.delete(userId);
      console.log(`[ChatGateway] Déconnexion propre. User ID ${userId} retiré.`);
    }
  }

  // ✅ 1. 'async' ajouté pour que le 'await' et le load_history fonctionnent
  @SubscribeMessage('joinChannel')
  async handleJoinChannel(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const rawRoomId = typeof data === 'string' ? data : (data?.roomId ?? data?.room);

    if (rawRoomId !== undefined && rawRoomId !== null) {
      const roomIdStr = String(rawRoomId);
      
      // 🟢 1. On vérifie ou on crée le salon en base de données
      const { isNewChannel } = await this.chatService.findOrCreateChannel(rawRoomId);

      // 2. Rejoindre le salon Socket.io
      client.join(roomIdStr);
      console.log(`[ChatGateway] Socket ${client.id} a rejoint le canal : ${roomIdStr}`);

      // 🟢 3. Si c'est un nouveau salon, on avertit UNIQUEMENT CE CLIENT
      if (isNewChannel) {
        client.emit('rooms_updated'); // Utilisation de client.emit et non this.server.emit
      }

      // 4. Récupération et envoi de l'historique
      const history = await this.chatService.getChannelMessages(rawRoomId);
      client.emit('load_history', history);
    }
    return { event: 'joined', status: 'success' };
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageDto,
  ) {
    const userId = client.data.user?.sub ?? client.data.user?.id ?? client.data.userId;

    if (!userId) {
      console.warn(`[ChatGateway] Échec envoi : Aucun userId trouvé sur le socket ${client.id}`);
      return;
    }

    console.log(`[ChatGateway] Message reçu de User ${userId} (room ${payload.roomId}) : "${payload.content}"`);

    // 1. Sauvegarde en BDD
    const savedMessage = await this.chatService.saveMessage({
      content: payload.content,
      roomId: payload.roomId,
      authorId: userId,
    });

    const roomTarget = String(payload.roomId);

    // 2. Diffusion à tous les clients connectés au canal (y compris l'émetteur)
    this.server.to(roomTarget).emit('receive_message', savedMessage);

    console.log(`[ChatGateway] Message ${savedMessage.id} diffusé dans la room : ${roomTarget}`);
  }
}