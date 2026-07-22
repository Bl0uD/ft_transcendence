import { IsString, IsNotEmpty, MaxLength, IsUUID } from 'class-validator';
import sanitizeHtml from 'sanitize-html';
import { Transform } from 'class-transformer';

export class SendMessageDto {
  @IsUUID()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000, { message: 'Le message ne peut pas dépasser 1000 caractères.' })
  @Transform(({ value }) => sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {}
  }))
  content: string;
}