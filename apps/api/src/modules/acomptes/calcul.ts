/**
 * Le calcul de l'acompte, et rien d'autre.
 *
 * Aucune dépendance, aucun accès à la base, aucune injection : ce fichier se
 * lit et se teste seul, comme `prix.ts` dans les contrats et `delais.ts` dans
 * la machine à états. C'est voulu — un montant d'argent demandé à quelqu'un
 * doit pouvoir se vérifier sans monter une application.
 *
 * Les décisions produit qu'il applique sont **provisoires** tant que la revue
 * juridique n'a pas eu lieu (décision 13 du cadrage). Le taux vient de la
 * configuration ; l'éligibilité et le délai, eux, sont des règles métier par
 * genre, écrites ici — comme `DELAIS` l'est dans `machine-a-etats/delais.ts`.
 */
import type { GenreDemande } from "@teranga/contracts";

/**
 * Le délai de paiement accordé, genre par genre, en heures depuis
 * l'acceptation. `null` = ce genre ne donne pas lieu à un acompte.
 *
 * **Source unique.** L'éligibilité et le délai sont la même décision : un
 * genre est éligible s'il a un délai, et il a un délai s'il est éligible. Les
 * tenir dans deux listes séparées — ce qui était le cas — laissait un genre
 * éligible hériter du délai d'un autre. C'est exactement le défaut que cette
 * table corrige : une variable unique valait pour tous les genres, et chacun
 * doit pouvoir changer de délai sans entraîner les autres.
 *
 * Pourquoi ces valeurs :
 *
 *   `logement` — douze heures. Un séjour se prépare, le visiteur a le temps
 *   de passer à sa banque ;
 *
 *   `location` — douze heures, comme le logement : décision métier. La fenêtre
 *   de confirmation d'une location (`DELAIS.location`) est la même, et c'est
 *   elle qui plafonne l'acompte. Un véhicule retenu l'est donc jusqu'à douze
 *   heures sur la foi d'un paiement qui n'est pas encore arrivé : c'est le
 *   prix de ce choix, que l'équipe assume ;
 *
 *   `trajet` et `taxi` — aucun acompte. Leur demande se joue en minutes ; le
 *   temps d'un virement, la course est partie ou perdue ;
 *
 *   `service` — aucun acompte. Son `prixTotal` vaut **zéro** à l'envoi : il
 *   n'a pas de catalogue derrière lui, c'est l'équipe qui chiffre depuis le
 *   backoffice en posant `prixPropose`. Un pourcentage de zéro vaut zéro, et
 *   réclamer 0 FCFA est pire que ne rien réclamer.
 *
 * Ces heures ne sont **pas** les délais de confirmation d'une demande, qui
 * vivent dans `machine-a-etats/delais.ts` et ne doivent pas bouger pour
 * arranger un acompte. Le plafonnement par `expireLe` est ce qui met les deux
 * calendriers d'accord, sans mêler l'un à l'autre.
 */
export const DELAIS_ACOMPTE_HEURES: Readonly<
  Record<GenreDemande, number | null>
> = {
  logement: 12,
  location: 12,
  trajet: null,
  taxi: null,
  service: null,
};

/**
 * Le délai accordé à ce genre, ou `undefined` s'il n'a pas droit à un acompte.
 *
 * `undefined` et non `0` : un délai de zéro heure serait une échéance déjà
 * passée, pas une absence d'acompte.
 */
export function delaiAcompteHeures(genre: string): number | undefined {
  const delai = (
    DELAIS_ACOMPTE_HEURES as Record<string, number | null | undefined>
  )[genre];
  return typeof delai === "number" ? delai : undefined;
}

/**
 * Ce genre de demande donne-t-il lieu à un acompte ?
 *
 * Dérivé de la table, et jamais d'une seconde liste : avoir un délai *est*
 * être éligible.
 */
export function genreEligibleAcompte(genre: string): boolean {
  return delaiAcompteHeures(genre) !== undefined;
}

/**
 * Un taux d'acompte est-il exploitable ?
 *
 * Bornes ouvertes à zéro et fermées à cent : un taux de 0 % ne demande rien —
 * autant ne pas préparer d'acompte du tout — et un taux au-delà de 100 %
 * réclamerait plus que le prix de la prestation. Les deux sont des erreurs de
 * saisie, pas des intentions, et il vaut mieux les refuser que les appliquer.
 *
 * Un taux non entier est refusé aussi : il serait figé dans un `Int` à la
 * préparation et on ne retrouverait plus le montant qu'on a demandé.
 */
export function pourcentageValide(pourcentage: unknown): pourcentage is number {
  return (
    typeof pourcentage === "number" &&
    Number.isInteger(pourcentage) &&
    pourcentage > 0 &&
    pourcentage <= 100
  );
}

