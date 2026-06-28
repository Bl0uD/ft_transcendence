import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt'; // <--- Import du module
import { PassportModule } from '@nestjs/passport'; // Importe ceci
import { JwtStrategy } from './jwt.strategy';      // Importe ta stratégie

@Module({
  imports: [
	PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET, // Utilise la clé du .env
      signOptions: { expiresIn: '1h' }, // Le token expire au bout d'une heure
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, JwtStrategy],
})
export class AuthModule {}