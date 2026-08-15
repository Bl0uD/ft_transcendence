import { Module, Global } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt'; 
import { PassportModule } from '@nestjs/passport'; 
import { JwtStrategy } from './jwt.strategy';      
import { FortyTwoStrategy } from './42auth/forty-two.strategy';
import { TwoFactorAuthService } from './2fa/two-factor-auth.service';


@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET, 
      signOptions: { expiresIn: '1h' }, 
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, 
    PrismaService, 
    JwtStrategy, 
    FortyTwoStrategy,
	TwoFactorAuthService
  ], 
  exports: [AuthService, JwtModule],
})
export class AuthModule {}