import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class SendFriendRequestDto {
  @IsString()
  @IsNotEmpty()
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