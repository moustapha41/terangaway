# @teranga/api

API REST de Teranga Way — NestJS, documentée en OpenAPI (ADR 0001).

```bash
cp .env.example .env
pnpm -F @teranga/api dev        # http://localhost:3001
                                # documentation sur /documentation
```

## Comment on se partage le travail

| Colonne | Modules |
|---|---|
| **Lecture** | `offres`, `recherche`, `lieux`, `sante` |
| **Écriture** | `comptes`, `demandes`, `reponses`, `visiteurs` |

Quatre règles pour ne pas se marcher dessus :

1. **Un fichier a un seul propriétaire.** `app.module.ts` déclare déjà les seize
   modules : il n'a plus à être rouvert. On remplit son module, pas la racine.
2. **Ce qui est partagé passe par `@teranga/contracts`**, et un changement de
   contrat se signale avant d'être fait.
3. **OpenAPI est le contrat entre nous**, pas la conversation. Une route qui
   change met son `@Api…` à jour dans le même commit.
4. **Le site ne bascule qu'une fois un module fini**, domaine par domaine.

## Les données sont encore mockées, et ça ne coûtera rien

Chaque domaine déclare un **port** (`*.depot.ts`) ; l'implémentation actuelle lit
`@teranga/fixtures` (`*.fixtures.ts`). Le jour de Postgres, on change une ligne
dans le module :

```ts
{ provide: DEPOT_LOGEMENTS, useClass: DepotLogementsPrisma }
```

`@teranga/fixtures` ne s'importe **que** dans un `*.fixtures.ts`.
`pnpm -F @teranga/api verifier:depots` refuse tout le reste, et tourne dans
`pnpm verifier`. Voir `src/commun/depots/README.md`, et
`src/modules/offres/logements/` comme exemple complet.

## Les réponses ont une seule forme

Un succès est enveloppé dans `donnees`, pour qu'ajouter un jour une pagination
ou un total ne change pas la forme de ce qui existe :

```json
{ "donnees": { "id": "d-002", "statut": "acceptee" } }
```

## Les erreurs ont une seule forme

```json
{ "erreur": { "code": "LOGEMENT_INTROUVABLE", "message": "Logement introuvable." } }
```

Une erreur de validation ajoute `details`, la liste des champs fautifs — sans
elle, le site reçoit « requête invalide » sans savoir lequel.

Le site décide sur le **code**, jamais sur le texte. Un code ajouté dans
`src/commun/erreurs.ts` doit apparaître dans l'OpenAPI de la route qui l'émet.

## Ce qu'on ne fait pas encore

Prisma et Postgres, PostGIS, l'envoi réel de SMS, le back-office.

Deux règles produit que le code doit tenir, et qui ne se négocient pas :

- **Aucun paiement en ligne**, à aucun moment. Le paiement a lieu sur place.
- **L'adresse exacte et les téléphones ne sortent pas de l'API avant
  confirmation** (§D.4). Les contrats le garantissent déjà : `Logement` et
  `CoordonneesLogement` sont deux types distincts. Ne les réunissez pas.
