# @teranga/tokens

Les jetons sont les valeurs nommées que le design et le code partagent.
`src/tokens.json` est la source ; les variables CSS, le thème Tailwind et les types
TypeScript en sont **générés**, jamais écrits à la main.

## Règles d'emploi (dossier de conception §A.4)

- Une seule couleur d'action par écran : `color.primary`. Le vert n'est un bouton que pour « Confirmer ».
- Une couleur de statut est toujours accompagnée d'une icône **et** d'un mot.
- Le badge « vérifié » est bleu nuit, jamais vert : il parle de confiance, pas d'un statut.
- `color.accent` décore, n'écrit jamais : contraste 1,8 sur blanc, insuffisant pour du texte.
- Pas de dégradé, pas d'ombre portée : la séparation se fait par les bordures et l'espace.
- Pas de mode sombre dans la V1.

## Comment les jetons arrivent dans le code

`src/tokens.json` est la source. `pnpm -F @teranga/tokens generer` en produit :

- `src/theme.css` — le bloc `@theme static` de Tailwind v4, importé par `globals.css` ;
- `src/index.ts` — `STATUTS`, le type `Statut`, l'ordre de la frise.

`pnpm -F @teranga/tokens verifier` échoue si le disque ne correspond plus au JSON.

### Deux écarts assumés

Les clés du JSON gardent les noms du dossier (`color.text-muted`) pour la traçabilité ;
les variables CSS prennent des noms français (`--color-encre-douce`), comme le reste
du projet. La correspondance est dans `scripts/generer.mjs`.

L'échelle d'espacement **n'est pas émise**. Dans Tailwind v4, `--spacing-*` pilote
l'échelle entière et la casserait. Les sept valeurs du dossier sont déjà celles de
Tailwind :

| Dossier | `space.1` | `space.2` | `space.3` | `space.4` | `space.5` | `space.6` | `space.7` |
|---|---|---|---|---|---|---|---|
| Valeur | 4 px | 8 px | 12 px | 16 px | 24 px | 32 px | 48 px |
| Classe | `1` | `2` | `3` | `4` | `6` | `8` | `12` |
