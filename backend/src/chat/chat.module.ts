import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module'; // si besoin pour JwtService

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [ChatGateway, ChatService],
  exports: [ChatService], // <--- Indispensable si utilisé ailleurs ou par la gateway
})
export class ChatModule {}