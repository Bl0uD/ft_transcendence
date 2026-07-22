import { PrismaService } from '../prisma/prisma.service';
export declare class ChatService {
    private prisma;
    constructor(prisma: PrismaService);
    saveMessage(data: {
        content: string;
        roomId: string | number;
        authorId: number | string;
    }): Promise<{
        sender: {
            id: number;
            username: string;
            avatar: string | null;
        };
    } & {
        id: number;
        createdAt: Date;
        content: string;
        senderId: number;
        channelId: number;
    }>;
}
