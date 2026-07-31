import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { ChatService } from './chat.service'; // Décommente si tu as un service

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  // constructor(private readonly chatService: ChatService) {}

  @Get('channels/:channelId/messages')
  async getMessages(@Param('channelId') channelId: string) {
    // TODO: Appeler ton service pour récupérer les vrais messages de la BDD
    // return this.chatService.getMessages(channelId);
    
    // Pour l'instant, on renvoie un tableau vide pour stopper l'erreur 404 du frontend
    return []; 
  }
}