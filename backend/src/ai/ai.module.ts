import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ChatModule } from '../chat/chat.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [
    ConfigModule, 
    HttpModule, 
    PrismaModule, 
    FriendsModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}