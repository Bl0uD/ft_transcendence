import { 
  Injectable, 
  ConflictException, 
  InternalServerErrorException, 
  UnauthorizedException, 
  NotFoundException 
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async register(body: any) {
    try {
      // 👇 Nettoyage des chaînes de caractères
      const cleanEmail = body.email.trim();
      const cleanUsername = body.username.trim();

      const userExists = await this.prisma.user.findFirst({
        where: { 
          OR: [
            { email: cleanEmail },
            { username: cleanUsername }
          ]
        },
      });

      if (userExists) {
        throw new ConflictException('Cet email ou ce nom d\'utilisateur est déjà utilisé.');
      }

      const hashedPassword = await bcrypt.hash(body.password, 10);

      const newUser = await this.prisma.user.create({
        data: {
          email: cleanEmail,          // 👈 Utilise les variables nettoyées
          username: cleanUsername,    // 👈 Utilise les variables nettoyées
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

  // Modifie pour accepter soit un body (login manuel), soit un user (login 42)
async login(bodyOrUser: any) {
    let user;

    // 🚀 CAS 1 : Login manuel
	if (bodyOrUser.identifier && bodyOrUser.password) {
      
      // 👇 ON NETTOIE L'IDENTIFIANT ICI (supprime les espaces avant/après)
      const cleanIdentifier = bodyOrUser.identifier.trim();
      
      console.log(`🔍 [LOGIN] Tentative avec l'identifiant : "${cleanIdentifier}"`);

      user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: cleanIdentifier },
            { username: cleanIdentifier }, // 👈 On pourrait même utiliser mode: 'insensitive' ici maintenant
          ],
        },
      });

      console.log(`👤 [LOGIN] Résultat en base de données :`, user ? `Trouvé (${user.username})` : `NON TROUVÉ`);

      // 🚨 Erreurs spécifiques pour comprendre ce qui bloque
      if (!user) {
        throw new UnauthorizedException(`Aucun compte trouvé pour l'identifiant : ${bodyOrUser.identifier}`);
      }

      if (!user.password) {
        throw new UnauthorizedException("Ce compte est lié à 42. Utilisez le bouton 'Se connecter avec 42'.");
      }

      const isMatch = await bcrypt.compare(bodyOrUser.password, user.password);
      if (!isMatch) {
        throw new UnauthorizedException("Mot de passe incorrect.");
      }
    } 
    // CAS 2 : Login API 42
    else if (bodyOrUser.id) {
      user = bodyOrUser;
    } else {
      throw new UnauthorizedException("Données de connexion invalides.");
    }

    // 🔑 GENERATION DU JWT
    const payload = { 
      sub: user.id, 
      email: user.email, 
      username: user.username, 
      avatar: user.avatar,
      isTwoFactorAuthenticated: !user.isTwoFactorEnabled 
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
        avatar: user.avatar,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
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
        isTwoFactorEnabled: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }

  async validateUser(profile: { email: string, username: string, avatar: string, fortyTwoId: string }) {
    let user = await this.prisma.user.findUnique({ 
      where: { fortyTwoId: profile.fortyTwoId } 
    });

    if (user) {
      return this.prisma.user.update({
        where: { id: user.id },
        data: {
          avatar: (!user.avatar || user.avatar === '/assets/default-avatar.png') ? profile.avatar : user.avatar,
        }
      });
    }

    user = await this.prisma.user.findUnique({ 
      where: { email: profile.email } 
    });

    if (user) {
      return this.prisma.user.update({
        where: { id: user.id },
        data: {
          fortyTwoId: profile.fortyTwoId,
          avatar: (!user.avatar || user.avatar === '/assets/default-avatar.png') ? profile.avatar : user.avatar,
        }
      });
    }

    let uniqueUsername = profile.username;
    let usernameExists = await this.prisma.user.findUnique({ where: { username: uniqueUsername } });
    let counter = 1;
    
    while (usernameExists) {
      uniqueUsername = `${profile.username}_${counter}`;
      usernameExists = await this.prisma.user.findUnique({ where: { username: uniqueUsername } });
      counter++;
    }

    return this.prisma.user.create({
      data: {
        email: profile.email,
        username: uniqueUsername,
        nickname: profile.username,
        avatar: profile.avatar,
        fortyTwoId: profile.fortyTwoId,
      }
    });
  }

  // --- NOUVEAU : FONCTIONS 2FA ---

  async enableTwoFactor(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: true },
    });
  }

  async loginWith2fa(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    
    const payload = { 
      sub: user.id, 
      email: user.email, 
      username: user.username, 
      isTwoFactorAuthenticated: true 
    };
    
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}