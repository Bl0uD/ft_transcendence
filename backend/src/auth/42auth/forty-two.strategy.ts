import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { Strategy } from 'passport-42';
import { AuthService } from '../auth.service';

@Injectable()
export class FortyTwoStrategy extends PassportStrategy(Strategy, '42') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.FORTYTWO_APP_ID,
      clientSecret: process.env.FORTYTWO_APP_SECRET,
      callbackURL: process.env.FORTYTWO_CALLBACK_URL,
    });
	console.log("UID 42 :", process.env.FORTYTWO_APP_ID);
  }

  async validate(accessToken: string, refreshToken: string, profile: any): Promise<any> {
	  
	// 👇 AJOUTE CES LOGS POUR TOUT VOIR DANS TON TERMINAL BACKEND
	console.log("==================== PROFIL 42 BRUT ====================");
	console.log(JSON.stringify(profile, null, 2));
	console.log("========================================================");
	console.log("Photos reçues :", profile.photos);
	console.log("Image JSON :", profile._json?.image);
	
	// On extrait bien l'ID fourni par l'API 42 (profil.id)
    const user = {
      fortyTwoId: profile.id.toString(),
      email: profile.emails[0].value,
      username: profile.username,
      avatar: profile.photos?.[0]?.value || profile._json?.image?.link || '/assets/default-avatar.png',
    };
    
    // Le service va gerer la fusion ou la creation
    return this.authService.validateUser(user); 
  }
}