import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async saveMessage(data: { content: string; roomId: string | number; authorId: number | string }) {
    const numericAuthorId = typeof data.authorId === 'string' ? parseInt(data.authorId, 10) : data.authorId;
    const roomIdentifier = String(data.roomId);
    const parsedRoomId = parseInt(roomIdentifier, 10);

    // 1. Chercher si le canal existe
    let channel = await this.prisma.channel.findFirst({
      where: {
        OR: [
          ...(!isNaN(parsedRoomId) ? [{ id: parsedRoomId }] : []),
          { name: roomIdentifier },
        ],
      },
    });

    // 2. Si le salon n'existe pas, on le crée
    if (!channel) {
      channel = await this.prisma.channel.create({
        data: {
          name: isNaN(parsedRoomId) ? roomIdentifier : `Salon ${parsedRoomId}`,
        },
      });
    }

    // 3. Enregistrer le message
    return this.prisma.message.create({
      data: {
        content: data.content,
        channel: {
          connect: { id: channel.id },
        },
        sender: {
          connect: { id: numericAuthorId },
        },
      },
      include: {
        sender: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });
  }

  async getChannelMessages(roomId: string | number) {
    const numericRoomId = typeof roomId === 'string' ? parseInt(roomId, 10) : roomId;

    const channel = await this.prisma.channel.findFirst({
      where: {
        OR: [
          ...(!isNaN(numericRoomId) ? [{ id: numericRoomId }] : []),
          { name: String(roomId) },
        ],
      },
    });

    if (!channel) return [];

    return this.prisma.message.findMany({
      where: { channelId: channel.id },
      include: {
        sender: {
          select: { id: true, username: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'asc' }, // Chronologique
    });
  }

  // 🟢 FIX MÉMOIRE IA : Utilisation de sender au lieu de author
  async getMessagesByRoomId(roomId: string, limit: number = 20) {
    const channel = await this.prisma.channel.findFirst({
      where: { name: roomId },
    });

    if (!channel) return [];

    return this.prisma.message.findMany({
      where: { channelId: channel.id },
      take: limit,
      orderBy: { createdAt: 'asc' },
      include: {
        sender: true,
      },
    });
  }
}