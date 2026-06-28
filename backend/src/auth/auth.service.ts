import { Injectable, ConflictException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt'; // N'oublie pas cet import !
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  // AJOUTE : private jwtService: JwtService dans le constructeur
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async register(body: any) {
    try {
      const userExists = await this.prisma.user.findUnique({
        where: { email: body.email },
      });

      if (userExists) {
        throw new ConflictException('Cet email est déjà utilisé.');
      }

      const hashedPassword = await bcrypt.hash(body.password, 10);

      const newUser = await this.prisma.user.create({
        data: {
          email: body.email,
          username: body.username,
          password: hashedPassword,
        },
        select: {
          id: true,
          email: true,
          username: true,
          createdAt: true,
        }
      });

      return newUser;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException("Erreur lors de la création de l'utilisateur");
    }
  }

  async login(body: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user) throw new UnauthorizedException('Email ou mot de passe incorrect');

    const isMatch = await bcrypt.compare(body.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Email ou mot de passe incorrect');

    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}