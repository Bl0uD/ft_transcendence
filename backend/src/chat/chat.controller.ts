import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtTwoFactorGuard } from '../auth/2fa/jwt-two-factor.guard';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(JwtTwoFactorGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('channels/:channelId/messages')
  async getMessages(@Param('channelId') channelId: string) {
    // 🟢 On appelle la BDD
    const rawMessages = await this.chatService.getChannelMessages(channelId);
    
    // 🟢 On formate pour React ({ role: 'user' | 'ai', content })
    return rawMessages.map((msg) => ({
      role: msg.sender?.username === 'Bot IA' ? 'ai' : 'user',
      content: msg.content,
    }));
  }
  @Get('channels')
  async getChannels() {
    return this.chatService.getAllChannels();
  }
}