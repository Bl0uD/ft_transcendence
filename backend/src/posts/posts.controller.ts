import { Controller, Get, Post, Body, Param, Req, UseGuards, ParseIntPipe, UseInterceptors, UploadedFile } from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Public } from '../auth/public.decorator';

@UseGuards(JwtAuthGuard) 
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // 🛠️ FONCTION UTILITAIRE : Extrait l'ID même si @Public() a désactivé req.user
  private extractUserId(req: any): number | undefined {
    // 1. Si le Guard a fait son travail
    if (req.user) {
      return Number(req.user.id || req.user.userId || req.user.sub);
    }
    // 2. Si @Public() a ignoré le Guard, mais que l'utilisateur est quand même connecté
    if (req.headers && req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        // On décode la charge utile du JWT (Base64)
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return Number(payload.sub || payload.id || payload.userId);
      } catch (e) {
        return undefined;
      }
    }
    return undefined;
  }

  @Public()
  @Get('feed')
  async getFeed(@Req() req: any) {
    const userId = this.extractUserId(req); // 🟢 Utilisation de la nouvelle fonction
    return this.postsService.getFeed(userId);
  }

  @Public()
  @Get('user/:userId')
  async getUserPosts(@Param('userId', ParseIntPipe) targetUserId: number, @Req() req: any) {
    const requesterId = this.extractUserId(req); // 🟢 Utilisation de la nouvelle fonction
    return this.postsService.getUserPosts(targetUserId, requesterId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads/posts',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
  }))
  async createPost(
    @Req() req: any,
    @Body('content') content: string,
    @Body('isPublic') isPublic: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = this.extractUserId(req);
    const isPublicBool = isPublic === 'true';
    const imageUrl = file ? `/uploads/posts/${file.filename}` : undefined; 
    
    return this.postsService.createPost(Number(userId), content, isPublicBool, imageUrl);
  }

  @Post(':id/like')
  async toggleLike(@Req() req: any, @Param('id', ParseIntPipe) postId: number) {
    const userId = this.extractUserId(req);
    return this.postsService.toggleLike(Number(userId), postId);
  }

  @Post(':id/comment')
  async addComment(
    @Req() req: any,
    @Param('id', ParseIntPipe) postId: number,
    @Body('content') content: string,
  ) {
    const userId = this.extractUserId(req);
    return this.postsService.addComment(Number(userId), postId, content);
  }
}