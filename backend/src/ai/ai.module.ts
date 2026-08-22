import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ChatModule } from '../chat/chat.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [ConfigModule, HttpModule, ChatModule, PrismaModule, FriendsModule,],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}