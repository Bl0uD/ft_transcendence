import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: "L'identifiant est requis." })
  @MaxLength(320, { message: "L'identifiant ne peut pas dépasser 320 caractères." })
  identifier: string;

  @IsString()
  @IsNotEmpty({ message: "Le mot de passe est requis." })
  @MaxLength(100, { message: "Le mot de passe ne peut pas dépasser 100 caractères." })
  password: string;
}
