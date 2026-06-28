import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(body: any): Promise<{
        id: number;
        email: string;
        username: string;
        createdAt: Date;
    }>;
    login(body: any): Promise<{
        access_token: string;
    }>;
}
