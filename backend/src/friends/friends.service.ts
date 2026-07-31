import { Injectable, BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipStatus } from '@prisma/client';
import { FriendsGateway } from './friends.gateway'; // 🟢 1. Import du Gateway

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friendsGateway: FriendsGateway // 🟢 2. Injection du Gateway
  ) {}

  /**
   * Envoyer une demande d'ami via username
   */
  async sendRequest(requesterId: number, targetUsername: string) {
    const targetUser = await this.prisma.user.findUnique({
      where: { username: targetUsername },
    });

    if (!targetUser) {
      throw new NotFoundException(`L'utilisateur "${targetUsername}" n'existe pas.`);
    }

    const addresseeId = targetUser.id;

    if (requesterId === addresseeId) {
      throw new BadRequestException('Vous ne pouvez pas vous ajouter vous-même en ami.');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId },
        ],
      },
    });

    if (existing) {
      if (existing.status === FriendshipStatus.ACCEPTED) {
        throw new ConflictException('Vous êtes déjà amis.');
      }
      if (existing.status === FriendshipStatus.PENDING) {
        throw new ConflictException('Une demande est déjà en attente entre vous.');
      }
      if (existing.status === FriendshipStatus.BLOCKED) {
        throw new ForbiddenException('Action impossible.');
      }
    }

    const friendship = await this.prisma.friendship.create({
      data: {
        requesterId,
        addresseeId,
        status: FriendshipStatus.PENDING,
      },
      include: {
        addressee: { select: { id: true, username: true, avatar: true } },
      },
    });

    // 🟢 3. Notification en temps réel
    this.friendsGateway.notifySocialUpdate(requesterId);
    this.friendsGateway.notifySocialUpdate(addresseeId);

    return friendship;
  }

  /**
   * Accepter une demande d'ami
   */
  async acceptRequest(userId: number, requestId: number) {
    const request = await this.prisma.friendship.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Demande d\'ami introuvable.');
    }

    if (request.addresseeId !== userId) {
      throw new ForbiddenException('Vous ne pouvez pas accepter cette demande.');
    }

    if (request.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('La demande n\'est plus en attente.');
    }

    const updated = await this.prisma.friendship.update({
      where: { id: requestId },
      data: { status: FriendshipStatus.ACCEPTED },
    });

    // 🟢 3. Notification en temps réel
    this.friendsGateway.notifySocialUpdate(updated.requesterId);
    this.friendsGateway.notifySocialUpdate(updated.addresseeId);

    return updated;
  }

  /**
   * Refuser une demande ou supprimer un ami
   */
  async removeRelation(userId: number, targetUserId: number) {
    const relation = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: targetUserId },
          { requesterId: targetUserId, addresseeId: userId },
        ],
      },
    });

    if (!relation) {
      throw new NotFoundException('Aucune relation trouvée avec cet utilisateur.');
    }

    if (relation.status === FriendshipStatus.BLOCKED) {
      throw new BadRequestException('Utilisez la route de déblocage dédiée.');
    }

    const deleted = await this.prisma.friendship.delete({
      where: { id: relation.id },
    });

    // 🟢 3. Notification en temps réel
    this.friendsGateway.notifySocialUpdate(deleted.requesterId);
    this.friendsGateway.notifySocialUpdate(deleted.addresseeId);

    return deleted;
  }

  /**
   * Bloquer un utilisateur
   */
  async blockUser(blockerId: number, targetUserId: number) {
    if (blockerId === targetUserId) {
      throw new BadRequestException('Vous ne pouvez pas vous bloquer vous-même.');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: blockerId, addresseeId: targetUserId },
          { requesterId: targetUserId, addresseeId: blockerId },
        ],
      },
    });

    if (existing) {
      const updated = await this.prisma.friendship.update({
        where: { id: existing.id },
        data: {
          requesterId: blockerId,
          addresseeId: targetUserId,
          status: FriendshipStatus.BLOCKED,
        },
      });
      
      // 🟢 3. Notification en temps réel
      this.friendsGateway.notifySocialUpdate(blockerId);
      this.friendsGateway.notifySocialUpdate(targetUserId);
      
      return updated;
    }

    const created = await this.prisma.friendship.create({
      data: {
        requesterId: blockerId,
        addresseeId: targetUserId,
        status: FriendshipStatus.BLOCKED,
      },
    });

    // 🟢 3. Notification en temps réel
    this.friendsGateway.notifySocialUpdate(blockerId);
    this.friendsGateway.notifySocialUpdate(targetUserId);

    return created;
  }

  /**
   * Débloquer un utilisateur
   */
  async unblockUser(blockerId: number, targetUserId: number) {
    const relation = await this.prisma.friendship.findFirst({
      where: {
        requesterId: blockerId,
        addresseeId: targetUserId,
        status: FriendshipStatus.BLOCKED,
      },
    });

    if (!relation) {
      throw new NotFoundException('Cet utilisateur n\'est pas bloqué.');
    }

    const deleted = await this.prisma.friendship.delete({
      where: { id: relation.id },
    });

    // 🟢 3. Notification en temps réel
    this.friendsGateway.notifySocialUpdate(blockerId);
    this.friendsGateway.notifySocialUpdate(targetUserId);

    return deleted;
  }

  /**
   * Obtenir la liste des amis acceptés
   */
  async getFriends(userId: number) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { select: { id: true, username: true, avatar: true } },
        addressee: { select: { id: true, username: true, avatar: true } },
      },
    });

    return friendships.map((f) =>
      f.requesterId === userId ? f.addressee : f.requester,
    );
  }

  /**
   * Obtenir les demandes reçues en attente
   */
  async getPendingRequests(userId: number) {
    return this.prisma.friendship.findMany({
      where: {
        addresseeId: userId,
        status: FriendshipStatus.PENDING,
      },
      include: {
        requester: { select: { id: true, username: true, avatar: true } },
      },
    });
  }

  /**
   * Obtenir la liste des utilisateurs bloqués par l'utilisateur
   */
  async getBlockedUsers(userId: number) {
    const blocked = await this.prisma.friendship.findMany({
      where: {
        requesterId: userId,
        status: FriendshipStatus.BLOCKED,
      },
      include: {
        addressee: { select: { id: true, username: true, avatar: true } },
      },
    });

    return blocked.map((b) => b.addressee);
  }
}