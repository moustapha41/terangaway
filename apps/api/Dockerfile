# syntax=docker/dockerfile:1

# Image de production pour l'API NestJS.
#
# À construire depuis la racine du monorepo :
#   docker build -f apps/api/Dockerfile -t teranga-api .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /depot

# ─── Dépendances ─────────────────────────────────────────────────────────────
# Copie stricte des manifestes pour profiter du cache Docker et garantir
# une installation reproductible et conforme au lockfile.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/fixtures/package.json packages/fixtures/
COPY packages/tokens/package.json packages/tokens/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# ─── Construction ────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .

# 1. Vérification/génération des jetons partagés
RUN pnpm -F @teranga/tokens generer

# 2. Génération impérative du client Prisma avant la compilation NestJS
RUN pnpm -F @teranga/api prisma:generate

# 3. Compilation NestJS (TypeScript -> JavaScript dans dist/)
RUN pnpm -F @teranga/api exec nest build

# 4. Déploiement isolé de l'API et de ses dépendances de production
RUN pnpm deploy --filter=@teranga/api --prod /sortie

# 5. Préservation des artefacts Prisma générés nécessaires à l'exécution
RUN cp -r node_modules/.pnpm/@prisma+client*/node_modules/.prisma /sortie/node_modules/.pnpm/@prisma+client*/node_modules/ 2>/dev/null || true
RUN cp -r node_modules/.pnpm/@prisma+client*/node_modules/.prisma /sortie/node_modules/ 2>/dev/null || true
RUN find node_modules/.pnpm -name ".prisma" -type d -maxdepth 4 -exec cp -r {} /sortie/node_modules/ \; 2>/dev/null || true
RUN cp -r apps/api/prisma /sortie/prisma

# 6. Élimination des secrets potentiels, tests et fichiers sources bruts de l'image de sortie
RUN rm -rf /sortie/.env* /sortie/src /sortie/test /sortie/tsconfig.json /sortie/nest-cli.json /sortie/vitest.config.ts

# ─── Exécution ───────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3101
WORKDIR /app

# Récupération de l'arborescence autonome sous l'utilisateur non privilégié node
COPY --from=build --chown=node:node /sortie ./

USER node
EXPOSE 3101

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||'3101')+'/sante').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && node --import tsx dist/main.js"]
