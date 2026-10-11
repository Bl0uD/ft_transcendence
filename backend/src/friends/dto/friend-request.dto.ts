import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendFriendRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(24, { message: "Le nom d'utilisateur ne peut pas dépasser 24 caractères." })
  username: string;
}

export class FriendActionDto {
  @IsInt()
  @IsNotEmpty()
  targetUserId: number;
}

export class AcceptRequestDto {
  @IsInt()
  @IsNotEmpty()
  requestId: number;
}