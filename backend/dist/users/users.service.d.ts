import { PrismaService } from '../prisma/prisma.service';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    updateProfile(userId: number | string, data: {
        username?: string;
        email?: string;
        password?: string;
        avatar?: string;
    }): Promise<{
        id: number;
        email: string;
        username: string;
        avatar: string | null;
    }>;
}
