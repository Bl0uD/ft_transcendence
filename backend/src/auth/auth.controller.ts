import { Controller, Post, Body } from '@nestjs/common';

@Controller('auth') // Avec le préfixe global, la route sera /api/auth
export class AuthController {

  @Post('register') // Devient /api/auth/register
  register(@Body() body: any) {
    console.log('Données reçues :', body);

    // Ici tu appelleras ton service Prisma plus tard. 
    // Pour l'instant, on renvoie juste un succès artificiel.
    return {
      statusCode: 201,
      message: "Utilisateur créé avec succès (Simulé)",
      data: body
    };
  }
}