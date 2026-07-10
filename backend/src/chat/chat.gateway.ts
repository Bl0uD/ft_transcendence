import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service'; // ASSURE-TOI QUE CE CHEMIN EST BON
import { SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';

@WebSocketGateway({
  namespace: 'chat',
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeConnections = new Map<number, string>();

  // Injection du JwtService ET du PrismaService
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService 
  ) {}

  async handleConnection(client: Socket) {
    try {
	  console.log("Tentative de connexion...");
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) throw new Error('Aucun jeton de sécurité fourni.');

      const payload = await this.jwtService.verifyAsync(token);

      // Vérification réelle en base de données
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
    console.log("Client a rejoint le canal :", data);
    return { event: 'joined', data: 'success' };
}
}