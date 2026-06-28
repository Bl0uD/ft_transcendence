import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secretKey', // UTILISE UNE VAR D'ENV EN PROD !
    });
  }

  async validate(payload: any) {
    // Ce qui est retourné ici sera injecté dans la requête (req.user)
    return { userId: payload.sub, email: payload.email };
  }
}