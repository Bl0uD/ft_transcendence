import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // 👈 Indispensable

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    // Ce qui est retourné ici sera injecté dans la requête (req.user)
    return { 
      userId: payload.sub, 
      email: payload.email, 
      username: payload.username,
      isTwoFactorEnabled: user.isTwoFactorEnabled, // 👈 Requis par le Guard
      isTwoFactorAuthenticated: payload.isTwoFactorAuthenticated // 👈 Requis par le Guard
    };
  }
}