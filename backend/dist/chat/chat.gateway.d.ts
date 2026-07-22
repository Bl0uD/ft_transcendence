import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private jwtService;
    private prisma;
    private chatService;
    server: Server;
    private activeConnections;
    constructor(jwtService: JwtService, prisma: PrismaService, chatService: ChatService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    handleJoinChannel(data: any, client: Socket): {
        event: string;
        data: string;
    };
    handleSendMessage(client: Socket, payload: SendMessageDto): Promise<void>;
}
