# Proposition de migration — traçabilité des coordonnées

**Statut : proposée, relue, non appliquée.** Aucun fichier n'a été créé sous `apps/api/prisma/migrations/`, `schema.prisma` n'a pas été modifié, et la base n'a pas été touchée. À créer et appliquer seulement après autorisation explicite.

## Objet

Enregistrer qui a saisi les coordonnées d'une réservation, qui les a vérifiées, et quand — pour appliquer en base les décisions produit :

- saisie et correction seulement à `acceptee` ou `confirmee` (règle applicative, voir plus bas) ;
- vérification par une personne différente de celle qui a saisi (quatre yeux) ;
- visiteur servi seulement à `confirmee` ou `terminee`, **et** coordonnées vérifiées ;
- toute nouvelle saisie annule la vérification ;
- effacer les coordonnées (annulation, expiration, refus) remet leur traçabilité à zéro.

Le contenu reste dans `Demand.coordonnees` (`JSONB`, migration initiale). Quatre colonnes s'y ajoutent.

## `schema.prisma`

```prisma
model Account {
  // … champs et relations existants, dont evenementsAcompte
  coordonneesSaisies   Demand[] @relation("CoordonneesSaisiesPar")
  coordonneesVerifiees Demand[] @relation("CoordonneesVerifieesPar")
}

model Demand {
  // … champs existants, dont `coordonnees Json?`
  /// Qui a saisi les coordonnées actuelles, et quand. La date sert de version
  /// à la vérification.
  coordonneesSaisiesLe      DateTime?
  coordonneesSaisiesParId   String?
  coordonneesSaisiesPar     Account?  @relation("CoordonneesSaisiesPar", fields: [coordonneesSaisiesParId], references: [id], onDelete: Restrict)
  /// Qui les a vérifiées — jamais la personne qui les a saisies.
  coordonneesVerifieesLe    DateTime?
  coordonneesVerifieesParId String?
  coordonneesVerifieesPar   Account?  @relation("CoordonneesVerifieesPar", fields: [coordonneesVerifieesParId], references: [id], onDelete: Restrict)
}
```

Relations nommées obligatoires : `Demand` porte déjà deux relations vers `Account` (`DemandesVisiteur`, `DemandesPrestataire`).

## SQL

La première partie est **exactement** ce que Prisma génère pour le schéma ci-dessus — vérifié hors ligne, sans base, par `prisma migrate diff --from-schema-datamodel` (schéma actuel) `--to-schema-datamodel` (copie modifiée). Les contraintes `CHECK`, que Prisma ne sait pas déclarer, s'ajoutent à la main, comme dans `20261021120000_acomptes_persistance`.

