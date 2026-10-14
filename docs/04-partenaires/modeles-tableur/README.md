# Modèles d'envoi pour les partenaires

Un modèle par type d'offre (PAR-01). Les colonnes sont exactement les champs de la §11 du PRD :
elles servent à la fois au tableur envoyé au partenaire, au formulaire en ligne et à la
structure de la fiche. **Un champ obligatoire manquant bloque la publication.**

## `logements.csv`

| Colonne | Obligatoire | Exemple |
|---|---|---|
| type | oui | villa, appartement, studio, chambre, résidence |
| titre | oui | Appartement 2 chambres, Almadies |
| ville | oui | Dakar |
| quartier | oui | Almadies |
| adresse_exacte | oui | non affichée avant confirmation |
| capacite | oui | 4 |
| chambres · lits · salles_de_bain | oui | 2 · 3 · 1 |
| prix_par_nuit | oui | en FCFA |
| frais_fixes | non | ménage, caution |
| sejour_minimum | non | en nuits |
| inclus | oui | eau, électricité, ménage, petit-déjeuner |
| equipements | oui | climatisation, Wi-Fi, eau chaude, cuisine, groupe électrogène, parking, gardien, piscine, TV, lave-linge, balcon/terrasse |
| regles | non | fumeurs, fêtes, animaux, heure d'arrivée |
| disponibilite | oui | périodes libres entre le 20 octobre et le 20 novembre |
| conditions_annulation | oui | texte court |
| moyens_de_paiement | oui | espèces, Wave, Orange Money |
| photos | oui | 5 au minimum, dont une principale |
| description | oui | en français, traduite automatiquement ensuite |

## `vehicules.csv`

| Colonne | Obligatoire | Exemple |
|---|---|---|
| offres_proposees | oui | trajet avec chauffeur, location avec chauffeur, location sans chauffeur, taxi |
| categorie | oui | berline, SUV, minibus, taxi |
| marque · modele · annee | oui | — |
| immatriculation | oui | affichée après confirmation |
| places_passagers · bagages | oui | 4 places, 3 valises |
| climatisation | oui | oui / non |
| zones_couvertes | oui | Dakar, Diamniadio, Saly, aéroport |
| chauffeur | si avec chauffeur | nom, téléphone, langues parlées, photo |
| prix_par_jour | si location | en FCFA |
| kilometrage_inclus · carburant | si location | 150 km/jour, carburant à la charge du client |
| age_minimum · permis · caution | si sans chauffeur | 23 ans, permis de plus de 2 ans, montant |
| lieu_de_remise | si location | adresse ou livraison possible |
| disponibilite | oui | jours et heures |
| moyens_de_paiement | oui | espèces, Wave, Orange Money |
| photos | oui | 3 au minimum |

## Rappel de la charte signée par chaque partenaire (PAR-05)

Prix affichés respectés · réponse dans les délais · **aucun acompte demandé au visiteur** ·
signalement immédiat d'un bien qui n'est plus libre.
