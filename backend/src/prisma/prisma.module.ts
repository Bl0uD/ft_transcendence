import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Rends le module global
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}