```sql
-- Traçabilité des coordonnées : qui les a saisies, qui les a vérifiées.
-- Migration additive : colonnes nullables, aucun remplissage.

-- AlterTable (généré par Prisma)
ALTER TABLE "demands" ADD COLUMN     "coordonneesSaisiesLe" TIMESTAMP(3),
ADD COLUMN     "coordonneesSaisiesParId" TEXT,
ADD COLUMN     "coordonneesVerifieesLe" TIMESTAMP(3),
ADD COLUMN     "coordonneesVerifieesParId" TEXT;

-- AddForeignKey (généré par Prisma)
ALTER TABLE "demands" ADD CONSTRAINT "demands_coordonneesSaisiesParId_fkey" FOREIGN KEY ("coordonneesSaisiesParId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (généré par Prisma)
ALTER TABLE "demands" ADD CONSTRAINT "demands_coordonneesVerifieesParId_fkey" FOREIGN KEY ("coordonneesVerifieesParId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contraintes de cohérence (ajoutées à la main).
ALTER TABLE "demands"
  -- 1. Une saisie est toujours datée et attribuée.
  ADD CONSTRAINT "demands_coordonnees_saisie_signee_check"
    CHECK (("coordonneesSaisiesLe" IS NULL) = ("coordonneesSaisiesParId" IS NULL)),
  -- 2. Une vérification aussi.
  ADD CONSTRAINT "demands_coordonnees_verification_signee_check"
    CHECK (("coordonneesVerifieesLe" IS NULL) = ("coordonneesVerifieesParId" IS NULL)),
  -- 3. On ne vérifie ni ce qui n'existe pas, ni ce dont on ignore l'auteur.
  ADD CONSTRAINT "demands_coordonnees_verification_sur_saisie_check"
    CHECK ("coordonneesVerifieesLe" IS NULL
           OR ("coordonnees" IS NOT NULL AND "coordonneesSaisiesLe" IS NOT NULL)),
  -- 4. Quatre yeux. Écrite pour tenir seule : un `<>` contre NULL vaut NULL,
  --    et un CHECK à NULL passe ; on exige donc aussi l'auteur de la saisie.
  ADD CONSTRAINT "demands_coordonnees_quatre_yeux_check"
    CHECK ("coordonneesVerifieesParId" IS NULL
           OR ("coordonneesSaisiesParId" IS NOT NULL
               AND "coordonneesVerifieesParId" <> "coordonneesSaisiesParId")),
  -- 5. Sans coordonnées, aucune trace : l'effacement remet tout à zéro.
  ADD CONSTRAINT "demands_coordonnees_effacement_check"
    CHECK ("coordonnees" IS NOT NULL
           OR ("coordonneesSaisiesLe" IS NULL AND "coordonneesSaisiesParId" IS NULL
               AND "coordonneesVerifieesLe" IS NULL AND "coordonneesVerifieesParId" IS NULL)),
  -- 6. Des coordonnées sont un objet. Un `null` JSON (`'null'::jsonb`) est
  --    « IS NOT NULL » en SQL : sans cette règle, il passerait pour des
  --    coordonnées présentes, vérifiables.
  ADD CONSTRAINT "demands_coordonnees_objet_check"
    CHECK ("coordonnees" IS NULL OR jsonb_typeof("coordonnees") = 'object'),
  -- 7. On vérifie après avoir saisi, jamais avant.
  ADD CONSTRAINT "demands_coordonnees_chronologie_check"
    CHECK ("coordonneesVerifieesLe" IS NULL
           OR "coordonneesVerifieesLe" >= "coordonneesSaisiesLe");
```

### Revue des contraintes

| # | Ce qu'elle garantit | Réserve |
|---|---|---|
| 1, 2 | Date et auteur vont ensemble, pour la saisie comme pour la vérification | — |
| 3 | Pas de vérification sans coordonnées ni saisie tracée | Les coordonnées héritées (sans trace) ne sont donc **pas vérifiables** : il faut les ressaisir |
| 4 | Vérificateur ≠ saisissant, même si une autre contrainte venait à disparaître | Corrigée par rapport à la première version, qui reposait sur la 3 pour le cas `NULL` |
| 5 | L'effacement des coordonnées efface la traçabilité | Impose l'ordre de déploiement ci-dessous |
| 6 | Pas de `null` JSON pris pour des coordonnées | **Nouvelle.** Vérifier l'existant avant (requête ci-dessous) |
| 7 | La vérification suit la saisie | **Nouvelle.** Dates posées par le même serveur : pas de décalage d'horloge entre elles |

Ce que la base **ne** vérifie **pas**, volontairement :

- **Le statut de la demande.** « Saisie seulement à `acceptee` ou `confirmee` » est une règle sur une *action*, pas sur un état : une demande `terminee` garde légitimement des coordonnées saisies quand elle était confirmée. Elle reste applicative (`STATUTS_SAISIE_COORDONNEES`), protégée par l'écriture conditionnelle sur le statut lu.
- **« Demande morte ⇒ pas de coordonnées ».** Ce serait un bon invariant (`statut NOT IN ('annulee','expiree','refusee') OR coordonnees IS NULL`), mais il **échouerait** aujourd'hui : 3 demandes `annulee` portent encore des coordonnées en base locale. À n'ajouter qu'après le nettoyage historique (`docs/05-exploitation/runbooks/nettoyage-coordonnees-historiques.md`), qui n'est pas autorisé à ce stade.
- **La forme interne du JSON** (champs logement ou véhicule) : validée par l'API (`validerCoordonnees`), trop changeante pour un `CHECK`.

### Avant d'appliquer — contrôles en lecture seule

