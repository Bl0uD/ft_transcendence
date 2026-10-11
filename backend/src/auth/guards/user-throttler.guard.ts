import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req.user?.userId || req.user?.sub || req.user?.id) {
      return `user_${req.user.userId || req.user.sub || req.user.id}`;
    }

    const authHeader = req.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          const userId = payload?.userId || payload?.sub || payload?.id;
          if (userId) {
            return `user_${userId}`;
          }
        }
      } catch {
        // Fallback vers l'adresse IP si le token n'est pas décodable
      }
    }

    return req.ips?.length ? req.ips[0] : (req.ip || '127.0.0.1');
  }
}
