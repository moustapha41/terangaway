# Traduction

Trois langues, écrites en même temps : « aucun écran n'est validé dans une seule
langue » (dossier de conception §A.8).

## Pourquoi pas une bibliothèque

Le registre npm est injoignable depuis cet environnement — `next-intl` n'a pas pu
s'installer. La V1 a besoin de trois choses : l'interpolation, le pluriel et le
préfixe d'URL. `Intl.PluralRules` fait le pluriel correctement dans les trois
langues ; le reste tient en cent cinquante lignes. Les fichiers de `src/messages/`
sont au format qu'une bibliothèque attendrait, la migration reste ouverte.

## Il n'y a pas de baril `index.ts`, volontairement

`messages.ts` importe les trois catalogues. Un composant client qui l'atteindrait,
fût-ce par un `export *`, embarquerait les trois langues dans le navigateur.
Chaque fichier s'importe donc par son nom :

| Besoin | Fichier |
|---|---|
| Traduire côté serveur | `messages.ts` → `traducteurPour(langue)` |
| Traduire côté client | `contexte.tsx` → `useT()` |
| Lien interne | `lien.tsx` → `<Lien href="/logements">` |
| Constantes de langue | `langues.ts` |
| Le moteur, sans catalogue | `traducteur.ts` |

Le layout de `(langue)/[locale]` passe le catalogue **actif** au fournisseur ; le
navigateur ne reçoit que celui-là.

## Vérifier la parité des catalogues

```
pnpm -F @teranga/web i18n:verifier
```

Une clé absente renvoie la clé elle-même plutôt que de casser l'écran. C'est le
script qui attrape l'oubli, pas l'utilisateur.
