# syntax=docker/dockerfile:1

# Image de production pour le site web Next.js 15.
#
# À construire depuis la racine du monorepo :
#   docker build -f apps/web/Dockerfile -t teranga-web .
#
# Base Debian (glibc) pour la compatibilité avec sharp et Next SWC précompilés.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /depot

# ─── Dépendances ─────────────────────────────────────────────────────────────
# Copie des manifestes pour mise en cache de l'étape d'installation reproductible
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/fixtures/package.json packages/fixtures/
COPY packages/tokens/package.json packages/tokens/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# ─── Construction ────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .

# 1. Compilation des packages partagés avant l'application cliente
RUN pnpm -F @teranga/tokens generer

# 2. Variables de build Next.js (inlinées dans le bundle JavaScript client)
ARG NEXT_PUBLIC_API_MOCK=false
ENV NEXT_PUBLIC_API_MOCK=$NEXT_PUBLIC_API_MOCK
ENV NEXT_TELEMETRY_DISABLED=1

# 3. Compilation Next.js (génère .next/standalone grâce à output: "standalone")
RUN pnpm -F @teranga/web build

# ─── Exécution ───────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Copie exclusive de la sortie autonome et des assets statiques
COPY --from=build --chown=node:node /depot/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /depot/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /depot/apps/web/public ./apps/web/public

USER node
EXPOSE 3100

# Contrôle de santé dédié sur la route /api/sante (rapide, sans rendu SSR)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||'3100')+'/api/sante').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