/**
 * Le montant de l'acompte, en francs CFA entiers.
 *
 * `Math.round` et non `floor` ni `ceil` : l'arrondi se décide **une fois**,
 * ici, et le résultat est ce que l'e-mail annonce et ce que le rapprochement
 * bancaire attend. Deux arrondis différents — l'un à l'affichage, l'autre au
 * calcul — laisseraient des écarts de quelques francs qui empêchent de clore
 * un virement, et on ne discute pas trois francs avec une banque.
 *
 * Le franc CFA ne circule pas en subdivisions : un montant décimal n'a rien à
 * faire ici, et `prixTotal` est déjà un entier en base.
 *
 * Lève sur un taux invalide — plutôt que de rendre un montant qui aurait l'air
 * d'un montant. Rend 0 pour un total nul ou négatif : il n'y a rien à
 * demander, et l'appelant doit traiter ce cas comme « pas d'acompte », jamais
 * comme « acompte de zéro franc ».
 */
export function montantAcompte(
  montantTotal: number,
  pourcentage: number,
): number {
  if (!pourcentageValide(pourcentage)) {
    throw new Error(`Taux d'acompte invalide : ${String(pourcentage)}`);
  }
  if (!Number.isFinite(montantTotal) || montantTotal <= 0) return 0;

  const brut = Math.round((montantTotal * pourcentage) / 100);

  // Le garde-fou de la borne haute : à 100 %, l'arrondi ne doit pas pouvoir
  // dépasser le total à cause d'un `montantTotal` non entier venu d'ailleurs.
  return Math.min(brut, Math.floor(montantTotal));
}

/**
 * L'échéance de paiement : le délai du genre, jamais au-delà de la demande.
 *
 * Trois choses en une, et c'est voulu — les séparer avait laissé passer le
 * défaut que cette fonction corrige. Le délai se lit dans la table du genre ;
 * il se compte **depuis l'acceptation**, pas depuis l'envoi, pour ne pas
 * réclamer d'argent sur une demande que le partenaire n'a pas honorée ; et il
 * est plafonné par l'expiration de la demande.
 *
 * Le plafond n'est pas un détail de confort : sans lui, une location acceptée
 * puis expirée à la troisième heure se ferait payer à la douzième. C'est le
 * seul endroit où les deux calendriers se rencontrent, et aucun des deux n'y
 * est modifié — `expireLe` est lu, jamais écrit.
 *
 * Lève plutôt que de rendre une échéance inexploitable : un genre sans droit à
 * l'acompte, un instant d'acceptation illisible, ou un plafond qui ne laisse
 * aucun délai de paiement. Un dossier dont l'échéance est déjà passée à la
 * seconde de sa création réclamerait un virement impossible.
 *
 * Rendue en ISO, comme toutes les dates qui traversent les contrats.
 */
export function echeanceAcompte(
  genre: string,
  accepteeLe: Date | string,
  expireLeDemande?: string | null,
): string {
  const delaiHeures = delaiAcompteHeures(genre);
  if (delaiHeures === undefined) {
    throw new Error(`Le genre « ${genre} » ne donne pas lieu à un acompte.`);
  }

  const depuis = accepteeLe instanceof Date ? accepteeLe : new Date(accepteeLe);
  if (Number.isNaN(depuis.getTime())) {
    throw new Error(`Instant d'acceptation invalide : ${String(accepteeLe)}`);
  }

  const normale = depuis.getTime() + delaiHeures * 60 * 60_000;
  const plafond = plafondDemande(expireLeDemande);
  const retenue = plafond === undefined ? normale : Math.min(normale, plafond);

  if (retenue <= depuis.getTime()) {
    throw new Error(
      "L'échéance d'acompte ne laisse aucun délai de paiement : " +
        `l'expiration de la demande (${String(expireLeDemande)}) précède l'acceptation.`,
    );
  }

  return new Date(retenue).toISOString();
}

/**
 * L'expiration de la demande, en millisecondes, quand elle est exploitable.
 *
 * Une demande sans échéance — un service, par exemple — n'en impose aucune, et
 * on ne lui en invente pas : le délai du genre s'applique seul. Une date
 * illisible est traitée de même plutôt que de faire échouer la préparation sur
 * une donnée qui n'est pas celle de l'acompte.
 */
function plafondDemande(expireLeDemande?: string | null): number | undefined {
  if (!expireLeDemande) return undefined;
  const plafond = new Date(expireLeDemande).getTime();
  return Number.isNaN(plafond) ? undefined : plafond;
}

/**
 * Ce qui reste dû, en francs CFA.
 *
 * Jamais négatif : un trop-perçu n'est pas un reste dû négatif, c'est une
 * anomalie à signaler et à rembourser. La confondre avec un solde ferait
 * afficher « il vous reste -5 000 FCFA à payer » à quelqu'un qui a trop versé.
 */
export function resteDu(montantAttendu: number, montantRecu: number): number {
  return Math.max(0, montantAttendu - montantRecu);
}
