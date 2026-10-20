# Plan du frontend — Teranga Way

Dérivé du Cahier des charges, du Dossier de conception V1 et du PRD V1.
État au 11 octobre 2026 : l'accueil est construit, le reste est à faire.

---

## 1. Ce que le produit doit faire ressentir

Le parcours tient en une phrase du dossier de conception : *je cherche, je compare,
je demande, je suis ma demande, je confirme*. Cinq règles le gouvernent, et chaque
écran ci-dessous est jugé sur elles.

| Règle | Conséquence concrète dans le code |
|---|---|
| Le compte arrive le plus tard possible | Aucune route sous `(visiteur)` n'est protégée sauf `compte/` et `mes-demandes/`. Une demande part sans compte et sans code : les coordonnées saisies suffisent (`features/demande/coordonnees.ts`). Le code OTP ne reste qu'à la connexion et à l'inscription, là où l'on prouve vraiment qui l'on est. |
| Un seul parcours pour les deux services | `features/demande/` est partagé ; seule l'étape de recherche diffère entre logement et transport. |
| Rien n'est perdu | La saisie survit à la création du compte, au retour arrière et à la coupure réseau → brouillon persistant dans `lib/hors-ligne/`. |
| Jamais d'impasse | Tout état vide, refusé ou expiré propose une suite. Aucun cul-de-sac n'est acceptable en revue. |
| Le logement amène au transport | Après confirmation d'un logement, le transfert aéroport est proposé avec dates et adresse pré-remplies. |

Trois interdits absolus, repris du cahier des charges : **jamais de paiement en ligne**,
**jamais de coordonnées avant confirmation**, **jamais d'offre non vérifiée affichée**.

---

## 2. Les fondations à poser avant tout nouvel écran

Quatre chantiers. Ils ne produisent aucun écran visible, et ils conditionnent les seize.

### 2.1 Jetons — une seule source

`packages/tokens/src/tokens.json` existe mais n'est lu par personne ; `globals.css`
contient un `@theme` écrit à la main. Deux vérités qui divergent déjà.

Le JSON devient la source, un script génère le `@theme` Tailwind et les types.

**Conflit à trancher** : le dossier donne `color.primary = #102A43`, la maquette validée
utilise `#001D35`. Même chose pour l'ombre et le dégradé, que le dossier interdit
(§A.4) et que la maquette emploie sur le hero et la carte de recherche.
Proposition : la maquette gagne sur ce qu'elle montre (bleu nuit, ombre de carte,
dégradé du hero, qui restent cantonnés à l'accueil) ; le dossier garde tout ce que
la maquette ne couvre pas (succès, avertissement, danger, teintes, statuts).

### 2.2 `packages/ui` — les 20 composants

L'accueil en a déjà prouvé huit, en valeurs littérales dans `components/`.
Les extraire coûte peu et évite de les réécrire quinze fois.

### 2.3 i18n — trois langues dès maintenant

`middleware.ts` n'existe pas, `messages/` non plus, tous les textes sont en dur.
Le dossier est net : *les trois langues sont écrites en même temps ; aucun écran
n'est validé dans une seule langue*. Chaque maquette se vérifie avec le texte le
plus long des trois, souvent l'espagnol, à 360 px.

### 2.4 Mocks et contrats

`packages/contracts` et `src/mocks` sont vides. Rien ne s'affiche sans données.
Un mock par ressource, décliné dans les cinq états.

---

## 3. Les 20 composants

Chacun est dessiné dans tous ses états **avant** d'être utilisé dans un écran.

### Actions

| Composant | Spécification | États |
|---|---|---|
| Bouton principal | Fond bleu nuit, texte blanc, 48 px, pleine largeur sur téléphone | normal, appuyé, désactivé, en cours |
| Bouton secondaire | Fond blanc, bordure et texte bleu nuit | idem |
| Bouton de confirmation | Fond vert — réservé à « Confirmer », nulle part ailleurs | idem |
| Bouton de danger | Texte rouge sur blanc, bordure rouge | idem |
| Lien | Bleu nuit souligné | normal, appuyé |

### Saisie

| Composant | Spécification | États |
|---|---|---|
| Champ de texte | Libellé au-dessus, 48 px, aide ou erreur en dessous | vide, rempli, actif, erreur, désactivé |
| Sélecteur de dates | Calendrier en feuille basse, dates indisponibles grisées | fermé, ouvert, plage choisie |
| Compteur | Moins / valeur / plus, boutons de 44 px | minimum atteint, maximum atteint |
| Sélecteur de lieu | Liste de lieux connus puis saisie libre | vide, suggestions, choisi |
| Champ de code | Six cases, clavier numérique, collage accepté | vide, erreur, expiré, vérification |
| Puce de filtre | Pastille cliquable, active en bleu nuit | inactive, active |

### Affichage

