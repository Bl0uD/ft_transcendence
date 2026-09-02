import { Controller, Post, Body, UseGuards, Res, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AiService } from './ai.service';
import { JwtTwoFactorGuard } from '../auth/2fa/jwt-two-factor.guard';
import { ChatPromptDto } from './dto/chat-prompt.dto';

@Controller('ai')
@UseGuards(JwtTwoFactorGuard, ThrottlerGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // 🟢 ROUTE 1 : Ollama (Existante - Routage JSON)
  @Post('chat/stream')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async ollamaStream(
    @Body() dto: ChatPromptDto,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const userId = user?.userId || user?.sub; 

    return this.aiService.streamResponse(dto.messages, res, userId);
  }

  // 🟢 ROUTE 2 : Gemini (Nouvelle - Conversation Générale Markdown)
  @Post('gemini/stream')
  @HttpCode(HttpStatus.OK)
  // Quota plus restrictif (5 req/min) pour protéger les crédits de l'API externe Google
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async geminiStream(
    @Body() dto: ChatPromptDto,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const userId = user?.userId || user?.sub; 

    return this.aiService.streamGeminiResponse(dto.messages, res, userId);
  }
}