import { 
  Controller, Put, Get, Param, Body, UseGuards, Req, UseInterceptors, 
  UploadedFile, BadRequestException 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MagicBytesValidationPipe } from '../pipes/magic-bytes-validation.pipe';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UsersService } from './users.service';
import { JwtTwoFactorGuard } from '../auth/2fa/jwt-two-factor.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('public/:username')
  async getPublicProfile(@Param('username') username: string) {
    return this.usersService.getPublicProfile(username);
  }

  @Get('search/:query')
  async searchUsers(@Param('query') query: string) {
    return this.usersService.searchUsers(query);
  }
  @UseGuards(JwtTwoFactorGuard)
  @Put('profile')
  @UseInterceptors(FileInterceptor('avatar', {
    storage: diskStorage({
      destination: './uploads/avatars',
      filename: (req: any, file, cb) => {
        const userId = req.user?.userId || req.user?.sub || 'unknown';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${userId}-${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|gif)$/i) && !file.originalname.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
        return cb(new BadRequestException('Seuls les fichiers images (jpg, jpeg, png, webp, gif) sont autorisés.'), false);
      }
      cb(null, true);
    },
  }))
  async updateProfile(
    @Req() req: any,
    @Body('username') username?: string,
    @Body('nickname') nickname?: string,
    @Body('email') email?: string,
    @Body('password') password?: string,
    @Body('is2faAuthenticated') is2faAuthenticated?: boolean,
    @UploadedFile(MagicBytesValidationPipe) file?: Express.Multer.File,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    let avatar: string | undefined = undefined;

    if (file) {
      avatar = `/uploads/avatars/${file.filename}`;
    }

    return this.usersService.updateProfile(userId, { username, nickname, email, password, avatar });
  }
}