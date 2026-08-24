import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipStatus } from '@prisma/client';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async createPost(userId: number, content: string, isPublic: boolean, imageUrl?: string) {
    return this.prisma.post.create({
      data: {
        content,
        isPublic,
        imageUrl,
        authorId: userId,
      },
      // 🟢 FIX : On demande à Prisma de renvoyer les mêmes inclusions que getFeed
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        likes: true, 
        comments: {
          include: { user: { select: { id: true, username: true, avatar: true } } }
        },
        _count: { select: { likes: true, comments: true } },
      },
    });
  }

  async getFeed(userId: number) {
    // 1. Récupérer les amis pour le filtrage
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
    });

    const friendIds = friendships.map((f) =>
      f.requesterId === userId ? f.addresseeId : f.requesterId
    );

    // 2. Récupérer les posts (Publics OU (Privés ET (auteur = moi OU auteur = ami)))
    return this.prisma.post.findMany({
      where: {
        OR: [
          { isPublic: true },
          { authorId: userId },
          { authorId: { in: friendIds } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        likes: { where: { userId }, select: { id: true } }, // Permet de savoir si l'utilisateur courant a liké
        comments: {
          include: { user: { select: { id: true, username: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { likes: true, comments: true } },
      },
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