# Teranga Way

Logements et transports vérifiés au Sénégal, pour les Jeux Olympiques de la Jeunesse
du 31 octobre au 13 novembre 2026.

- **V1** : logement, transport privé (trajet avec chauffeur, location avec chauffeur,
  taxi réservé) et l'espace où les prestataires déposent leurs produits.
- **Pas de passerelle de paiement** : aucune carte bancaire, aucun paiement en ligne. Un acompte éventuel,
  demandé par Teranga Way après acceptation d'une demande éligible (logement, location avec chauffeur), se règle
  par virement ou Mobile Money et n'est compté qu'après vérification manuelle de l'équipe. Le reste se règle
  selon les indications de la demande.
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
2. Aucun paiement à l'envoi d'une demande, aucune carte bancaire. Un acompte n'est demandé que par Teranga Way, avec
   ses propres coordonnées, et jamais par un partenaire. Il n'est compté qu'après vérification manuelle de la
   réception, et ne confirme pas à lui seul une réservation.
3. Les coordonnées du prestataire n'apparaissent **qu'après** confirmation de la demande.
4. Une offre est publiée par une personne différente de celle qui l'a saisie.
5. Les pièces justificatives restent hors de la plateforme ; la fiche ne porte que « vérifié le… ».
