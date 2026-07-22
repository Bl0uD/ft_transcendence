import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    updateProfile(req: any, username?: string, email?: string, password?: string, file?: Express.Multer.File): Promise<{
        id: number;
        email: string;
        username: string;
        avatar: string | null;
    }>;
}
