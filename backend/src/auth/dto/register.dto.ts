import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: "Le nom d'utilisateur ne peut pas être vide." })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  username: string;

  @IsEmail({}, { message: "Format d'email invalide." })
  @IsNotEmpty({ message: "L'email ne peut pas être vide." })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @IsString()
  @IsNotEmpty({ message: "Le mot de passe ne peut pas être vide." })
  @MinLength(6, { message: "Le mot de passe doit contenir au moins 6 caractères." })
  password: string;
}