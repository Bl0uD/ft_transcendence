import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule], // Assure-toi que ton PrismaModule exporte bien PrismaService
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}