# Structure du projet — Teranga Way

Dépôt unique (monorepo pnpm + Turborepo). **Un seul code** sert le site, l'application
installable, l'espace prestataire et le back-office, comme le demande le cahier des charges
(§10 : « une seule application modulaire, pas de microservices »).

```
joj/
├── base/        documents de référence (cahier des charges, PRD V1, dossier de conception, maquettes)
├── docs/        documentation vivante du projet
├── apps/        les trois exécutables : web, admin, api
├── packages/    code partagé : jetons, composants, contrats, traductions
├── infra/       hébergement, conteneurs, supervision, sauvegardes
├── scripts/     outillage d'exploitation
├── tests/       tests de bout en bout, de charge et d'accessibilité
└── .github/     intégration continue
```

## Conventions

| Sujet | Règle |
|---|---|
| Langue du code | Noms **métier en français** (`demandes`, `offres`, `partenaires`) pour rester traçables avec le PRD ; noms **techniques en anglais** (`src`, `build`, `middleware`). |
| Traçabilité | Chaque module porte en tête les identifiants du PRD qu'il couvre (`SOC-01`, `LOG-23`, `TRA-11`, `PAR-12`, `ADM-04`). |
| Nommage des fichiers | `kebab-case` partout, y compris pour les composants React. |
| Une fonction, un module | §10 : « un module par service, un responsable par module, interfaces définies le premier jour ». |
| Seconde vague | Toute fonction hors MVP arrive derrière un interrupteur (`FF_*` dans `.env.example`). |

---

## `apps/web` — Application visiteur et prestataire (Next.js, PWA)

Trois publics dans une seule application, séparés par des groupes de routes.

Deux **layouts racines**, par groupes de routes : c'est le seul moyen de poser
`<html lang>` à la langue réelle de la page. Sans cela un lecteur d'écran lirait
l'espagnol avec une voix française (§C.6).

```
apps/web/src/app/
├── (langue)/[locale]/                  layout racine : <html lang={locale}>
│   ├── (visiteur)/                     16 écrans visiteur
│   │   ├── page.tsx                    écran 1 · Accueil (Logement | Transport)
│   │   ├── logements/
│   │   │   ├── page.tsx                écran 2 · Résultats (filtres, tri, états vide/chargement)
│   │   │   └── [slug]/                 écran 3 · Fiche (galerie, badge vérifié, barre d'action)
│   │   ├── transports/
│   │   │   ├── page.tsx                les trois besoins (TRA-01)
│   │   │   ├── trajet/                 écran 7 · formulaire puis véhicules (TRA-10..15)
│   │   │   ├── location/               avec chauffeur (TRA-20..24)
│   │   │   ├── taxi/                   taxi réservé (TRA-30..33)
│   │   │   └── [slug]/                 fiche véhicule
│   │   ├── demande/[offreId]/          écran 4 · récapitulatif, message, code OTP
│   │   ├── mes-demandes/               écran 5 · liste · [id] écran 6 · détail et frise
│   │   ├── compte/ · aide/ (faq, urgences)
│   └── (prestataire)/prestataire/      ⟵ voir section dédiée ci-dessous
│   └── (public)/                       à-propos, mentions légales, CGU, charte
├── (hors-langue)/                      layout racine : <html lang="fr">
│   ├── reponse/[jeton]/                page partenaire SANS connexion (PAR-11/12)
│   └── design/                         atelier des composants (hors produit)
└── api/                                BFF : santé, revalidation, proxy
```

Hors `app/` :

```
apps/web/src/
├── components/   layout · commun · recherche · visiteur · prestataire · etats
├── features/     logique par domaine : compte, logement, transport, demande, prestataire, assistance
├── lib/          api · i18n · prix (FCFA) · dates · carte · hors-ligne · analytique
├── mocks/        handlers/ · fixtures/ — le frontend avance sans attendre l'API
├── middleware.ts détection de la langue (§B.2) et préfixe d'URL
├── hooks/ · styles/ · types/ · middleware.ts (détection de langue, protection des routes)
└── messages/     fr.json · en.json · es.json
```

---

## La partie prestataire — où le prestataire dépose son produit

**Les deux canaux sont dans la V1.** Le PRD rangeait l'espace avec compte dans ses
non-objectifs ; la décision du 11 octobre l'y ramène. Le lien SMS reste néanmoins :
c'est le repli pour un prestataire qui n'ouvre jamais son compte, et le seul canal pour
un taxi, qui répond en moins de 30 minutes et n'a pas le temps de se connecter.

