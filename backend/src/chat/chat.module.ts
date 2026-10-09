import { Module, forwardRef } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    PrismaModule, 
    AuthModule,
    forwardRef(() => AiModule)
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService],
  exports: [ChatGateway, ChatService], 
})
export class ChatModule {}