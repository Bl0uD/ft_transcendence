import { WebSocketGateway, WebSocketServer, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ cors: { origin: '*' } }) 
export class FriendsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      if (token) {
        const payload = await this.jwtService.verifyAsync(token);
        const userId = String(payload.sub || payload.id);
        
        // The client joins a room corresponding to their user ID
        client.join(userId); 
        console.log(`[FriendsGateway] User ${userId} connected and joined their personal room.`);
      }
    } catch (e) {
      console.warn('[FriendsGateway] Invalid token during connection.');
      client.disconnect();
    }
  }

  notifySocialUpdate(userId: number) {
    console.log(`📢 Émission WebSocket : socialUpdate ciblée pour le User ${userId}`);
    // Emit ONLY to the specific user's room
    this.server.to(String(userId)).emit('socialUpdate', { userId });
  }
}