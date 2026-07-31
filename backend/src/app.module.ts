import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';
import { ChatModule } from './chat/chat.module';
import { UsersModule } from './users/users.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { FriendsModule } from './friends/friends.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    AuthModule,
    ChatModule,
    FriendsModule,
    PrismaModule,
    UsersModule,
    AiModule, // 🟢 2. Déclaration du module IA ici
    ThrottlerModule.forRoot([{
      ttl: 60000,         // 60 secondes
      limit: 100,         // limite globale par défaut
    }])
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}