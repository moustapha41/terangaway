import type { StatutDemande } from "@teranga/contracts";
import { STATUTS_TERMINAUX } from "@teranga/contracts";

/**
 * Qui peut provoquer une transition.
 *
 * « equipe » agit au nom du partenaire (support) ; « systeme » porte
 * l'expiration et le passage en terminée.
 */
export type ActeurTransition = "visiteur" | "partenaire" | "equipe" | "systeme";

export interface TransitionAutorisee {
  de: StatutDemande;
  vers: StatutDemande;
  par: readonly ActeurTransition[];
}

/**
 * Table de transitions — source unique des changements de statut.
 *
 * Tout ce qui n'y figure pas est refusé. Les délais (qui expire quand) vivent
 * dans `delais.ts` ; ici on ne décide que de ce qui est permis.
 */
export const TRANSITIONS: readonly TransitionAutorisee[] = [
  { de: "envoyee", vers: "acceptee", par: ["partenaire", "equipe"] },
  { de: "envoyee", vers: "refusee", par: ["partenaire", "equipe"] },
  { de: "envoyee", vers: "expiree", par: ["systeme"] },
  { de: "envoyee", vers: "annulee", par: ["visiteur"] },

  { de: "acceptee", vers: "confirmee", par: ["visiteur"] },
  { de: "acceptee", vers: "expiree", par: ["systeme"] },
  { de: "acceptee", vers: "annulee", par: ["visiteur"] },

  { de: "confirmee", vers: "terminee", par: ["systeme"] },
  { de: "confirmee", vers: "annulee", par: ["visiteur", "equipe"] },
] as const;

export function transitionPermise(
  de: StatutDemande,
  vers: StatutDemande,
  par: ActeurTransition,
): boolean {
  if (STATUTS_TERMINAUX.includes(de)) return false;
  return TRANSITIONS.some((t) => t.de === de && t.vers === vers && t.par.includes(par));
}

export function destinationsDepuis(
  de: StatutDemande,
  par: ActeurTransition,
): StatutDemande[] {
  return TRANSITIONS.filter((t) => t.de === de && t.par.includes(par)).map((t) => t.vers);
}
