import type { Logement } from "@teranga/contracts";

/**
 * Le lieu d'un logement, tel qu'il s'écrit sous un titre.
 *
 * Le catalogue ne nomme jamais l'adresse : la plus fine indication qu'il porte
 * est le quartier. Six offres n'en donnent même pas — le propriétaire ne l'a
 * pas dit, et nous ne l'inventons pas. Leur champ vaut alors « Non précisé »,
 * ce qui est juste dans une fiche mais se lit mal en sous-titre de vignette :
 * « Non précisé, Dakar » occupe la place d'un renseignement sans en être un.
 *
 * Dans ce cas la vignette ne garde que la ville. Elle en dit moins, et c'est
 * exactement ce que nous savons.
 */
const QUARTIER_INCONNU = "Non précisé";

export function situation(logement: Pick<Logement, "quartier" | "ville">): string {
  return logement.quartier === QUARTIER_INCONNU
    ? logement.ville
    : `${logement.quartier}, ${logement.ville}`;
}
