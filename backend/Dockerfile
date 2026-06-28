FROM node:20-alpine

# 1. Installer openssl en tant que root (requis par Prisma)
RUN apk add --no-cache openssl

ENV NPM_CONFIG_LEGACY_PEER_DEPS=true

WORKDIR /app

# 2. Préparer les permissions pour l'utilisateur node
RUN chown -R node:node /app

# 3. Passer en utilisateur node pour le reste des opérations
USER node

# 4. Copier les fichiers et installer les dépendances
COPY --chown=node:node package*.json ./

RUN npm install 
RUN npm install @nestjs/jwt passport @nestjs/passport passport-jwt
RUN npm install -D @types/passport-jwt
RUN npm install bcrypt
RUN npm install -D @types/bcrypt

# 5. Copier le code source
COPY --chown=node:node . .

# 6. Générer le client Prisma et compiler
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:dev"]