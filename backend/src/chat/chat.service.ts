import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async saveMessage(data: { content: string; roomId: string | number; authorId: number | string }) {
    const numericChannelId = typeof data.roomId === 'string' ? parseInt(data.roomId, 10) : data.roomId;
    const numericAuthorId = typeof data.authorId === 'string' ? parseInt(data.authorId, 10) : data.authorId;

    return this.prisma.message.create({
      data: {
        content: data.content,
        channelId: numericChannelId,
        senderId: numericAuthorId,
      },
      include: {
        sender: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });
  }
}