import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtTwoFactorGuard } from '../auth/2fa/jwt-two-factor.guard';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(JwtTwoFactorGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('channels/:channelId/messages')
  async getMessages(@Param('channelId') channelId: string, @Req() req: any) {
    // 🔄 MODIFIÉ : On ajoute req.user?.userId pour être sûr de choper l'ID
    const userId = Number(req.user?.sub || req.user?.id || req.user?.userId);
    
    const rawMessages = await this.chatService.getChannelMessages(Number(channelId), userId);
    
    return rawMessages.map((msg) => ({
      role: msg.sender?.username === 'Bot IA' ? 'ai' : 'user',
      content: msg.content,
    }));
  }

  @Get('channels')
  async getChannels(@Req() req: any) {
    // 🔄 MODIFIÉ : Pareil ici
    const userId = Number(req.user?.sub || req.user?.id || req.user?.userId);
    return this.chatService.getUserChannels(userId);
  }

  @Post('dms')
  async startDirectMessage(@Body('targetUserId') targetUserId: number, @Req() req: any) {
    // 🔍 LOG : On affiche ce que contient vraiment ton JWT
    console.log("Token Décrypté (req.user) :", req.user);

    // 🔄 MODIFIÉ : Pareil ici
    const rawUserId = req.user?.sub || req.user?.id || req.user?.userId;
    const userId = Number(rawUserId);
    
    console.log("---- TENTATIVE DE CRÉATION DE DM ----");
    console.log("Mon ID (userId) :", userId);
    console.log("ID de la cible (targetUserId) :", targetUserId);

    if (!rawUserId || isNaN(userId) || isNaN(targetUserId)) {
      throw new Error(`Erreur : Impossible de lire l'ID. rawUserId=${rawUserId}`);
    }

    const { channel } = await this.chatService.getOrCreateDirectMessage(userId, Number(targetUserId));
    return channel; 
  }
}