import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(body: any): Promise<{
        message: string;
        data: {
            email: string;
            username: string;
            createdAt: Date;
            id: number;
        };
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
    getProfile(req: any): Promise<{
        email: string;
        username: string;
        createdAt: Date;
        id: number;
    }>;
}
