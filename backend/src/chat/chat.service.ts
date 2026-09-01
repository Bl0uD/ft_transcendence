import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // 🛠️ NOUVEAU : Récupère les IDs de tous ceux qui m'ont bloqué OU que j'ai bloqués
  private async getBlockedUserIds(userId: number) {
    const blocks = await this.prisma.friendship.findMany({
      where: {
        status: 'BLOCKED',
        OR: [{ requesterId: userId }, { addresseeId: userId }]
      }
    });
    return blocks.map(b => b.requesterId === userId ? b.addresseeId : b.requesterId);
  }

  async getUserChannels(userId: number) {
    const blockedIds = await this.getBlockedUserIds(userId);

    const channels = await this.prisma.channel.findMany({
      where: {
        OR: [
          { type: 'PUBLIC' },
          { members: { some: { userId } } } 
        ]
      },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, nickname: true, avatar: true } } }
        }
      },
      orderBy: { name: 'asc' },
    });

    // 🟢 SÉCURITÉ : On cache les conversations avec des utilisateurs bloqués
    return channels.filter(channel => {
      if (channel.type === 'DIRECT' || channel.name?.startsWith('dm_')) {
        const otherMember = channel.members.find(m => m.userId !== userId);
        if (otherMember && blockedIds.includes(otherMember.userId)) {
          return false;
        }
      }
      return true;
    });
  }

  async getOrCreateDirectMessage(userId1: number, userId2: number) {
    // 🟢 SÉCURITÉ : Bloque la création de salon
    const blockedIds = await this.getBlockedUserIds(userId1);
    if (blockedIds.includes(userId2)) {
      throw new ForbiddenException("Impossible de discuter : l'utilisateur est bloqué.");
    }

    const existingChannels = await this.prisma.channel.findMany({
      where: { type: 'DIRECT' },
      include: { members: true },
    });

    const dmChannel = existingChannels.find(channel => {
      const memberIds = channel.members.map(m => m.userId);
      return memberIds.includes(userId1) && memberIds.includes(userId2) && memberIds.length === 2;
    });

    if (dmChannel) return { channel: dmChannel, isNewChannel: false };

    const newChannel = await this.prisma.channel.create({
      data: {
        name: `dm_${userId1}_${userId2}`,
        type: 'DIRECT',
        userLimit: 2,
        members: {
          create: [
            { userId: userId1, role: 'MEMBER' },
            { userId: userId2, role: 'MEMBER' },
          ],
        },
      },
    });

    return { channel: newChannel, isNewChannel: true };
  }

  async joinChannel(channelId: number, userId: number) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { members: true }
    });

    if (!channel) throw new Error("Ce salon n'existe pas.");

    const isAlreadyMember = channel.members.some(m => m.userId === userId);
    if (isAlreadyMember) return channel;

    if (channel.userLimit && channel.members.length >= channel.userLimit) {
      throw new Error(`Ce salon est complet (limite de ${channel.userLimit} membres).`);
    }

    if (channel.type === 'DIRECT' || channel.type === 'PRIVATE') {
      throw new ForbiddenException("Vous n'êtes pas autorisé à rejoindre ce salon privé.");
    }

    await this.prisma.channelMember.create({
      data: { userId, channelId, role: 'MEMBER' }
    });

    return channel;
  }

  async checkAccess(channelId: number, userId: number) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { members: true }
    });

    if (!channel) return false;

    // 🟢 SÉCURITÉ : Bloque l'accès à un salon existant si un blocage est survenu
    if (channel.type === 'DIRECT' || channel.name?.startsWith('dm_')) {
      const otherMember = channel.members.find(m => m.userId !== userId);
      if (otherMember) {
        const blockedIds = await this.getBlockedUserIds(userId);
        if (blockedIds.includes(otherMember.userId)) return false; 
      }
    }

    if (channel.type === 'PUBLIC') return true; 
    return channel.members.some((member) => member.userId === userId);
  }

  async saveMessage(data: { content: string; channelId: number; authorId: number }) {
    const hasAccess = await this.checkAccess(data.channelId, data.authorId);
    if (!hasAccess) throw new ForbiddenException("Envoi refusé : utilisateur bloqué.");

    return this.prisma.message.create({
      data: {
        content: data.content,
        channel: { connect: { id: data.channelId } },
        sender: { connect: { id: data.authorId } },
      },
      include: {
        sender: { select: { id: true, username: true, nickname: true, avatar: true } },
      },
    });
  }

  async getChannelMessages(channelId: number, userId: number) {
    const hasAccess = await this.checkAccess(channelId, userId);
    if (!hasAccess) throw new ForbiddenException("Lecture refusée : utilisateur bloqué.");

    return this.prisma.message.findMany({
      where: { channelId },
      include: {
        sender: { select: { id: true, username: true, nickname: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}