# Teranga Way

Logements et transports vérifiés au Sénégal, pour les Jeux Olympiques de la Jeunesse
du 31 octobre au 13 novembre 2026.

- **V1** : logement, transport privé (trajet avec chauffeur, location avec chauffeur,
  taxi réservé) et l'espace où les prestataires déposent leurs produits.
- **Pas de paiement sur la plateforme** : le visiteur paie le prestataire sur place.
- **Trois langues** : français, anglais, espagnol.
- **Un seul code** : application web installable (PWA), empaquetée ensuite pour les stores.

## Démarrer

Le frontend tourne seul, sur les données de `apps/web/src/mocks/` :

```bash
pnpm install
cp .env.example .env          # NEXT_PUBLIC_API_MOCK=true par défaut
pnpm --filter @teranga/web dev
```

Avec l'API, une fois qu'elle existe :

```bash
docker compose -f infra/compose/docker-compose.dev.yml up -d   # postgres+postgis, redis, minio
pnpm db:migrate && pnpm db:seed
pnpm dev
```

| Service | Adresse | État |
|---|---|---|
| Application visiteur et prestataire | http://localhost:3000 | priorité |
| API | http://localhost:3001 (OpenAPI sur `/docs`) | après les contrats |
| Back-office | http://localhost:3002 | différé |

## Repères

- [`STRUCTURE.md`](./STRUCTURE.md) — l'arborescence et ce que contient chaque dossier.
- [`base/`](./base) — cahier des charges, PRD V1, dossier de conception, maquettes.
- [`docs/`](./docs) — documentation vivante : décisions, API, modèle de données, exploitation.

## Règles qui ne se négocient pas

1. Rien n'est affiché au visiteur sans avoir été vérifié par l'équipe.
2. Aucun paiement, aucun acompte, jamais par transfert à distance — rappelé sur chaque écran.
3. Les coordonnées du prestataire n'apparaissent **qu'après** confirmation de la demande.
4. Une offre est publiée par une personne différente de celle qui l'a saisie.
5. Les pièces justificatives restent hors de la plateforme ; la fiche ne porte que « vérifié le… ».