```sql
BEGIN TRANSACTION READ ONLY;
-- Contrainte 6 : doit rendre 0, sinon la migration échouera.
SELECT count(*) FROM demands
WHERE coordonnees IS NOT NULL AND jsonb_typeof(coordonnees) <> 'object';
ROLLBACK;
```

Les contraintes 1 à 5 et 7 portent sur des colonnes neuves, toutes `NULL` : l'existant les satisfait par construction.

## Concurrence

Les écritures du futur `DepotCoordonneesPrisma` sont conditionnelles, comme `enregistrer` pour les transitions :

- `saisir` : `updateMany({ where: { id, statut: statutLu }, data: { coordonnees, coordonneesSaisiesLe, coordonneesSaisiesParId, coordonneesVerifieesLe: null, coordonneesVerifieesParId: null } })` — une seule écriture pose la saisie **et** annule la vérification ; `count === 0` ⇒ `COORDONNEES_CONFLIT`.
- `verifier` : `updateMany({ where: { id, statut: statutLu, coordonneesSaisiesLe: saisieLe, coordonneesVerifieesLe: null, coordonneesSaisiesParId: { not: parId }, coordonnees: { not: Prisma.DbNull } }, … })` — vérifie exactement la saisie relue ; une ressaisie, une autre vérification ou une transition intercalée la font échouer en conflit. `{ not: parId }` exclut aussi un `coordonneesSaisiesParId` nul (sémantique SQL de `NULL`), et la contrainte 4 le refuserait de toute façon.
- Transitions de demande et saisie se croisent sans s'écraser : chacune conditionne son écriture au statut qu'elle a lu.

## Comptes : suppression et anonymisation

Constat dans le code actuel :

- **Aucune suppression ni anonymisation de compte n'existe.** Pas de route `DELETE` dans l'API, aucun `account.delete`. L'écran « Utilisateurs » du backoffice travaille en mémoire du navigateur, sans appel à l'API. Retirer un administrateur se fait par `db:seed`, qui le **rétrograde** en visiteur (`role: "VISITEUR"`) sans le supprimer.
- **Les références historiques sont déjà protégées par `RESTRICT`** : `demands.visiteurId` et `deposit_payment_events.acteurId`. Seules les données sans valeur d'historique suivent le compte en `CASCADE` (sessions, codes, jetons de réponse) ; `demands.prestataireId` passe à `NULL`.

Conclusion : `ON DELETE RESTRICT` est **compatible** avec le comportement existant — un compte qui a une demande ne se supprime déjà pas — et c'est la seule option cohérente avec les contraintes 1 et 2 : un `SET NULL` laisserait une date sans auteur et ferait échouer la suppression sur la contrainte, en plus d'effacer la preuve des quatre yeux.

**Recommandation** : garder `RESTRICT`, et le jour où un droit à l'effacement doit être honoré, **anonymiser le compte en place** (même `id`, champs personnels — `email`, `telephone`, `nom`, `motDePasseHash` — remplacés ou vidés, sessions révoquées) plutôt que le supprimer. Les traces restent attribuées à un identifiant qui ne désigne plus personne.

**En attente — décision juridique et produit** (`docs/06-conformite/` est vide) : durée de conservation des traces de saisie et de vérification ; base légale (intérêt légitime, preuve) ; contenu exact de l'anonymisation ; qui peut la déclencher. Aucun autre système n'a été modifié.

## Impacts attendus

- **Verrous et durée.** Ajouter des colonnes nullables sans défaut ne réécrit pas la table sous PostgreSQL 16. Les `CHECK` et les clés étrangères parcourent `demands` une fois pour valider l'existant ; la table est petite.
- **Index.** Aucun ajouté : les clés étrangères ne servent qu'au contrôle `RESTRICT` à la suppression d'un compte, opération qui n'existe pas. À reconsidérer si l'anonymisation ou une recherche par auteur apparaît.
- **Données existantes.** Aucune ligne modifiée. Les coordonnées déjà présentes (87 lignes `confirmee`/`terminee` en local, toutes porteuses des anciennes valeurs fictives) restent non vérifiées : invisibles au visiteur et non vérifiables telles quelles (`COORDONNEES_SAISIE_NON_TRACEE`). L'équipe les ressaisit si nécessaire.
- **Visiteur.** Aucun changement visible : la lecture est déjà fermée tant que rien n'est vérifié.

