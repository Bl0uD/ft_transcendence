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

  @Public()
  @Get('feed')
  async getFeed(@Req() req: any) {
    let userId: number | undefined;
    if (req.user) {
      userId = Number(req.user.id || req.user.userId || req.user.sub);
    }
    
    return this.postsService.getFeed(userId);
  }

  // 🟢 NOUVELLE ROUTE : Récupérer les posts d'un utilisateur
  @Public()
  @Get('user/:userId')
  async getUserPosts(@Param('userId', ParseIntPipe) targetUserId: number, @Req() req: any) {
    let requesterId: number | undefined;
    if (req.user) {
      requesterId = Number(req.user.id || req.user.userId || req.user.sub);
    }
    
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
    const userId = req.user.id || req.user.userId || req.user.sub;
    const isPublicBool = isPublic === 'true';
    
    const imageUrl = file ? `/uploads/posts/${file.filename}` : undefined; 
    
    return this.postsService.createPost(Number(userId), content, isPublicBool, imageUrl);
  }

  @Post(':id/like')
  async toggleLike(@Req() req: any, @Param('id', ParseIntPipe) postId: number) {
    const userId = req.user.id || req.user.userId || req.user.sub;
    return this.postsService.toggleLike(Number(userId), postId);
  }

  @Post(':id/comment')
  async addComment(
    @Req() req: any,
    @Param('id', ParseIntPipe) postId: number,
    @Body('content') content: string,
  ) {
    const userId = req.user.id || req.user.userId || req.user.sub;
    return this.postsService.addComment(Number(userId), postId, content);
  }
}