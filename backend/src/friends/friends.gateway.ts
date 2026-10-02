import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service'; // 👈 Injection de Prisma nécessaire

@WebSocketGateway({ cors: { origin: '*' } }) 
export class FriendsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private onlineUsers = new Map<string, Set<string>>();
  private disconnectTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService // 👈 On injecte PrismaService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      if (token) {
        const payload = await this.jwtService.verifyAsync(token);
        const userId = String(payload.sub || payload.id);
        
        client.data.userId = userId;
        client.join(userId); 

        if (this.disconnectTimers.has(userId)) {
          clearTimeout(this.disconnectTimers.get(userId));
          this.disconnectTimers.delete(userId);
        }

        if (!this.onlineUsers.has(userId)) {
          this.onlineUsers.set(userId, new Set());
        }
        const userSockets = this.onlineUsers.get(userId);
        if (userSockets) {
          userSockets.add(client.id);
        }

        console.log(`[FriendsGateway] User ${userId} connected.`);
        this.broadcastStatusChange(userId, 'ONLINE');

        // 🟢 SÉCURITÉ ÉTAT INITIAL : Le serveur envoie d'office les statuts à la connexion
        this.sendInitialStatusesToClient(client, Number(userId));
      }
    } catch (e) {
      console.warn('[FriendsGateway] Invalid token during connection.');
      client.disconnect();
    }
  }

  // 🟢 Fonction pour envoyer les statuts initiaux directement via la BDD
  private async sendInitialStatusesToClient(client: Socket, userId: number) {
    try {
      const friendships = await this.prisma.friendship.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
      });

      const friendIds = friendships.map(f => f.requesterId === userId ? f.addresseeId : f.requesterId);

      const statuses: Record<number, 'ONLINE' | 'OFFLINE'> = {};
      friendIds.forEach(id => {
        statuses[id] = this.onlineUsers.has(String(id)) ? 'ONLINE' : 'OFFLINE';
      });

      client.emit('friends_status_response', statuses);
    } catch (err) {
      console.error("Erreur lors de l'envoi des statuts initiaux", err);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId && this.onlineUsers.has(userId)) {
      const sockets = this.onlineUsers.get(userId);
      
      if (sockets) {
        sockets.delete(client.id);
        
        if (sockets.size === 0) {
          const timer = setTimeout(() => {
            const currentSockets = this.onlineUsers.get(userId);
            if (currentSockets && currentSockets.size === 0) {
              this.onlineUsers.delete(userId);
              console.log(`[FriendsGateway] User ${userId} disconnected (confirmed).`);
              this.broadcastStatusChange(userId, 'OFFLINE');
            }
            this.disconnectTimers.delete(userId);
          }, 1000);

          this.disconnectTimers.set(userId, timer);
        }
      }
    }
  }

  @SubscribeMessage('get_friends_status')
  handleGetStatus(client: Socket, @MessageBody() friendIds: number[]) {
    if (!Array.isArray(friendIds)) return;
    
    const statuses: Record<number, 'ONLINE' | 'OFFLINE'> = {};
    friendIds.forEach(id => {
      statuses[id] = this.onlineUsers.has(String(id)) ? 'ONLINE' : 'OFFLINE';
    });

    client.emit('friends_status_response', statuses);
  }

  private broadcastStatusChange(userId: string, status: 'ONLINE' | 'OFFLINE') {
    this.server.emit('friend_status_update', { userId: Number(userId), status });
  }

  notifySocialUpdate(userId: number) {
    this.server.to(String(userId)).emit('socialUpdate', { userId });
  }
}