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
# USER node

# Port par défaut de Vite
EXPOSE 5173

# En production, on build d'abord le projet puis on le sert avec vite preview
CMD ["sh", "-c", "npm run build && npm run preview -- --host 0.0.0.0 --port 5173"]