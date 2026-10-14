# ADR 0001 — Pile technique

- **Statut** : accepté
- **Date** : 2026-10-11

## Contexte

Le cahier des charges §10 recommande une pile mais laisse l'équipe la remplacer par ce
qu'elle maîtrise le mieux (§16). Le délai est court et le gel du code intervient tôt.

## Décision

| Composant | Choix |
|---|---|
| Application web | Next.js (React, TypeScript), PWA avec service worker |
| API | NestJS, REST documentée en OpenAPI |
| Base de données | PostgreSQL avec PostGIS |
| **ORM** | **Prisma** |
| Cache, files, sessions | Redis |
| Fichiers | Stockage objet compatible S3 |
| Carte | MapLibre, tuiles OpenStreetMap |
| Stores | Trusted Web Activity (Android), Capacitor (iOS) |

## Conséquence à tenir : Prisma et PostGIS

Prisma ne couvre pas les types géographiques. Deux conséquences structurelles :

1. La colonne de position est déclarée en `Unsupported("geography(Point, 4326)")` dans le
   schéma Prisma — lisible par Prisma, jamais manipulée par lui.
2. Toute requête par distance (tri et filtre par distance à un site de compétition, « autour
   de moi ») passe par `$queryRaw` et vit dans `apps/api/src/base-de-donnees/sql/`,
   pas dans les services. Les extensions et index GiST sont créés par migration SQL.

Cela ne concerne que `LOG-07`, `LOG-08` et `LOG-16`, tous classés « si possible » ou
« important » : la V1 peut ouvrir sans eux.
