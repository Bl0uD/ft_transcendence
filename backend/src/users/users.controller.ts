import { 
  Controller, Put, Body, UseGuards, Req, UseInterceptors, 
  UploadedFile, BadRequestException 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
        return cb(new BadRequestException('Seuls les fichiers images (jpg, jpeg, png, webp) sont autorisés.'), false);
      }
      cb(null, true);
    },
  }))
  async updateProfile(
    @Req() req: any,
    @Body('username') username?: string,
	@Body('email') email?: string,
    @Body('password') password?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    let avatar: string | undefined = undefined;

    if (file) {
      avatar = `/uploads/avatars/${file.filename}`;
    }

    return this.usersService.updateProfile(userId, { username, email, password, avatar });
  }
}