# Annonce — parcours de la plateforme

Trois formats, même parcours, 30 s chacun, H.264.

| Fichier | Format | Définition | Poids | Pour |
|---|---|---|---|---|
| `terangaway-annonce-16x9.mp4` | 16:9 | 1280 × 720 | 9,4 Mo | Site, YouTube, présentation |
| `terangaway-annonce-9x16.mp4` | 9:16 | 1080 × 1920 | 11 Mo | Stories, Reels, TikTok |
| `terangaway-annonce-1x1.mp4` | 1:1 | 1080 × 1080 | 7,6 Mo | Fil Instagram, Facebook |

Chaque vidéo a son image d'attente, `*-poster.png`, pour `<video poster>`.

## Ce qu'on voit

De l'accueil jusqu'à l'envoi de la demande, sur **la plateforme réelle** :
l'accueil, les logements vérifiés, la fiche, le formulaire rempli, la
confirmation. Puis le carton de fin.

Pas de sous-titres. Le logo officiel ouvre et ferme le film.

## Paysage et portrait ne montrent pas la même chose

Le 16:9 filme la **version bureau** du site. Les deux formats verticaux filment
la **version mobile** — c'est celle qu'on regarde sur un téléphone, et recadrer
une capture bureau dans un 9:16 n'aurait montré qu'une colonne vide.

Les barres qui collent au bas de l'écran du mobile — la navigation, et sur une
fiche la barre « Demander ce logement » qui la remplace (§B.6 : un seul élément
fixe) — sont posées sur le cadre, pas sur la page qui défile. Une capture pleine
hauteur les aurait collées tout en bas de l'image, ce qui est faux.

Les positions des boutons cliqués sont **mesurées dans le navigateur**, bureau et
mobile séparément : le curseur tombe réellement sur « Rechercher », sur la carte
« Villa avec piscine, Ngor », sur « Demander ce logement » et sur « Continuer ».

## Refabriquer

1. Lancer la plateforme (`pnpm dev`), puis copier `source/capture-ecrans.html`,
   `source/mesurer-boutons.html` dans `apps/web/public/`.
   **`?l=` n'est pas optionnel pour les formats verticaux** : sans lui la page
   est rendue en 1280 et le film vertical montre la mise en page bureau tassée
   sur un côté. C'est arrivé une fois, parce qu'une copie archivée de cette page
   ne connaissait pas encore ce paramètre.

   `capture-ecrans.html` accepte `?l=` (largeur), `?h=` (hauteur),
   `?remplir=1` (remplit le formulaire après l'hydratation de React, sans quoi
   il réinitialise les champs contrôlés) et `?sansFixe=1` (retire les barres
   fixes du corps de page).
2. Recapturer `source/ecrans/` en 1280 de large, `source/ecrans-mobile/` en
   540 à densité 2 avec `sansFixe=1`, plus les bandes `fixe-*.png` depuis un
   rendu à taille d'écran.
3. Rendre et encoder :

       seq 0 749 | xargs -P 6 -I{} ./source/capturer.sh {} 25            # 16:9
       seq 0 749 | xargs -P 6 -I{} ./source/capturer-vertical.sh {} 25 9x16
       seq 0 749 | xargs -P 6 -I{} ./source/capturer-vertical.sh {} 25 1x1

       ffmpeg -framerate 25 -i images-16x9/%04d.png -c:v libx264 -preset slow \
              -crf 19 -pix_fmt yuv420p -movflags +faststart sortie.mp4

`source/film.html?t=18.5` et `source/film-vertical.html?format=9x16&t=18.5`
figent une image ; sans `t`, le film tourne en boucle dans le navigateur.

## À trancher avant publication

- **La marque olympique.** Le visuel d'accueil porte le logo DAKAR 2026 ; il
  apparaît donc dans les trois films. C'est une marque protégée : sa diffusion
  demande l'accord écrit du comité d'organisation.
- **Le nom de domaine.** Le carton de fin annonce `terangaway.sn`.
