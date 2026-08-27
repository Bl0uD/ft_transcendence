import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../public.decorator'; // Attention au "../" car ce fichier est dans le dossier "2fa"

@Injectable()
export class JwtTwoFactorGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true; // Laisse passer la requête si la route est @Public()
    }
    
    return super.canActivate(context); // Sinon, on fait la vérification normale
  }

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