// src/ai/dto/chat-prompt.dto.ts
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNotEmpty, IsString, ValidateNested, ArrayMinSize } from 'class-validator';

export class ChatMessageDto {
  @IsIn(['user', 'assistant', 'system'], { message: 'Rôle invalide' })
  role: 'user' | 'assistant' | 'system';

  @IsString()
  @IsNotEmpty({ message: 'Le contenu du message ne peut pas être vide' })
  content: string;
}

export class ChatPromptDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Il faut au moins un message.' })
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];
}