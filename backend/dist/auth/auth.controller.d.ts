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
    }>;
    getProfile(req: any): any;
}
