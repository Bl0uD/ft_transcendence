# Image de base identique pour la cohérence de la stack
FROM node:20-alpine

WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

RUN npm install

# Copie du code source du front (fichiers React, Tailwind, etc.)
COPY . .

# Port par défaut de Vite
EXPOSE 5173

# Configuration cruciale pour Docker : --host permet à Caddy de communiquer avec Vite
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]