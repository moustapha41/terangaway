# Espace prestataire

Là où un prestataire dépose ses produits : logements, véhicules, disponibilités, prix.

> **État : dans la V1.** Décision du 11 octobre 2026, qui s'écarte du PRD — celui-ci
> rangeait l'espace prestataire avec compte dans ses non-objectifs.
>
> Le lien SMS sans connexion (`app/reponse/[jeton]`) **reste** : c'est le chemin de repli
> pour un prestataire qui n'ouvre jamais son compte, et le seul canal pour un taxi.
> Les deux coexistent et mènent à la même demande.

## Le parcours

```
candidature  →  charte signée  →  compte ouvert par l'équipe  →  connexion OTP
                                                                      │
                            ┌─────────────────────────────────────────┤
                            ▼                                         ▼
                      offres/nouvelle                            demandes/
                   (ou offres/import)                      accepter · refuser + motif
                            │
                    brouillon ──→ à valider ──→ publiée
                                      ▲              │
                            l'équipe valide     suspendue sur signalement
                          (une 2ᵉ personne)     ou « plus disponible »
```

## Ce que le prestataire peut et ne peut pas faire

| Peut | Ne peut pas |
|---|---|
| Déposer une offre, la modifier tant qu'elle est en brouillon | Publier seul une offre |
| Téléverser ses photos, choisir la principale | Modifier son badge « vérifié » |
| Tenir ses disponibilités, signaler un bien pris | Modifier la grille de prix du transport |
| Accepter, refuser une demande avec motif | Voir les coordonnées du visiteur avant confirmation |
| Déclarer ses moyens de paiement acceptés | Demander un acompte (motif de suspension) |

## Champs obligatoires

Les formulaires reprennent exactement les colonnes de la §11 du PRD, qui servent aussi de
modèle tableur dans `docs/04-partenaires/modeles-tableur/`. Un champ obligatoire manquant
bloque la publication, pas la sauvegarde en brouillon.

## Dossiers

| Dossier | Rôle |
|---|---|
| `candidature/` | Formulaire d'entrée, charte (PAR-05) |
| `connexion/` | OTP sur le numéro qui reçoit déjà les demandes |
| `offres/nouvelle/logement/` · `vehicule/` | Saisie unitaire, utilisable au téléphone (PAR-02) |
| `offres/import/` | Modèle tableur, aperçu, lignes en erreur (PAR-01, ADM-03) |
| `offres/[id]/photos/` | 5 photos minimum pour un logement, 3 pour un véhicule |
| `offres/[id]/disponibilites/` | Périodes libres et dates bloquées (LOG-30..33) |
| `offres/[id]/tarifs/` | Prix par nuit et frais fixes, ou prix par jour |
| `demandes/` | Ses demandes, la plus urgente en tête (PAR-14) |
| `profil/` | Interlocuteur, WhatsApp, zones couvertes, moyens de paiement |
| `documents/` | Dépôt des pièces — stockées hors plateforme, réservées aux validateurs (§11) |
