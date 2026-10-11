import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: "Le nom d'utilisateur ne peut pas être vide." })
  @MinLength(3, { message: "Le nom d'utilisateur doit contenir au moins 3 caractères." })
  @MaxLength(24, { message: "Le nom d'utilisateur ne peut pas dépasser 24 caractères." })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  username: string;

  @IsEmail({}, { message: "Format d'email invalide." })
  @IsNotEmpty({ message: "L'email ne peut pas être vide." })
  @MaxLength(320, { message: "L'email ne peut pas dépasser 320 caractères." })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @IsString()
  @IsNotEmpty({ message: "Le mot de passe ne peut pas être vide." })
  @MinLength(6, { message: "Le mot de passe doit contenir au moins 6 caractères." })
  @MaxLength(100, { message: "Le mot de passe ne peut pas dépasser 100 caractères." })
  password: string;
}