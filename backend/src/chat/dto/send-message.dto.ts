import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000, { message: 'Le message ne peut pas dépasser 1000 caractères.' })
  @Transform(({ value }) => 
    typeof value === 'string'
      ? sanitizeHtml(value, {
          allowedTags: [],       // Supprime TOUTES les balises HTML (<script>, <img>, etc.)
          allowedAttributes: {}, // Supprime tous les attributs
        }).trim()
      : value
  )
  content: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;
}