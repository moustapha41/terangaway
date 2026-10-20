import type { Traducteur } from "./traducteur";

/**
 * Le titre d'un logement, dans la langue de la page.
 *
 * Les titres viennent des annonces des propriétaires : ils sont en français
 * dans le catalogue, et le catalogue est la donnée, pas un texte d'écran. Un
 * visiteur qui lit la page en anglais tombait donc sur « Villa quatre chambres
 * à Saly » au milieu d'une interface anglaise.
 *
 * La traduction vit dans les trois catalogues de langue, sous l'identifiant du
 * logement. À défaut — une annonce ajoutée depuis l'espace partenaire, par
 * exemple —, c'est le titre d'origine qui s'affiche : montrer le titre du
 * propriétaire vaut mieux que montrer une clé.
 */
export function titreLogement(
  logement: { id: string; titre: string },
  t: Traducteur,
): string {
  const cle = `titreLogement.${logement.id}`;
  const traduit = t(cle);
  return traduit === cle ? logement.titre : traduit;
}

/**
 * Le titre de l'offre d'une demande.
 *
 * Une demande garde le titre tel qu'il était à l'envoi — c'est la trace de ce
 * que le visiteur a demandé. Elle garde aussi l'identifiant du logement :
 * l'écran peut donc nommer l'offre dans la langue de la page, sans toucher à
 * ce qui est enregistré. Un véhicule ou un service n'a pas de catalogue
 * traduit : leur titre s'affiche tel quel.
 */
export function titreOffre(
  offre: { genre: string; titre: string; logementId?: string },
  t: Traducteur,
): string {
  return offre.genre === "logement" && offre.logementId
    ? titreLogement({ id: offre.logementId, titre: offre.titre }, t)
    : offre.titre;
}