### Canal 1 — Réponse par jeton, sans compte

```
apps/web/src/app/reponse/[jeton]/      page unique par demande : Accepter · Refuser + motif
apps/api/src/modules/reponses/         jeton long et aléatoire, lié à une seule demande, expirant
```

### Canal 2 — Espace prestataire avec compte

```
apps/web/src/app/[locale]/(prestataire)/prestataire/
├── candidature/              dépôt de candidature, signature de la charte (PAR-05)
├── connexion/                OTP sur le numéro qui reçoit déjà les demandes
├── offres/
│   ├── page.tsx              ses offres, par statut : brouillon · à valider · publiée · suspendue
│   ├── nouvelle/
│   │   ├── logement/         formulaire des 18 champs du PRD §11 (type, capacité, prix, inclus…)
│   │   └── vehicule/         formulaire véhicule (catégorie, places, zones, chauffeur…)
│   ├── import/               modèle tableur, aperçu, lignes en erreur (PAR-01, ADM-03)
│   └── [id]/
│       ├── photos/           téléversement, choix de la photo principale, 5 minimum (LOG-10)
│       ├── disponibilites/   périodes libres, dates bloquées (LOG-30..33)
│       ├── tarifs/           prix par nuit, frais fixes · ou prix par jour et grille
│       └── (statut)          « ce bien n'est plus disponible » en un geste (LOG-32)
├── demandes/                 ses demandes en cours et passées (PAR-14), détail et réponse
├── profil/                   interlocuteur, WhatsApp, zones, moyens de paiement acceptés
└── documents/                dépôt des pièces justificatives
```

**Deux règles de conception qui traversent ce canal**

