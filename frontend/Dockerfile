# Image de base identique pour la cohérence de la stack
FROM node:20-alpine

WORKDIR /app

# Copie des fichiers de dépendances avec les bons droits
COPY --chown=node:node package*.json ./

# Installation en tant qu'utilisateur non-root
RUN npm install

# Copie du code source du front
COPY --chown=node:node . .

# Utilisation de l'utilisateur non privilégié fourni par l'image Node
USER node

# Port par défaut de Vite
EXPOSE 5173

# Configuration cruciale pour Docker : --host permet à Caddy de communiquer avec Vite
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]