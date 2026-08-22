import { IsString, IsNotEmpty, MaxLength, IsInt, IsPositive } from 'class-validator';
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

  // 🔄 MODIFIÉ : On attend désormais un channelId numérique strict
  @IsInt({ message: 'Le channelId doit être un nombre entier.' })
  @IsPositive({ message: 'Le channelId doit être un nombre positif.' })
  @IsNotEmpty()
  channelId: number;
}