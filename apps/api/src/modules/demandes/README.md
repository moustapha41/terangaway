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