| Composant | Spécification | États |
|---|---|---|
| Carte logement | Photo 4:3, badge vérifié, titre, quartier, capacité, prix / nuit, prix total | normale, chargement |
| Carte véhicule | Photo 4:3, badge vérifié, modèle, catégorie, places, bagages, prix avec unité | normale, chargement |
| Carte de demande | Vignette, titre, dates, statut, action attendue | un visuel par statut |
| Badge « vérifié » | Coche et mot, bleu nuit sur bleu clair — **jamais vert** | unique |
| Badge de statut | Icône et mot sur fond teinté | les 7 statuts |
| Frise de statut | Étapes verticales horodatées, étape en cours mise en avant | un visuel par statut |
| Galerie | Défilement horizontal, compteur « 2 / 8 », plein écran au toucher | une photo, plusieurs, chargement |
| Bandeau | Icône, texte, action éventuelle | information, succès, avertissement, erreur, hors connexion |
| Feuille basse | Monte du bas, poignée, bouton de fermeture | ouverte, fermée |

**Règle d'icônes** : un seul jeu au trait, 1,5 px, grille 24 × 24 ; une icône d'action
est toujours accompagnée d'un mot, sauf retour, fermeture et recherche.

---

## 4. Navigation

Rien de plus qu'un en-tête et une barre du bas à trois entrées, tant que la V1
n'a que deux services.

- **En-tête** : logo à gauche, langue et profil à droite. Sur les écrans internes,
  le logo laisse place à une flèche de retour et au titre de l'écran.
- **Barre du bas** : Accueil · Mes demandes · Aide. Une pastille signale une demande
  qui attend une action du visiteur.
- **Barre d'action** : sur la fiche et le formulaire de demande, prix et bouton
  principal fixés en bas — elle *remplace* la barre du bas. Un seul élément fixe.
- **Aide** : appel, WhatsApp, questions fréquentes. Seul point d'entrée de
  l'assistance, pas de bouton flottant.

> L'en-tête est aujourd'hui importé dans `page.tsx`. Il remonte dans le layout
> `(visiteur)` au premier écran supplémentaire.

---

## 5. Les écrans visiteur

Les sept premiers sont les écrans clés : haute fidélité, cinq états chacun.
Les neuf autres s'assemblent à partir des mêmes composants.

### Écran 2 · Résultats logement — `logements/`

Rappel de la recherche, modifiable · puces de filtre (type, budget, équipements) ·
nombre de résultats et tri · cartes logement.

N'affiche **que** les offres vérifiées et disponibles ; calcule le prix total pour
la période demandée. Sur tablette deux colonnes, sur ordinateur trois avec les
filtres dans une colonne à gauche.

*Vide* : « Aucun logement pour ces dates » + modifier la recherche, dates voisines,
villes proches, Aide. *Chargement* : squelettes aux formes des cartes.

### Écran 3 · Fiche logement — `logements/[slug]/`

Galerie · titre, quartier, badge vérifié · capacité et équipements · description ·
règles et conditions d'annulation · partenaire · barre d'action avec prix total et
« Demander ce logement ».

L'adresse exacte et les coordonnées sont **masquées**. Le serveur ne doit pas même
les envoyer avant confirmation — critère de fin §D.4.

### Écran 4 · Demande — `demande/[offreId]/`

Récapitulatif (offre, dates, personnes, prix) · heure d'arrivée · message au
partenaire · mention de paiement sur place · « Envoyer la demande » · feuille du
code si le visiteur n'est pas connecté.

Le prix est **figé** à l'envoi. La saisie est conservée à travers la création du
compte. Si le logement est pris pendant la saisie : message à l'envoi, puis trois
logements proches disponibles.

### Écran 5 · Mes demandes — `mes-demandes/`

Les demandes qui attendent une action du visiteur en tête, puis les autres de la
plus récente à la plus ancienne. État vide avec une suite proposée.

### Écran 6 · Détail d'une demande — `mes-demandes/[id]/`

Badge de statut et phrase d'explication · frise horodatée · récapitulatif et prix ·
**après confirmation seulement** : adresse, contact, consignes · boutons
« Confirmer » et « Annuler » selon le statut.

C'est l'écran de l'étape 7 aussi : le jour venu, le visiteur y retrouve tout, avec
le rappel que le paiement se fait sur place.

### Écran 7 · Formulaire de trajet — `transports/trajet/`

Départ · arrivée · date et heure · passagers et bagages · numéro de vol si aéroport ·
« Voir les véhicules ».

**Cas bloquant** : prise en charge demandée à moins de 2 heures → envoi bloqué,
bouton d'appel de l'aide.

### Écrans 8 à 16 — par assemblage

