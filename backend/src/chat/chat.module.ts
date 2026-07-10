import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service'; // Chemin relatif depuis src/chat

@Module({
  imports: [
    JwtModule.register({}), // Assure-toi d'avoir configuré ton JWT ici ou globalement
  ],
  providers: [ChatGateway], // On injecte le service ici
})
export class ChatModule {}