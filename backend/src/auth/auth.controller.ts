import { Controller, Post, Body, Get, Request, UseGuards } from '@nestjs/common'; // Ajout de Get, Request, UseGuards
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/auth')
export class AuthController {
  
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any) {
    const user = await this.authService.register(body);
    return {
      message: "Utilisateur créé avec succès en base de données !",
      data: user
    };
  }

  @Post('login')
  async login(@Body() body: any) {
    return this.authService.login(body);
  }
  
  // Ta nouvelle route
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return this.authService.getProfile(req.user.userId || req.user.sub);
  }
}