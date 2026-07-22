import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateProfile(
    userId: number | string, 
    data: { username?: string; email?: string; password?: string; avatar?: string }
  ) {
    const numericId = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    try {
      const updateData: Prisma.UserUpdateInput = {};

      if (data.username !== undefined) {
        updateData.username = data.username;
      }

      if (data.email !== undefined) {
        updateData.email = data.email;
      }

      if (data.avatar !== undefined) {
        updateData.avatar = data.avatar;
      }

      // Hachage du mot de passe uniquement s'il est fourni et non vide
      if (data.password && data.password.trim() !== '') {
        updateData.password = await bcrypt.hash(data.password, 10);
      }

      return await this.prisma.user.update({
        where: { id: numericId },
        data: updateData,
        select: { id: true, username: true, email: true, avatar: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002 = Violation d'unicité (ex: username ou email déjà existant)
        if (error.code === 'P2002') {
          const target = (error.meta?.target as string[]) || [];
          if (target.includes('email')) {
            throw new ConflictException("Cet email est déjà utilisé.");
          }
          throw new ConflictException("Ce nom d'utilisateur est déjà pris.");
        }
      }
      throw new InternalServerErrorException("Erreur lors de la mise à jour du profil.");
    }
  }
}