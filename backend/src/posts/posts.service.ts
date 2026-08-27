import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipStatus } from '@prisma/client';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  // 🛠️ MÉTHODE UTILITAIRE : Permet de ne pas répéter les inclusions complexes de Prisma
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
    if (!userId) {
      return this.prisma.post.findMany({
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
        include: this.getPostIncludes(-1), // -1 pour qu'un visiteur n'ait jamais de posts "likés"
      });
    }

    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
    });

    const friendIds = friendships.map((f) =>
      f.requesterId === userId ? f.addresseeId : f.requesterId
    );

    return this.prisma.post.findMany({
      where: {
        OR: [
          { isPublic: true },
          { authorId: userId },
          { authorId: { in: friendIds } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: this.getPostIncludes(userId),
    });
  }

  // 🟢 NOUVELLE MÉTHODE : Récupérer les posts d'un utilisateur avec règles de confidentialité
  async getUserPosts(targetUserId: number, requesterId?: number) {
    // 1. On regarde son propre profil -> On voit tous ses propres posts
    if (requesterId === targetUserId) {
      return this.prisma.post.findMany({
        where: { authorId: targetUserId },
        orderBy: { createdAt: 'desc' },
        include: this.getPostIncludes(requesterId),
      });
    }

    // 2. Un visiteur non connecté regarde le profil -> Il ne voit que les posts publics
    if (!requesterId) {
      return this.prisma.post.findMany({
        where: { authorId: targetUserId, isPublic: true },
        orderBy: { createdAt: 'desc' },
        include: this.getPostIncludes(-1),
      });
    }

    // 3. Un utilisateur connecté regarde le profil d'un autre -> On vérifie s'ils sont amis
    const isFriend = await this.prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { requesterId: requesterId, addresseeId: targetUserId },
          { requesterId: targetUserId, addresseeId: requesterId },
        ],
      },
    });

    return this.prisma.post.findMany({
      where: { 
        authorId: targetUserId,
        // Si ami, on ne filtre pas sur isPublic (donc il verra aussi les posts privés). 
        // Sinon, on impose isPublic: true.
        isPublic: isFriend ? undefined : true 
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
}