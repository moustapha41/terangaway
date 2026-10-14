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
