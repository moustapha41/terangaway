# Film de démonstration — Teranga Way

`terangaway-demo.mp4` · 30 s · 1280×720 · 25 i/s · H.264 · 1,4 Mo
`terangaway-demo-poster.png` · image d'attente pour `<video poster>`

## Déroulé

| Temps | Plan |
|---|---|
| 0–4 s | La marque se pose : « Logements et transports vérifiés pour les JOJ Dakar 2026 » |
| 4–10 s | La recherche se remplit toute seule : Dakar, les dates, deux voyageurs |
| 10–16 s | Les résultats arrivent en cascade, badge « Vérifié » et prix par nuit |
| 16–22 s | La fiche : total pour sept nuits, puis « Aucun paiement en ligne » |
| 22–27 s | La coche se dessine : « Demande envoyée · réponse sous deux heures » |
| 27–30 s | « Rendez-vous à Dakar » |

## Ce que le film affirme

Tout vient du produit réel : les trois logements, leurs quartiers et leurs prix
sortent de `apps/web/src/mocks/fixtures/logements.ts`, les couleurs de
`packages/tokens`. Le compte « 8 logements vérifiés » est celui du catalogue, pas
un chiffre d'affiche.

Le film ne montre **aucune marque olympique** : le logo DAKAR 2026 est une marque
protégée dont l'usage demande l'accord écrit du comité d'organisation. Seule la
marque Teranga Way apparaît. Aucune personne reconnaissable non plus (§A.7).

## Refabriquer le film

La scène est une page HTML pilotée par un temps explicite : `rendre(t)` place
l'image telle qu'elle doit être à `t` secondes, sans jamais lire l'horloge.

    source/scene.html?t=18.5     fige l'image à 18,5 s
    source/scene.html            joue le film en boucle

C'est ce qui rend la capture reproductible — et c'est aussi, tel quel, une
vitrine qu'on peut poser sur une page web sans vidéo du tout.

    # 750 images, six navigateurs en parallèle (~2 min)
    seq 0 749 | xargs -P 6 -I{} ./source/capturer.sh {} 25

    # encodage
    ffmpeg -framerate 25 -i images/%04d.png -c:v libx264 -preset slow -crf 19 \
           -pix_fmt yuv420p -movflags +faststart terangaway-demo.mp4

Pour changer la durée, ajuster `DUREE` dans `scene.js` et les instants des plans.
