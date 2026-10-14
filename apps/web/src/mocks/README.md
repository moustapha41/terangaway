# Données simulées

Le frontend avance sans attendre l'API. Tant que `NEXT_PUBLIC_API_MOCK=true`, le client
d'API de `src/lib/api/` est intercepté et répond depuis ce dossier.

```
mocks/
├── handlers/    une route simulée par module d'API (offres, demandes, comptes…)
└── fixtures/    les données : logements, véhicules, demandes dans leurs 7 statuts,
                 partenaires, lieux, zones et axes tarifaires
```

## Règles

- Les fixtures sont écrites **au format des contrats** de `@teranga/contracts`. Le jour où l'API
  arrive, on bascule l'interrupteur : rien d'autre ne change.
- Chaque écran clé a de quoi afficher ses **cinq états** : chargement, vide, erreur,
  hors connexion, succès (dossier de conception §B.7). Une fixture vide et une fixture
  en erreur par ressource.
- Les textes des fixtures existent en `fr`, `en` et `es` : c'est l'espagnol, le plus long,
  qui révèle les débordements à 360 px.
- Aucune donnée réelle : ni numéro de téléphone, ni adresse, ni photo de partenaire (§12).
