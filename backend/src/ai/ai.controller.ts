import { Controller, Post, Body, UseGuards, Res, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatPromptDto } from './dto/chat-prompt.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat/stream')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async chatStream(
    @Body() dto: ChatPromptDto,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    // CORRECTION : On récupère le bon ID depuis le token JWT
    const user = req.user as any;
    const userId = user?.userId || user?.sub; 

    return this.aiService.streamResponse(dto.messages, res, userId);
  }
}