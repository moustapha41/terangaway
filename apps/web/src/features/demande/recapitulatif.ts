import { cookies } from "next/headers";
import type { Demande } from "@teranga/contracts";

/**
 * Ce que l'écran de confirmation affiche, et d'où cela vient.
 *
 * La demande vient d'être enregistrée par un visiteur qui n'a pas de session :
 * l'API ne livre donc rien sur la seule foi d'une référence (six chiffres, elle
 * se devine). Le récapitulatif voyage plutôt dans un cookie `httpOnly` de courte
 * durée, posé par l'action serveur à partir de la **réponse de l'API** — jamais
 * du formulaire. Il ne sert qu'à l'affichage : aucune autorisation n'en dépend.
 */
export const COOKIE_RECAPITULATIF = "teranga_recap";

const DUREE_SECONDES = 2 * 3600;

export interface Recapitulatif {
  id: string;
  reference: string;
  titre: string;
  /**
   * Le logement demandé, quand c'est un logement.
   *
   * La suite du séjour — transfert à l'arrivée, retour — en tire le lieu. Il
   * vient de la réponse de l'API comme tout le reste : l'adresse de la page ne
   * porte rien de cela, et ne doit pas le porter.
   */
  logementId?: string;
  debut: string;
  fin: string;
  personnes: number;
  /** Seulement si le visiteur en a indiqué une. */
  heureArrivee?: string;
  /** En francs CFA ; absent tant qu'aucun montant n'est figé. */
  total?: number;
  statut: Demande["statut"];
  /** Vrai seulement si le service d'e-mail a accepté le message. */
  emailEnvoye: boolean;
  /** Vrai seulement si un acompte est annoncé : sinon, aucun paiement à suivre. */
  acompteAnnonce: boolean;
}

export function recapitulatifDe(
  demande: Demande,
  emailEnvoye: boolean,
  acompteAnnonce = false,
): Recapitulatif {
  const total = demande.prix.total;
  return {
    id: demande.id,
    reference: demande.reference,
    titre: demande.offre.titre,
    logementId: demande.offre.genre === "logement" ? demande.offre.logementId : undefined,
    debut: demande.dates.debut,
    fin: demande.dates.fin,
    personnes: demande.personnes,
    heureArrivee: demande.heureArrivee?.trim() || undefined,
    total: total > 0 ? total : undefined,
    statut: demande.statut,
    emailEnvoye,
    acompteAnnonce,
  };
}

export async function poserRecapitulatif(recap: Recapitulatif): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_RECAPITULATIF, JSON.stringify(recap), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_SECONDES,
  });
}

/** Relit le récapitulatif, ou `null` s'il manque ou n'a pas la bonne forme. */
export async function lireRecapitulatif(): Promise<Recapitulatif | null> {
  const brut = (await cookies()).get(COOKIE_RECAPITULATIF)?.value;
  if (!brut) return null;
  try {
    const r = JSON.parse(brut) as Partial<Recapitulatif>;
    if (
      typeof r.id !== "string" ||
      typeof r.reference !== "string" ||
      typeof r.titre !== "string" ||
      typeof r.debut !== "string" ||
      typeof r.fin !== "string" ||
      typeof r.personnes !== "number" ||
      typeof r.statut !== "string"
    ) {
      return null;
    }
    return {
      id: r.id,
      reference: r.reference,
      titre: r.titre,
      logementId: typeof r.logementId === "string" ? r.logementId : undefined,
      debut: r.debut,
      fin: r.fin,
      personnes: r.personnes,
      heureArrivee: typeof r.heureArrivee === "string" ? r.heureArrivee : undefined,
      total: typeof r.total === "number" && r.total > 0 ? r.total : undefined,
      statut: r.statut,
      emailEnvoye: r.emailEnvoye === true,
      acompteAnnonce: r.acompteAnnonce === true,
    };
  } catch {
    return null;
  }
}
