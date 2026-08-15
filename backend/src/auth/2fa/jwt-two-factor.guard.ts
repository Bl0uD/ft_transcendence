import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtTwoFactorGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    if (user.isTwoFactorEnabled && !user.isTwoFactorAuthenticated) {
      throw new UnauthorizedException('2FA validation required');
    }
    return user;
  }
}