# syntax=docker/dockerfile:1

# Image de l'API.
#
# À construire depuis la racine du dépôt :
#
#   docker build -f apps/api/Dockerfile -t teranga-api .
#
# Particularité du projet : les paquets de l'atelier (@teranga/contracts,
# @teranga/fixtures) sont publiés en TypeScript brut, sans étape de
# construction. Nest compile son propre code en JavaScript, mais `require`
# tombe ensuite sur des .ts que Node ne sait pas lire — d'où tsx au démarrage,
# comme le fait déjà le script `start`. Le jour où ces paquets émettront du
# JavaScript, tsx disparaîtra d'ici.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /depot

# ─── Dépendances ─────────────────────────────────────────────────────────────
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
RUN pnpm -F @teranga/api exec nest build
# `pnpm deploy` rassemble l'API et ses dépendances réelles dans un dossier
# autonome : plus de liens vers le dépôt, plus de paquets de développement.
RUN pnpm deploy --filter=@teranga/api --prod /sortie

# ─── Exécution ───────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
# 3000 est pris par Dokploy, 443 par son Traefik, 3100 par le site.
ENV PORT=3101
WORKDIR /app
COPY --from=build --chown=node:node /sortie ./

USER node
EXPOSE 3101

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/sante').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--import", "tsx", "dist/main.js"]
