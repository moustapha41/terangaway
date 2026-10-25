# Module « demandes »

Le cycle commun aux deux services. Logement et transport suivent les **mêmes sept statuts** ;
seuls les délais changent.

```
          ┌──────────┐
          │ Envoyée  │ ──── partenaire, ou support en son nom ────┐
          └────┬─────┘                                            │
               │                                                  ▼
       ┌───────┴────────┬──────────────┐                    ┌──────────┐
       ▼                ▼              ▼                    │ Refusée  │
 ┌──────────┐    ┌──────────┐   ┌──────────┐                └──────────┘
 │ Acceptée │    │ Expirée  │   │ Annulée  │
 └────┬─────┘    └──────────┘   └──────────┘
      │ le visiteur confirme
      ▼
┌───────────┐  date de fin   ┌──────────┐
│ Confirmée │ ─────────────→ │ Terminée │
└───────────┘   automatique  └──────────┘
```

## Délais (PRD §10)

| Service | Relance du support | Expiration | Délai du visiteur |
|---|---|---|---|
| Logement | 1 h en journée | 6 h | 12 h |
| Trajet avec chauffeur | 30 min | 3 h, ou 1 h avant la prise en charge | 3 h |
| Location de voiture | 1 h | 6 h | 12 h |
| Taxi réservé | 10 min | 30 min | 15 min |

Entre 22 h et 7 h, les délais du logement et de la location sont suspendus et reprennent à 7 h.

## Règles portées par ce module

