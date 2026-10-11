import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';
import { ChatModule } from './chat/chat.module';
import { UsersModule } from './users/users.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { UserThrottlerGuard } from './auth/guards/user-throttler.guard';
import { FriendsModule } from './friends/friends.module';
import { AiModule } from './ai/ai.module';
import { PostsModule } from './posts/posts.module';
import { join } from 'path';

@Module({
  imports: [
    AuthModule,
    ChatModule,
    FriendsModule,
    PrismaModule,
    UsersModule,
    AiModule, 
    ThrottlerModule.forRoot([{
      ttl: 60000,         // 60 secondes
      limit: 100,         // limite globale par défaut
    }]),
    PostsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService, 
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: UserThrottlerGuard,
    },
  ],
})
export class AppModule {}