1. **Rien n'est publié par le prestataire seul.** Une offre déposée naît en `brouillon`,
   passe en `à valider`, et n'est `publiée` que par une seconde personne de l'équipe
   (ADM-04 : « la personne qui valide n'est pas celle qui a saisi »). Le prestataire dépose,
   l'équipe publie.
2. **Les pièces justificatives ne restent pas dans la plateforme.** §11 du cahier des charges :
   elles vont dans un espace chiffré réservé aux validateurs, et la fiche ne porte que la mention
   « vérifié le… par… ». D'où `documents/` côté web mais `partenaires/verification/` côté API,
   et `/pieces-justificatives/` dans le `.gitignore`.

---

## `apps/api` — API modulaire (NestJS)

```
apps/api/src/
├── commun/                 décorateurs · filtres · gardes (rôle + propriétaire) · intercepteurs
│                           (journal d'audit) · pipes · dto · utils
├── config/
├── modules/
│   ├── comptes/            OTP, sessions, rôles, double authentification interne (SOC-03/04)
│   ├── visiteurs/
│   ├── partenaires/        + verification/ : état de la charte, contrôles, mention « vérifié »
│   ├── offres/             catalogue commun aux deux services
│   │   ├── logements/ · vehicules/
│   │   ├── disponibilites/ périodes libres, blocage à la confirmation (LOG-23)
│   │   ├── validation/     brouillon → à valider → publiée, à deux personnes (ADM-04)
│   │   └── import/         modèle tableur, lignes en erreur (ADM-03)
│   ├── tarification/       zones, axes, grille par catégorie, calcul du prix figé (TRA-11, ADM-06)
│   ├── demandes/           + machine-a-etats/ : les 7 statuts et leurs transitions
│   ├── reponses/           jetons de réponse des partenaires
│   ├── recherche/          filtres, tri, distance aux sites (PostGIS)
│   ├── lieux/              lieux connus, zones, sites de compétition
│   ├── notifications/      canaux (sms, email, whatsapp, push) + gabarits en 3 langues
│   ├── televersement/      photos, S3, suppression EXIF, noms régénérés (§11)
│   ├── traduction/ · contenus/
│   ├── assistance/         + signalements/ (SOC-14)
│   ├── administration/     + journal-audit/ · tableau-de-bord/
│   └── sante/
├── taches-planifiees/      relance du support, expiration des demandes,
│                           reconfirmation des offres à 7 jours (LOG-33, ADM-14)
└── base-de-donnees/        migrations · seeds · sql/ (extensions et index PostGIS)
```

Le cycle de la demande est le cœur du produit : il vit dans **un seul** module
(`demandes/machine-a-etats/`) et sert les deux services, parce que logement et transport
suivent les mêmes sept statuts et ne diffèrent que par les délais.

---

## `apps/admin` — Back-office (sous-domaine séparé) · **différé**

Structuré, pas prioritaire : la décision du 11 octobre le place après le frontend visiteur
et prestataire. L'arborescence ci-dessous existe pour que personne n'ait à l'inventer le
jour venu, mais aucun écran n'y est attendu avant la mise en ligne du visiteur.

Pas de maquette sur mesure : bibliothèque d'administration existante, seuls la couleur
principale, le logo et les badges de statut sont repris du design system.

```
apps/admin/src/app/(back-office)/
├── tableau-de-bord/     indicateurs de la §15 : taux d'acceptation, délai de réponse
├── partenaires/         création, charte, vérification, interlocuteur (ADM-01)
├── offres/validation/   file de validation à deux personnes (ADM-04)
├── disponibilites/      blocage et libération en un geste (ADM-05)
├── tarification/        zones · axes (ADM-06)
├── demandes/            file, sans réponse en tête, action au nom du partenaire (ADM-07/08)
├── visiteurs/ · signalements/ · contenus/traductions/ · lieux/
├── utilisateurs/        rôles internes (ADM-11)
└── journal/             journal d'audit (ADM-12)
```

---

## `packages/` — code partagé

| Paquet | Contenu |
|---|---|
| `tokens` | Les jetons du dossier de conception §C.1 : couleurs, espaces, rayons, hauteurs, mouvement. Aucune valeur en dur dans un écran. |
| `ui` | Les 20 composants du design system, chacun dans ses états avant usage. |
| `i18n` | Messages fr / en / es, format des prix en FCFA, format des dates par langue. |
| `contracts` | Schémas Zod et types partagés entre `web`, `admin` et `api` : statuts, codes d'erreur, DTO. |
| `config` | eslint · typescript · tailwind, partagés. |
| `utils` | Fonctions pures sans dépendance au cadre. |

---

## `infra/`, `scripts/`, `tests/`

```
infra/      docker · compose · terraform (modules, environnements) · nginx ·
            supervision (journaux, métriques, alertes) · sauvegardes (chiffrées, horaires)
scripts/    base-de-donnees · catalogue (import, contrôle de qualité des fiches) · qualite
tests/      e2e/parcours (les scénarios A1..A18 du PRD, en 3 langues) ·
            charge (3 000 utilisateurs simultanés) · accessibilite (contraste AA, cibles 44 px)
```

---

## Décisions prises (11 octobre 2026)

| Sujet | Décision | Conséquence sur la structure |
|---|---|---|
| **Nom** | **Teranga Way** | Débloque le logo, le domaine, l'icône d'application et l'expéditeur des SMS. L'ancien nom de travail du dossier de conception est abandonné. |
| **ORM** | **Prisma** | Les requêtes par distance passent en SQL brut dans `apps/api/src/base-de-donnees/sql/`, jamais dans les services. Voir [ADR 0001](./docs/03-technique/adr/0001-pile-technique.md). |
| **Espace prestataire** | **Dans la V1** | `FF_ESPACE_PRESTATAIRE=true`. Le lien SMS par jeton reste en parallèle, comme repli et comme seul canal du taxi. |
| **Back-office** | **Différé** | `apps/admin` reste structuré mais n'est pas construit avant la mise en ligne du visiteur. |

## Ordre de construction

Le frontend d'abord. `apps/web/src/mocks/` sert les écrans au format des contrats de
`@teranga/contracts` tant que `NEXT_PUBLIC_API_MOCK=true` ; l'API vient se brancher derrière
les mêmes contrats, sans retoucher un écran.

```
1. packages/tokens + packages/ui      les 20 composants dans leurs états
2. apps/web (visiteur)                les 7 écrans clés, puis les 9 autres par assemblage
3. apps/web (prestataire)             dépôt des offres, photos, disponibilités, demandes
4. apps/api                           les contrats d'abord, les modules ensuite
5. apps/admin                         quand le visiteur est en ligne
```

Deux choses ne peuvent pas attendre le back-office, puisqu'il est différé : la **validation
à deux personnes** d'une offre (ADM-04) et l'**action au nom du partenaire** (ADM-08).
Tant que `apps/admin` n'existe pas, elles se font à la main, par l'équipe — à décider
qui, et avec quel outil.
