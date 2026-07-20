import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(body: any): Promise<{
        email: string;
        username: string;
        createdAt: Date;
        id: number;
    }>;
    login(body: any): Promise<{
        access_token: string;
        user: {
            id: number;
            email: string;
            username: string;
            createdAt: Date;
        };
    }>;
    getProfile(userId: number): Promise<{
        email: string;
        username: string;
        createdAt: Date;
        id: number;
    }>;
}
