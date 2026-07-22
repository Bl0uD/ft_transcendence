import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(body: any): Promise<{
        message: string;
        data: {
            id: number;
            email: string;
            username: string;
            createdAt: Date;
        };
    }>;
    login(body: any): Promise<{
        access_token: string;
        user: {
            id: number;
            email: string;
            username: string;
            createdAt: Date;
            avatar: string | null;
        };
    }>;
    getProfile(req: any): Promise<{
        id: number;
        email: string;
        username: string;
        avatar: string | null;
        createdAt: Date;
    }>;
}
