/**
 * La règle de longueur du mot de passe, à un seul endroit.
 *
 * Elle est lue par le formulaire (composant client, pour répondre tout de
 * suite) et par la Server Action (qui valide pour de vrai). Elle ne peut donc
 * pas vivre dans `inscription-actions.ts` : un fichier `"use server"` n'exporte
 * que des fonctions asynchrones, et une constante y fait échouer la
 * construction — ce que les tests unitaires ne voient pas, seul `next build`
 * le dit.
 *
 * Elle doit rester alignée avec `LONGUEUR_MINIMALE_MOT_DE_PASSE` côté API, qui
 * est la seule garantie réelle.
 */
export const LONGUEUR_MINIMALE_MOT_DE_PASSE = 10;

/** Longueur maximale acceptée, pour borner le coût du hachage côté API. */
export const LONGUEUR_MAXIMALE_MOT_DE_PASSE = 200;