## Ordre de déploiement

1. **Migration d'abord.** Le code actuel reste compatible : il n'écrit aucune des quatre colonnes, l'effacement pose `coordonnees = NULL` avec des traces déjà `NULL` (contrainte 5 satisfaite), et la lecture reste fermée.
2. **Code ensuite**, dans la même livraison ou juste après :
   - `apps/api/src/modules/demandes/demandes.prisma.ts` — dans `demandToDemande`, remplacer `VERIFICATION_PERSISTEE` par `row.coordonneesVerifieesLe !== null` ; dans `enregistrer`, effacer les quatre colonnes avec `coordonnees`. **Indispensable avant toute saisie réelle** : sinon, la contrainte 5 fait échouer l'annulation d'une demande dont les coordonnées sont tracées.
   - `apps/api/src/modules/administration/coordonnees.prisma.ts` — implémenter `DepotCoordonneesPrisma` (lecture jointe aux deux comptes : `id`, `nom`, `email` ; écritures décrites plus haut).
   - Tests PostgreSQL du dépôt Prisma sur le modèle de `coordonnees.test.ts`, plus un test par contrainte `CHECK` — à lancer sur une base **de test dédiée**, pas sur la base de développement partagée.

L'inverse — le code avant la migration — échouerait : Prisma lirait des colonnes absentes.

## Générer la migration sans l'appliquer

Une fois autorisée :

1. Modifier `schema.prisma` comme ci-dessus.
2. Produire le SQL **sans base** : `prisma migrate diff --from-schema-datamodel <copie du schéma actuel> --to-schema-datamodel prisma/schema.prisma --script`. Cette commande compare deux fichiers ; elle ne se connecte à rien.
3. Écrire ce SQL, suivi des contraintes `CHECK`, dans `prisma/migrations/<horodatage>_coordonnees_verification/migration.sql`.
4. Contrôler l'écart sans écrire : `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code` exige une base fantôme — à ne lancer qu'avec une `shadowDatabaseUrl` dédiée, jamais contre la base partagée.
5. Appliquer avec `prisma migrate deploy`, sur autorisation, après les contrôles en lecture seule.

À éviter : `prisma migrate dev` (crée une base fantôme et peut proposer une remise à zéro), `prisma db push` (applique sans migration).

## Marche arrière

À jouer **après** avoir remis le code qui n'utilise pas les colonnes (`VERIFICATION_PERSISTEE = false`, `DepotCoordonneesPrisma` en attente) — sinon l'API lit des colonnes disparues.

```sql
ALTER TABLE "demands"
  DROP CONSTRAINT "demands_coordonnees_chronologie_check",
  DROP CONSTRAINT "demands_coordonnees_objet_check",
  DROP CONSTRAINT "demands_coordonnees_effacement_check",
  DROP CONSTRAINT "demands_coordonnees_quatre_yeux_check",
  DROP CONSTRAINT "demands_coordonnees_verification_sur_saisie_check",
  DROP CONSTRAINT "demands_coordonnees_verification_signee_check",
  DROP CONSTRAINT "demands_coordonnees_saisie_signee_check",
  DROP CONSTRAINT "demands_coordonneesVerifieesParId_fkey",
  DROP CONSTRAINT "demands_coordonneesSaisiesParId_fkey",
  DROP COLUMN "coordonneesVerifieesParId",
  DROP COLUMN "coordonneesVerifieesLe",
  DROP COLUMN "coordonneesSaisiesParId",
  DROP COLUMN "coordonneesSaisiesLe";
```

Limites :

- Elle **ne restaure rien** : elle supprime des colonnes. Toute la traçabilité enregistrée depuis — qui a saisi, qui a vérifié, quand — est **perdue définitivement**.
- Les coordonnées, elles, restent dans `coordonnees` : elles redeviennent non vérifiées, donc invisibles au visiteur. Les demandes déjà vérifiées perdent leur affichage jusqu'à la remigration et la revérification.
- Elle ne rétablit pas les coordonnées effacées par des annulations intervenues entre-temps.
- Il faut ensuite retirer l'entrée correspondante de `_prisma_migrations` (ou créer une migration inverse) pour que `migrate deploy` reste cohérent ; sans cela, Prisma considérera la migration comme appliquée.