- Le prix est **figé à l'envoi** ; le partenaire ne peut pas le modifier (sauf « sur devis »).
- `Confirmée` bloque les dates de l'offre, qui disparaît des recherches (LOG-23).
- `Acceptée` retient l'offre pendant le délai de confirmation, puis la libère (LOG-24).

  > **État réel.** Seule la première est implémentée, pour les **logements** et les
  > **locations** : une offre ne se confirme qu'une fois sur des dates qui se recouvrent
  > (`occupation.ts`, voir plus bas). La seconde (LOG-24, « Acceptée retient l'offre ») ne
  > l'est pas : il n'existe aucun calendrier (`offres/disponibilites/` ne contient qu'un
  > `.gitkeep`), et plusieurs demandes peuvent être acceptées pour les mêmes dates. Taxis,
  > trajets et services ne sont pas concernés.
- Quand un **acompte** a été demandé (dossier ouvert à l'acceptation), `Acceptée → Confirmée`
  est refusée (`ACOMPTE_NON_PAYE`) tant que l'acompte n'est pas **payé et vérifié** par
  l'équipe. Le paiement ne confirme jamais rien à la place du visiteur : c'est lui qui confirme.
- À l'expiration ou au refus, jusqu'à **trois offres équivalentes** sont proposées au visiteur.
- Les coordonnées ne sont échangées qu'au passage en `Confirmée` — vérifié côté serveur,
  jamais seulement masqué à l'affichage.
- Trois annulations tardives ou trois demandes sans réponse en 7 jours suspendent le partenaire.

## Le veilleur (`veilleur.service.ts`)

Les délais ci-dessus ne valaient rien tant que personne ne les prononçait : une
demande sans réponse restait « envoyée » indéfiniment, et le tableau de bord la
comptait « en retard » pour toujours. Un passage toutes les cinq minutes s'en
charge, dans cet ordre :

1. **Expiration.** `envoyée` ou `acceptée` dont l'échéance est passée → `expirée`,
   par l'acteur `systeme`, via la table des transitions. Le passage s'écrit dans
   la frise ; aucune demande ne change de statut en dehors de la machine.
2. **Relance.** Les demandes encore `envoyée` que personne n'a touchées passé
   leur délai de relance — dix minutes pour un taxi, une heure pour un logement —
   font **un** e-mail récapitulatif à l'équipe. `relanceeLe` garantit qu'une
   demande n'est signalée qu'une fois : une alerte répétée se filtre, et une
   alerte filtrée ne prévient plus personne.

Il ne décide de rien d'autre : il n'accepte pas, ne refuse pas, n'annule pas.

Une seule instance de l'API est supposée. À deux, les deux veilleraient en
parallèle et enverraient deux relances ; `relanceeLe` offre déjà de quoi poser
le verrou le jour où cela se présentera.

La fenêtre nocturne (22 h – 7 h) du PRD n'est **pas** appliquée : les délais
courent la nuit comme le jour.

## Écarts connus

Ce que le code applique diffère de ce qui est écrit, sur quelques points. Aucun n'est
corrigé tant que sa règle n'est pas tranchée ; `delais-ecarts.test.ts` fige l'état actuel.
Le détail est en tête de `machine-a-etats/delais.ts`. En résumé :

- **Taxi** : confirmation du visiteur déclarée à 15 min, appliquée 3 h. L'appliquer sans
  prévenir le visiteur à l'acceptation ferait expirer presque toutes les demandes.
- **Service** : 12 h déclarées pour la confirmation (hors PRD), 3 h appliquées ; une demande
  de service est créée sans échéance de réponse.
- **Logement** : expiration de la réponse à 2 h dans le code, 6 h dans le tableau ci-dessus.
- **Jeton du partenaire** : 2 h pour tous les genres, quelle que soit la fenêtre de réponse.
- **Disponibilité** : la confirmation est gardée pour les logements et les locations (voir plus bas),
  mais une demande acceptée ne retient pas l'offre. Pendant les 12 h de confirmation d'une
  location, le véhicule n'est donc ni retenu ni confirmé : c'est le premier à confirmer qui gagne.

## Double réservation : la garde de confirmation

**Règle.** Au passage `Acceptée → Confirmée`, le dépôt (`DepotDemandesPrisma.enregistrer`)
fait, dans **la même transaction** : (1) un verrou transactionnel par offre
(`pg_advisory_xact_lock`), (2) la recherche d'une *autre* demande `confirmee` de la même offre
dont les dates se recouvrent, (3) l'écriture. S'il y a conflit : 409 `OFFRE_DEJA_CONFIRMEE`,
la demande reste « acceptée ». Deux offres différentes ne s'attendent pas.

- **Logement** : séjours semi-ouverts `[arrivée, départ)`. Deux séjours adjacents cohabitent ;
  une demande sans nuit compte une nuit, comme son prix.
- **Location** : une réservation par véhicule et par jour calendaire (un seul instant est stocké).
- **Indépendante de l'acompte** : elle s'applique aussi quand `ACOMPTE_ACTIF=false`.
- Seules les demandes `confirmee` occupent une offre ; acceptée, refusée, expirée ou annulée non.
- Un contrôle rapide, sans verrou, précède (`exigerOffreLibre`) pour dire « offre déjà confirmée »
  avant « payez d'abord » ; seule la garde sous verrou fait foi.
- Le **dépôt en mémoire** (`DepotDemandesFixtures`, mode démonstration) n'applique pas cette garde.

**Instructions de paiement.** À l'acceptation comme à l'ouverture manuelle, un dossier d'acompte
*nouveau* n'est pas ouvert, et aucune instruction n'est envoyée, quand une réservation confirmée
occupe déjà l'offre (`offre_deja_confirmee`, visible dans la fiche d'équipe). Un dossier déjà
ouvert n'est pas défait. Ce contrôle évite d'encaisser pour rien ; il ne remplace pas la garde.

**Le client qui perd la course** après avoir payé : son paiement reste enregistré, sa demande
reste « acceptée », rien n'est remboursé ni confirmé d'office ; la vue d'équipe propose la
décision de remboursement. Si l'offre se libère, il confirme lui-même.

**Limites et décisions restantes.**
- *Retenir l'offre dès l'acceptation* (LOG-24) : non implémenté. Le premier à confirmer gagne.
- *Taxis, trajets, services* : hors garde. Un trajet confirmé ne bloque pas une location le même jour.
- *Dates illisibles* : ne concluent jamais à un conflit (on ne refuse pas sur une donnée illisible).
- *Indisponibilités déclarées par le partenaire* ou réservations hors plateforme : non prises en compte.
- Aucun index sur `offreId` : la recherche passe par l'index de `statut` ; un index
  `(offreId, statut)` serait un plus à volume élevé (migration à part).
