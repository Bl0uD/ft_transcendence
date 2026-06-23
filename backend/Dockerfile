# Image de base légère avec Node.js 20
FROM node:20-alpine

# Définition du dossier de travail dans le conteneur
WORKDIR /app

# Copie des fichiers de configuration des dépendances
COPY package*.json ./

# Installation des dépendances (y compris de dev pour le hot-reload)
RUN npm install

# Copie du reste du code source du backend
COPY . .

# Si vous utilisez Prisma plus tard, décommentez la ligne suivante :
# RUN npx prisma generate

# Exposition du port interne utilisé par NestJS (non visible de l'extérieur)
EXPOSE 3000

# Commande par défaut pour lancer NestJS en mode développement avec hot-reload
CMD ["npm", "run", "start:dev"]