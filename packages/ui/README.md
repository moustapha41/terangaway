# @teranga/ui

Les composants partagés par l'application visiteur et l'espace prestataire.
Chaque composant est montré dans **tous ses états** sur `/design` avant d'être
utilisé dans un écran (dossier de conception §C.3).

## Ce que le paquet garantit

Ces règles sont imposées par les composants, pas rappelées dans une revue :

- **Une icône d'action va toujours avec un mot** (§A.6), sauf retour, fermeture et
  recherche. Les icônes sont nommées en français dans `src/icones/index.tsx` : changer
  de bibliothèque ne touche que ce fichier.
- **Une couleur ne porte jamais seule l'information** (§A.4, §C.6) : `BadgeStatut`
  affiche une icône et un mot, et les libellés viennent de `tokens.json`.
- **L'erreur d'un champ est écrite sous le champ** (§C.6), pas seulement signalée
  en rouge.
- **Aucune largeur de bouton n'est fixe** (§C.5) : le libellé peut passer sur deux
  lignes sans être tronqué, ce que l'espagnol impose souvent.
- **Les zones cliquables font au moins 44 px** (`--size-touch`).
- **« En cours » n'est pas « désactivé »** : un bouton en attente garde sa couleur.

## Fait

Bouton (4 variantes × 4 états) · Lien · Champ · Squelette · Onglets · PuceFiltre ·
Compteur · BadgeVerifie · BadgeStatut (7 statuts) · Bandeau (5 variantes) · Carte.

## Reste à faire

Les huit composants qui dépendent d'un type métier, donc de `@teranga/contracts` :
sélecteur de dates, sélecteur de lieu, champ de code, carte logement, carte véhicule,
carte de demande, frise de statut, galerie. Ils arrivent avec l'écran qui les emploie.

## Règles de travail

- Aucune couleur, taille ni marge en dur : tout passe par les jetons.
- `"use client"` seulement sur ce qui est interactif.
- Un composant ne connaît pas le routeur ni les traductions ; `apps/web` enveloppe.