| Écran | Route | Contenu |
|---|---|---|
| 8 · Choix du besoin transport | `transports/` | Trois tuiles : trajet, location, taxi (TRA-01) |
| 9 · Véhicules d'un trajet | `transports/trajet/` | Capacité suffisante, prix fixe par trajet |
| 10 · Location avec chauffeur | `transports/location/` | Ville, date de début et de fin ; prix par jour |
| 11 · Taxi réservé | `transports/taxi/` | Lieu et heure, destination, passagers ; prix indicatif, **sans liste de véhicules**. L'acceptation du taxi vaut confirmation : pas d'étape 6 |
| 12 · Fiche véhicule | `transports/[slug]/` | Même fiche pour le trajet et la location |
| 13 · Compte | `compte/` | E-mail ou téléphone avec code ; mes informations |
| 14 · Aide | `aide/` | Appel, WhatsApp, questions |
| 15 · Questions fréquentes | `aide/faq/` | Par thème |
| 16 · Urgences | `aide/urgences/` | Numéros utiles, hors ligne |

Plus les pages publiques : à-propos, mentions légales, CGU, charte.

---

## 6. La page partenaire sans compte — `reponse/[jeton]/`

Une seule page, aucune connexion, ouverte depuis un SMS.

Détails de la demande · « Accepter » · « Refuser » avec motif · « Ce bien n'est plus
disponible ». Lien déjà utilisé ou expiré → page indiquant que la demande est close,
avec le numéro de l'équipe.

À construire tôt : elle ne dépend de rien, et c'est le **seul** canal viable pour les
taxis, avec leur fenêtre de réponse courte.

---

## 7. L'espace prestataire (V1 — décision du 11 octobre)

Le dossier le reportait après le MVP ; la décision l'a ramené dans la V1. La page
de réponse par jeton reste en place comme repli et comme canal taxi.

Candidature → charte → connexion par code → offres (nouvelle logement, nouveau
véhicule, import tableur, photos, disponibilités, tarifs) → demandes → profil →
documents.

Deux garde-fous repris du PRD : **qui publie n'est pas qui saisit** (validation à
deux personnes) et les **pièces justificatives restent hors plateforme**.

---

## 8. Les transverses

| Sujet | Règle |
|---|---|
| Prix | Jamais sans unité. Espace entre les milliers, « FCFA » après le montant, dans les trois langues. Conversion en euros ou dollars en texte secondaire, précédée de « environ ». « Paiement sur place, jamais avant la prestation » sous chaque total. |
| Dates | Selon la langue : « 30 oct. », « Oct 30 », « 30 oct ». Chiffres à largeur fixe pour aligner les colonnes. |
| Ton | On parle au visiteur, on dit quoi faire ensuite, verbe d'action sur les boutons, chiffres complets, erreur utile. Vouvoiement en français, « usted » en espagnol. |
| États | Les cinq états sont dessinés pour chaque écran clé, pas seulement l'état nominal. |
| Accessibilité | Contraste 4,5 pour le texte, 3 pour les icônes et contours. Cible de 44 × 44 px espacée de 8 px. Erreur écrite sous le champ, pas seulement signalée en rouge. Texte lisible à 200 %. |
| Performance | L'accueil pèse moins de 300 Ko hors images et s'affiche en moins de 3 secondes en 3G. |
| Hors ligne | Bandeau en haut, envoi désactivé puis réactivé au retour du réseau, saisie conservée. |
| PWA | Application web installable. Pas de version de store en V1. |
| Photos | Réelles, validées par l'équipe. 4:3 en liste, 16:9 en tête de fiche. Aucun texte dans une image. |

---

## 9. Ordre de construction

```
Fondations   jetons · packages/ui · i18n · contrats et mocks
Tranche A    écrans 2 → 6 : résultats, fiche, demande, mes demandes, détail
Tranche B    page reponse/[jeton] (courte, débloque le canal taxi)
Tranche C    transport : besoin, trajet, location, taxi, fiche véhicule
Tranche D    espace prestataire
Tranche E    compte, aide, FAQ, urgences, pages publiques
Tranche F    PWA, hors ligne, traduction en et es, passe d'accessibilité
```

La tranche A se construit en **tranche verticale** : cliquable de bout en bout sur
les mocks d'abord, soignée ensuite. C'est le chemin qui porte toute la valeur.

---

## 10. Décisions ouvertes

1. **Jetons** : maquette (`#001D35`) ou dossier (`#102A43`) comme bleu principal ?
2. **Ombre et dégradé** : interdits par le dossier, présents dans la maquette validée.
   Les cantonner à l'accueil, ou les admettre partout ?
3. **Validation à deux personnes** (ADM-04) et **action au nom du partenaire** (ADM-08) :
   sans back-office, par quel moyen l'équipe les assure-t-elle ?
4. **Maquettes** : les écrans 2 à 16 sont dérivés des documents. Chacun passe en revue
   avant d'être considéré comme acquis.
