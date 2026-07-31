import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true }) // Ajoute bien le cors: true
export class FriendsGateway {
  @WebSocketServer()
  server: Server;

  notifySocialUpdate(userId: number) {
    console.log(`📢 Émission WebSocket : socialUpdate pour le User ${userId}`);
    this.server.emit('socialUpdate', { userId });
  }
}