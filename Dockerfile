# syntax=docker/dockerfile:1

# Image de production FASO-ZIK.
#
# Base Debian (slim) plutot qu'Alpine : better-sqlite3 est un module natif et
# ses binaires precompiles ciblent la glibc. Sur Alpine il faudrait le
# recompiler a chaque construction, pour quelques dizaines de megaoctets
# gagnes.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    MEDIA_ROOT=/app/storage/media \
    DATABASE_FILE=/app/data/faso-zik.db

# La sortie autonome n'embarque que les dependances reellement utilisees ;
# les fichiers statiques, eux, doivent etre copies a part.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Necessaires au catalogue de demonstration et aux sauvegardes.
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/src/lib/db.js /app/src/lib/ids.js ./src/lib/

# bcryptjs est integre au code compile de l'application, donc absent de la
# sortie autonome ; les scripts en ligne de commande, eux, l'importent
# directement. better-sqlite3 y figure deja, etant declare externe.
COPY --from=builder --chown=node:node /app/node_modules/bcryptjs ./node_modules/bcryptjs

RUN mkdir -p /app/data /app/storage/media/audio /app/storage/media/video /app/storage/media/image \
    && chown -R node:node /app/data /app/storage

USER node
EXPOSE 3000

# Sonde reelle : cette adresse lit la base, elle echoue si le volume manque.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/tracks').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
