import { Controller, Post, Body, Get, Request, Req, UseGuards, Res, HttpCode, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { TwoFactorAuthService } from './2fa/two-factor-auth.service';
import { JwtTwoFactorGuard } from './2fa/jwt-two-factor.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorAuthService: TwoFactorAuthService
  ) {}

  @Post('register')
  async register(@Body() body: any) {
    const user = await this.authService.register(body);
    return {
      message: "Utilisateur cree avec succes en base de donnees !",
      data: user
    };
  }

  @Post('login')
  async login(@Body() body: any) {
    return this.authService.login(body);
  }

  // --- ROUTES OAUTH2 API 42 ---

  @UseGuards(AuthGuard('42'))
  @Get('42')
  async fortyTwoAuth() {
    // Redirection automatique vers 42 geree par Passport
  }

  @Get('42/callback')
  @UseGuards(AuthGuard('42')) // Ou le nom de ton guard 42
  async fortyTwoAuthRedirect(@Req() req, @Res() res: Response) {
    // 1. On genere le JWT pour l'utilisateur
    const jwt = await this.authService.login(req.user); // Adapte selon le nom de ta methode
    
    // 2. On redirige vers le frontend en passant le token dans l'URL
    const frontendUrl = process.env.FRONTEND_URL;
    res.redirect(`${frontendUrl}/login?token=${jwt.access_token}`);
  }

  @UseGuards(JwtTwoFactorGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return this.authService.getProfile(req.user.userId || req.user.sub);
  }

  // --- NOUVELLES ROUTES 2FA ---

  // 1. Genere le QR Code (quand l'utilisateur clique sur "Activer la 2FA" dans ses parametres)
  @UseGuards(JwtAuthGuard)
  @Get('2fa/generate')
  async generate2fa(@Request() req) {
    // On recupere le profil complet pour avoir l'email et l'ID
    const user = await this.authService.getProfile(req.user.userId || req.user.sub);
    
    const { otpauthUrl } = await this.twoFactorAuthService.generateTwoFactorAuthenticationSecret(user);
    const qrCode = await this.twoFactorAuthService.generateQrCodeDataURL(otpauthUrl);
    
    return { qrCode }; 
  }

  // 2. Confirme et active la 2FA (l'utilisateur scanne le QR et rentre son premier code)
  @UseGuards(JwtAuthGuard)
  @Post('2fa/turn-on')
  @HttpCode(200)
  async turnOnTwoFactorAuthentication(@Request() req, @Body() body: { twoFactorCode: string }) {
    const userId = req.user.userId || req.user.sub;
    const isCodeValid = await this.twoFactorAuthService.isTwoFactorAuthenticationCodeValid(
      body.twoFactorCode, 
      userId
    );

    if (!isCodeValid) {
      throw new UnauthorizedException('Code 2FA invalide');
    }

    await this.authService.enableTwoFactor(userId);
    return { message: '2FA activee avec succes' };
  }

  // 3. Authentification finale (etape de login si le compte a la 2FA d'activee)
  @UseGuards(JwtAuthGuard)
  @Post('2fa/authenticate')
  @HttpCode(200)
  async authenticate2FA(@Request() req, @Body() body: { twoFactorCode: string }) {
    const userId = req.user.userId || req.user.sub;
    const isCodeValid = await this.twoFactorAuthService.isTwoFactorAuthenticationCodeValid(
      body.twoFactorCode, 
      userId
    );

    if (!isCodeValid) {
      throw new UnauthorizedException('Code 2FA invalide');
    }

    // Renvoie le nouveau JWT attestant que la 2FA a ete reussie
    return this.authService.loginWith2fa(userId);
  }
}