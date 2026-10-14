# Dépôts

Chaque domaine déclare **un port** — une interface — et au moins une
implémentation. Le module Nest relie les deux :

```ts
@Module({
  providers: [
    ServiceLogements,
    { provide: DEPOT_LOGEMENTS, useClass: DepotLogementsFixtures },
  ],
})
```

Le jour de la bascule, on remplace `DepotLogementsFixtures` par
`DepotLogementsPrisma` dans cette seule ligne.

## Nommage

| Fichier | Rôle |
|---|---|
| `logements.depot.ts` | le port (interface + symbole) |
| `logements.fixtures.ts` | l'implémentation de démonstration |
| `logements.prisma.ts` | l'implémentation base de données, plus tard |

## La règle qui tient l'ensemble

`@teranga/fixtures` ne s'importe que dans un fichier `*.fixtures.ts`.
Un service qui importerait le catalogue directement rendrait la bascule
impossible sans le rouvrir. `pnpm verifier:depots` refuse ce cas.
