import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
// On étend PrismaClient pour récupérer toutes ses méthodes (this.user.create, etc.)
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  
  // Cette méthode s'exécute toute seule au démarrage du backend
  async onModuleInit() {
    await this.$connect();
    console.log('Base de données connectée !');
  }

  // Permet de fermer proprement la connexion si l'application s'arrête
  async onModuleDestroy() {
    await this.$disconnect();
  }
}