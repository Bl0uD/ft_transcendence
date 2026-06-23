# Image de base légère avec Node.js 20
FROM node:20-alpine

# Définition du dossier de travail dans le conteneur
WORKDIR /app

# Copie des fichiers de configuration avec les bons droits
COPY --chown=node:node package*.json ./

# Installation des dépendances
RUN npm install

# Copie du reste du code source
COPY --chown=node:node . .

# Utilisation de l'utilisateur non privilégié fourni par l'image Node
USER node

# Si vous utilisez Prisma plus tard, décommentez la ligne suivante :
# RUN npx prisma generate

# Exposition du port interne
EXPOSE 3000

# Commande par défaut pour lancer NestJS en mode développement
CMD ["npm", "run", "start:dev"]