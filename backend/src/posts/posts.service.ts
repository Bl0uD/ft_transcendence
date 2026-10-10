import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipStatus } from '@prisma/client';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  private readonly internalUsernames = ['Assistant IA', 'Gemini IA', 'Bot IA'];

  private getPostIncludes(currentUserId: number) {
    return {
      author: { select: { id: true, username: true, nickname: true, avatar: true } }, 
      likes: { where: { userId: currentUserId }, select: { id: true } },
      comments: {
        include: { user: { select: { id: true, username: true, nickname: true, avatar: true } } },
        orderBy: { createdAt: 'asc' } as any, // "as any" permet d'éviter l'erreur TS stricte de Prisma ici
      },
      _count: { select: { likes: true, comments: true } },
    };
  }

  async createPost(userId: number, content: string, isPublic: boolean, imageUrl?: string) {
    return this.prisma.post.create({
      data: {
        content,
        isPublic,
        imageUrl,
        authorId: userId,
      },
      include: this.getPostIncludes(userId),
    });
  }

  async getFeed(userId?: number) {
    const internalUsers = await this.prisma.user.findMany({
      where: { username: { in: this.internalUsernames } },
      select: { id: true },
    });
    const internalIds = internalUsers.map((user) => user.id);

    if (!userId) {
      return this.prisma.post.findMany({
        where: { isPublic: true, isHidden: false, authorId: { notIn: internalIds } },
        orderBy: { createdAt: 'desc' },
        include: this.getPostIncludes(-1), // -1 pour qu'un visiteur n'ait jamais de posts "likés"
      });
    }

    const relations = await this.prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
    });

    const friendIds = relations
      .filter((r) => r.status === FriendshipStatus.ACCEPTED)
      .map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));

    const blockedIds = relations
      .filter((r) => r.status === FriendshipStatus.BLOCKED)
      .map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));

    return this.prisma.post.findMany({
      where: {
        authorId: { notIn: [...blockedIds, ...internalIds] }, // 👈 On exclut aussi les comptes IA internes
        OR: [
          { isPublic: true, isHidden: false },
          { authorId: userId },
          { authorId: { in: friendIds }, isHidden: false },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: this.getPostIncludes(userId),
    });
  }

  async getUserPosts(targetUserId: number, requesterId?: number) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { username: true },
    });

    if (!targetUser || this.internalUsernames.includes(targetUser.username)) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (requesterId === targetUserId) {
      return this.prisma.post.findMany({
        where: { authorId: targetUserId },
        orderBy: { createdAt: 'desc' },
        include: this.getPostIncludes(requesterId),
      });
    }

    if (!requesterId) {
      return this.prisma.post.findMany({
        where: { authorId: targetUserId, isPublic: true, isHidden: false },
        orderBy: { createdAt: 'desc' },
        include: this.getPostIncludes(-1),
      });
    }

    const relation = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: requesterId, addresseeId: targetUserId },
          { requesterId: targetUserId, addresseeId: requesterId },
        ],
      },
    });

    if (relation && relation.status === FriendshipStatus.BLOCKED) {
      if (relation.requesterId === requesterId) {
        // C'est nous qui l'avons bloqué : on retourne juste un mur vide
        return [];
      } else {
        // C'est lui qui nous a bloqué
        throw new ForbiddenException("Vous ne pouvez pas voir les publications de cet utilisateur.");
      }
    }

    const isFriend = relation && relation.status === FriendshipStatus.ACCEPTED;

    return this.prisma.post.findMany({
      where: { 
        authorId: targetUserId,
        isPublic: isFriend ? undefined : true,
        isHidden: false 
      },
      orderBy: { createdAt: 'desc' },
      include: this.getPostIncludes(requesterId),
    });
  }

  async toggleLike(userId: number, postId: number) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post introuvable');

    const existingLike = await this.prisma.like.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existingLike) {
      await this.prisma.like.delete({ where: { id: existingLike.id } });
      return { liked: false };
    } else {
      await this.prisma.like.create({ data: { userId, postId } });
      return { liked: true };
    }
  }

  async addComment(userId: number, postId: number, content: string) {
    return this.prisma.comment.create({
      data: { content, userId, postId },
      include: { user: { select: { id: true, username: true, avatar: true } } },
    });
  }

  async deletePost(userId: number, postId: number) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post introuvable');
    if (post.authorId !== userId) throw new ForbiddenException("Vous n'êtes pas l'auteur de ce post.");
    
    await this.prisma.post.delete({ where: { id: postId } });
    return { success: true };
  }

  async updateVisibility(userId: number, postId: number, data: { isPublic?: boolean, isHidden?: boolean }) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post introuvable');
    if (post.authorId !== userId) throw new ForbiddenException("Vous n'êtes pas l'auteur de ce post.");
    
    const updateData: any = {};
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;
    if (data.isHidden !== undefined) updateData.isHidden = data.isHidden;

    const updatedPost = await this.prisma.post.update({
      where: { id: postId },
      data: updateData,
      include: this.getPostIncludes(userId)
    });
    return updatedPost;
  }
}
