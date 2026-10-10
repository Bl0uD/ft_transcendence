import { Controller, Get, Post, Body, Param, Req, UseGuards, ParseIntPipe, UseInterceptors, UploadedFile, Delete, Patch, BadRequestException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtTwoFactorGuard } from '../auth/2fa/jwt-two-factor.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { MagicBytesValidationPipe } from '../pipes/magic-bytes-validation.pipe';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Public } from '../auth/public.decorator';

@UseGuards(JwtTwoFactorGuard) 
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  private extractUserId(req: any): number | undefined {
    if (req.user) {
      return Number(req.user.id || req.user.userId || req.user.sub);
    }
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
    const userId = this.extractUserId(req);
    return this.postsService.getFeed(userId);
  }

  @Public()
  @Get('user/:userId')
  async getUserPosts(
    @Req() req: any,
    @Param('userId', ParseIntPipe) targetUserId: number,
  ) {
    const currentUserId = this.extractUserId(req);
    return this.postsService.getUserPosts(targetUserId, currentUserId);
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
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
        return cb(new BadRequestException('Seuls les fichiers images (jpg, jpeg, png, webp) sont autorisés.'), false);
      }
      cb(null, true);
    },
  }))
  async createPost(
    @Req() req: any,
    @Body('content') content: string,
    @Body('isPublic') isPublic: string,
	@UploadedFile(MagicBytesValidationPipe) file?: Express.Multer.File,
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

  @Delete(':id')
  async deletePost(@Req() req: any, @Param('id', ParseIntPipe) postId: number) {
    const userId = this.extractUserId(req);
    return this.postsService.deletePost(Number(userId), postId);
  }

  @Patch(':id/visibility')
  async updateVisibility(
    @Req() req: any,
    @Param('id', ParseIntPipe) postId: number,
    @Body('isPublic') isPublic?: boolean,
    @Body('isHidden') isHidden?: boolean,
  ) {
    const userId = this.extractUserId(req);
    return this.postsService.updateVisibility(Number(userId), postId, { isPublic, isHidden });
  }
}
