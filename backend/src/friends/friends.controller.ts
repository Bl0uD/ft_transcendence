import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { JwtTwoFactorGuard } from '../auth/2fa/jwt-two-factor.guard';
import { SendFriendRequestDto, AcceptRequestDto, FriendActionDto } from './dto/friend-request.dto';

@Controller('friends')
@UseGuards(JwtTwoFactorGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  // Petite fonction utilitaire pour extraire le bon ID du token JWT
  private getUserId(req: any): number {
    return req.user.userId || req.user.sub;
  }

  /**
   * GET /friends - Liste des amis
   */
  @Get()
  getFriendsUsers(@Req() req) {
    return this.friendsService.getFriendsUsers(this.getUserId(req));
  }

  /**
   * GET /friends/requests/pending - Demandes d'amis reçues en attente
   */
  @Get('requests/pending')
  getPendingRequests(@Req() req) {
    return this.friendsService.getPendingRequests(this.getUserId(req));
  }

  /**
   * GET /friends/blocked - Liste des utilisateurs bloqués
   */
  @Get('blocked')
  getBlockedUsers(@Req() req) {
    return this.friendsService.getBlockedUsers(this.getUserId(req));
  }

  /**
   * POST /friends/request - Demander en ami via pseudo
   */
  @Post('request')
  sendRequest(@Req() req, @Body() dto: SendFriendRequestDto) {
    return this.friendsService.sendRequest(this.getUserId(req), dto.username);
  }

  /**
   * PUT /friends/accept - Accepter une demande d'ami
   */
  @Put('accept')
  acceptRequest(@Req() req, @Body() dto: AcceptRequestDto) {
    return this.friendsService.acceptRequest(this.getUserId(req), dto.requestId);
  }

  /**
   * POST /friends/block - Bloquer un utilisateur
   */
  @Post('block')
  blockUser(@Req() req, @Body() dto: FriendActionDto) {
    return this.friendsService.blockUser(this.getUserId(req), dto.targetUserId);
  }

  /**
   * DELETE /friends/block/:targetUserId - Débloquer un utilisateur
   */
  @Delete('block/:targetUserId')
  unblockUser(
    @Req() req,
    @Param('targetUserId', ParseIntPipe) targetUserId: number,
  ) {
    return this.friendsService.unblockUser(this.getUserId(req), targetUserId);
  }

  /**
   * DELETE /friends/:targetUserId - Supprimer un ami ou rejeter une demande
   */
  @Delete(':targetUserId')
  removeFriend(
    @Req() req,
    @Param('targetUserId', ParseIntPipe) targetUserId: number,
  ) {
    return this.friendsService.removeRelation(this.getUserId(req), targetUserId);
  }
}