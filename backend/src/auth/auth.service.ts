import { 
  Injectable, 
  ConflictException, 
  InternalServerErrorException, 
  UnauthorizedException, 
  NotFoundException // 👈 Ajouté ici
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
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
      console.error("❌ ERREUR INSCRIPTION :", error);
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

    const payload = { sub: user.id, email: user.email, username: user.username, avatar: user.avatar };
    return {
      access_token: this.jwtService.sign(payload),
	  user: {
      	id: user.id,
      	email: user.email,
      	username: user.username,
      	createdAt: user.createdAt,
		avatar: user.avatar,
	  }
    };
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
		avatar: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }
}