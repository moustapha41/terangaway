# syntax=docker/dockerfile:1

# Image du site visiteurs.
#
# À construire depuis la racine du dépôt, jamais depuis apps/web : le site
# dépend de paquets de l'atelier qui vivent ailleurs dans l'arbre.
#
#   docker build -f apps/web/Dockerfile -t teranga-web .
#
# Debian plutôt qu'Alpine : sharp, qui redimensionne les photos, a des binaires
# tout prêts pour la glibc, et pnpm-workspace.yaml ne retient que linux/x64 en
# glibc. Sur musl il faudrait compiler libvips.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /depot

# ─── Dépendances ─────────────────────────────────────────────────────────────
# Les manifestes seuls d'abord : tant qu'ils ne bougent pas, Docker réutilise
# l'installation, de loin l'étape la plus longue.
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
# NEXT_PUBLIC_* est figé dans le code à la construction, pas lu au démarrage :
# changer d'avis plus tard impose de reconstruire l'image.
ARG NEXT_PUBLIC_API_MOCK=false
ENV NEXT_PUBLIC_API_MOCK=$NEXT_PUBLIC_API_MOCK
ENV NEXT_TELEMETRY_DISABLED=1
# L'API n'a pas à répondre pendant la construction : les pages qui la lisent
# sont rendues à la demande, et les trois sélections décoratives se dégradent.
RUN pnpm -F @teranga/web build

# ─── Exécution ───────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
# 3000 est pris par Dokploy lui-même, 443 par son Traefik.
ENV PORT=3100
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# La sortie autonome porte le serveur et les seules dépendances tracées.
COPY --from=build --chown=node:node /depot/apps/web/.next/standalone ./
# Ces deux-là, Next ne les met jamais dans la sortie autonome.
COPY --from=build --chown=node:node /depot/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /depot/apps/web/public ./apps/web/public
# sharp n'a pas besoin d'être installé à part : Next le trace avec le reste,
# vérifié sur l'arbre produit. C'est lui qui redimensionne les 169 photos du
# catalogue — sans lui, Next les servirait en pleine taille.

USER node
EXPOSE 3100

# Le site doit répondre même API éteinte : c'est tout l'objet des garde-fous.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/fr').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
