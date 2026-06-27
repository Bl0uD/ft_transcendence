#!/bin/sh
set -e

# Vérification présence Prisma
npx prisma generate
# On ignore la migration si la DB n'est pas prête, mais on l'ajoute
npx prisma migrate deploy

# Lancement
exec npm run start:dev