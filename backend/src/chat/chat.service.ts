import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async getUserChannels(userId: number) {
    return this.prisma.channel.findMany({
      where: {
        OR: [
          { type: 'PUBLIC' },
          { members: { some: { userId } } } // Récupère aussi TES salons privés/DMs
        ]
      },
      include: {
        // 🟢 NOUVEAU : On inclut les membres et leurs pseudos !
        members: {
          include: {
            user: { select: { id: true, username: true, avatar: true } }
          }
        }
      },
      orderBy: { name: 'asc' },
    });
  }

  // 1. Création ou récupération d'un DM (Le DM est un channel comme les autres)
  async getOrCreateDirectMessage(userId1: number, userId2: number) {
    // On cherche un salon DIRECT où les DEUX utilisateurs sont présents
    const existingChannels = await this.prisma.channel.findMany({
      where: { type: 'DIRECT' },
      include: { members: true },
    });

    const dmChannel = existingChannels.find(channel => {
      const memberIds = channel.members.map(m => m.userId);
      return memberIds.includes(userId1) && memberIds.includes(userId2) && memberIds.length === 2;
    });

    if (dmChannel) return { channel: dmChannel, isNewChannel: false };

    // S'il n'existe pas, on crée un Channel standard, mais limité à 2 !
    const newChannel = await this.prisma.channel.create({
      data: {
        name: null, // Pas de nom fixe, le front affichera le pseudo de l'autre
        type: 'DIRECT',
        userLimit: 2, // 🟢 La limite stricte de 2 membres
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

  // 2. Rejoindre n'importe quel salon par son ID
  async joinChannel(channelId: number, userId: number) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { members: true }
    });

    if (!channel) throw new Error("Ce salon n'existe pas.");

    // S'il est déjà membre, on le laisse passer
    const isAlreadyMember = channel.members.some(m => m.userId === userId);
    if (isAlreadyMember) return channel;

    // 🟢 VÉRIFICATION DE LA LIMITE DE PLACES (Fonctionne pour les DMs et les autres)
    if (channel.userLimit && channel.members.length >= channel.userLimit) {
      throw new Error(`Ce salon est complet (limite de ${channel.userLimit} membres).`);
    }

    if (channel.type === 'DIRECT' || channel.type === 'PRIVATE') {
      throw new ForbiddenException("Vous n'êtes pas autorisé à rejoindre ce salon privé.");
    }

    // On l'ajoute officiellement au salon
    await this.prisma.channelMember.create({
      data: { userId, channelId, role: 'MEMBER' }
    });

    return channel;
  }

  // 3. Vérification des accès (Lecture/Écriture)
  async checkAccess(channelId: number, userId: number) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { members: true }
    });

    if (!channel) return false;
    if (channel.type === 'PUBLIC') return true; 
    
    return channel.members.some((member) => member.userId === userId);
  }

  // 4. Sauvegarder un message (Utilise l'ID du channel)
  async saveMessage(data: { content: string; channelId: number; authorId: number }) {
    // 🔒 Vérifie l'accès avant d'écrire
    const hasAccess = await this.checkAccess(data.channelId, data.authorId);
    if (!hasAccess) throw new ForbiddenException("Non autorisé à envoyer un message ici.");

    return this.prisma.message.create({
      data: {
        content: data.content,
        channel: { connect: { id: data.channelId } },
        sender: { connect: { id: data.authorId } },
      },
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
      },
    });
  }

  // 5. Récupérer l'historique
  async getChannelMessages(channelId: number, userId: number) {
    // 🔒 Vérifie l'accès avant de lire
    const hasAccess = await this.checkAccess(channelId, userId);
    if (!hasAccess) throw new ForbiddenException("Lecture refusée.");

    return this.prisma.message.findMany({
      where: { channelId },
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}