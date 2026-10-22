import { describe, expect, it } from "vitest";

import { DELAIS } from "../demandes/machine-a-etats/delais";
import {
  DELAIS_ACOMPTE_HEURES,
  delaiAcompteHeures,
  echeanceAcompte,
  genreEligibleAcompte,
  montantAcompte,
  pourcentageValide,
  resteDu,
} from "./calcul";

/**
 * Le calcul de l'acompte.
 *
 * Six choses à tenir, et ce sont elles qui font qu'on peut réclamer de
 * l'argent sans se tromper : l'arrondi est décidé une fois et toujours le même ;
 * un taux aberrant est refusé plutôt qu'appliqué ; un total nul ne produit pas
 * un acompte de zéro franc ; un trop-perçu n'est jamais présenté comme un
 * reste dû négatif ; **chaque genre a son propre délai** ; et l'échéance ne
 * dépasse jamais l'expiration de la demande.
 */

const HEURE = 3_600_000;

describe("Acompte — taux", () => {
  it("accepte un entier de 1 à 100", () => {
    expect(pourcentageValide(1)).toBe(true);
    expect(pourcentageValide(30)).toBe(true);
    expect(pourcentageValide(100)).toBe(true);
  });

  it("refuse 0 — un acompte de rien n'est pas un acompte", () => {
    expect(pourcentageValide(0)).toBe(false);
  });

  it("refuse au-delà de 100 : on ne réclame pas plus que le prix", () => {
    expect(pourcentageValide(101)).toBe(false);
    expect(pourcentageValide(1000)).toBe(false);
  });

  it("refuse le négatif, le décimal et ce qui n'est pas un nombre", () => {
    expect(pourcentageValide(-30)).toBe(false);
    expect(pourcentageValide(30.5)).toBe(false);
    expect(pourcentageValide(Number.NaN)).toBe(false);
    expect(pourcentageValide("30")).toBe(false);
    expect(pourcentageValide(undefined)).toBe(false);
    expect(pourcentageValide(null)).toBe(false);
  });
});

describe("Acompte — montant en francs CFA", () => {
  it("applique le taux retenu de 30 % sur un total qui tombe juste", () => {
    expect(montantAcompte(127_500, 30)).toBe(38_250);
    expect(montantAcompte(100_000, 30)).toBe(30_000);
  });

  it("rend toujours un entier : le franc CFA ne circule pas en centimes", () => {
    const montant = montantAcompte(83_333, 30);
    expect(Number.isInteger(montant)).toBe(true);
    // 24 999,9 → 25 000
    expect(montant).toBe(25_000);
  });

  it("arrondit une demie au supérieur, et c'est la seule règle d'arrondi du projet", () => {
    // 30 % de 85 = 25,5
    expect(montantAcompte(85, 30)).toBe(26);
  });

  it("ne dépasse jamais le total, même à 100 % sur un total non entier", () => {
    expect(montantAcompte(50_000, 100)).toBe(50_000);
    // Math.round(100,7) vaudrait 101 : le garde-fou ramène au total.
    expect(montantAcompte(100.7, 100)).toBe(100);
  });

  it("rend 0 sur un total nul ou négatif — à l'appelant d'en conclure « pas d'acompte »", () => {
    // C'est exactement le cas du service à la demande, dont le total vaut 0
    // à l'envoi. Réclamer 0 FCFA serait pire que ne rien réclamer.
    expect(montantAcompte(0, 30)).toBe(0);
    expect(montantAcompte(-1_000, 30)).toBe(0);
  });

  it("rend 0 quand l'arrondi écrase un montant minuscule", () => {
    // 1 % de 1 FCFA = 0,01 → 0. Le cas est théorique mais il ne doit pas
    // produire un montant négatif ni un décimal.
    expect(montantAcompte(1, 1)).toBe(0);
  });

  it("lève sur un taux invalide plutôt que de rendre un montant vraisemblable", () => {
    expect(() => montantAcompte(100_000, 0)).toThrow(/Taux d'acompte invalide/);
    expect(() => montantAcompte(100_000, 101)).toThrow(
      /Taux d'acompte invalide/,
    );
    expect(() => montantAcompte(100_000, 30.5)).toThrow(
      /Taux d'acompte invalide/,
    );
  });
});

describe("Acompte — genres éligibles", () => {
  it("couvre le logement et la location", () => {
    expect(genreEligibleAcompte("logement")).toBe(true);
    expect(genreEligibleAcompte("location")).toBe(true);
  });

  it("écarte, pour l'instant, le taxi et le trajet", () => {
    expect(genreEligibleAcompte("taxi")).toBe(false);
    expect(genreEligibleAcompte("trajet")).toBe(false);
  });

  it("écarte le service à la demande, dont le prix n'est pas encore connu", () => {
    expect(genreEligibleAcompte("service")).toBe(false);
  });

  it("écarte ce qu'il ne connaît pas", () => {
    expect(genreEligibleAcompte("croisiere")).toBe(false);
    expect(genreEligibleAcompte("")).toBe(false);
  });
});

describe("Acompte — délai par genre", () => {
  it("accorde douze heures au logement et trois à la location", () => {
    expect(delaiAcompteHeures("logement")).toBe(12);
    expect(delaiAcompteHeures("location")).toBe(3);
  });

  it("n'accorde aucun délai au trajet, au taxi ni au service", () => {
    expect(delaiAcompteHeures("trajet")).toBeUndefined();
    expect(delaiAcompteHeures("taxi")).toBeUndefined();
    expect(delaiAcompteHeures("service")).toBeUndefined();
  });

  it("n'accorde aucun délai à un genre inconnu", () => {
    expect(delaiAcompteHeures("croisiere")).toBeUndefined();
    expect(delaiAcompteHeures("")).toBeUndefined();
  });

  it("tient éligibilité et délai dans une seule table", () => {
    // Le défaut corrigé : deux listes séparées laissaient la location
    // éligible hériter du délai du logement. Avoir un délai *est* être éligible.
    for (const [genre, delai] of Object.entries(DELAIS_ACOMPTE_HEURES)) {
      expect(genreEligibleAcompte(genre)).toBe(delai !== null);
    }
  });

  it("n'accorde jamais un délai nul ou négatif à un genre éligible", () => {
    for (const delai of Object.values(DELAIS_ACOMPTE_HEURES)) {
      if (delai !== null) expect(delai).toBeGreaterThan(0);
    }
  });
});

describe("Acompte — échéance", () => {
  const acceptationLe = new Date("2026-11-01T08:00:00.000Z");

  it("donne douze heures à un logement, depuis l'acceptation et non l'envoi", () => {
    expect(echeanceAcompte("logement", acceptationLe)).toBe(
      "2026-11-01T20:00:00.000Z",
    );
  });

  it("donne trois heures à une location — et non les douze du logement", () => {
    // La non-conformité que cette correction vise : une location recevait
    // douze heures parce qu'un unique ACOMPTE_DELAI_HEURES valait pour tous.
    expect(echeanceAcompte("location", acceptationLe)).toBe(
      "2026-11-01T11:00:00.000Z",
    );
  });

  it("refuse un trajet et un taxi : il n'y a pas d'échéance à calculer", () => {
    expect(() => echeanceAcompte("trajet", acceptationLe)).toThrow(
      /ne donne pas lieu à un acompte/,
    );
    expect(() => echeanceAcompte("taxi", acceptationLe)).toThrow(
      /ne donne pas lieu à un acompte/,
    );
  });

  it("refuse un service et un genre inconnu", () => {
    expect(() => echeanceAcompte("service", acceptationLe)).toThrow(
      /ne donne pas lieu à un acompte/,
    );
    expect(() => echeanceAcompte("croisiere", acceptationLe)).toThrow(
      /ne donne pas lieu à un acompte/,
    );
  });

  it("plafonne à l'expiration de la demande quand celle-ci arrive avant", () => {
    // Un logement accepté puis expirant dans deux heures : on ne réclame pas
    // un virement sous douze heures pour une réservation morte avant.
    const expireLe = new Date(
      acceptationLe.getTime() + 2 * HEURE,
    ).toISOString();
    expect(echeanceAcompte("logement", acceptationLe, expireLe)).toBe(expireLe);
  });

  it("garde le délai du genre quand la demande expire après", () => {
    const expireLe = new Date(
      acceptationLe.getTime() + 48 * HEURE,
    ).toISOString();
    expect(echeanceAcompte("logement", acceptationLe, expireLe)).toBe(
      "2026-11-01T20:00:00.000Z",
    );
  });

  it("n'invente aucun plafond quand la demande n'a pas d'échéance", () => {
    expect(echeanceAcompte("location", acceptationLe, undefined)).toBe(
      "2026-11-01T11:00:00.000Z",
    );
    expect(echeanceAcompte("location", acceptationLe, null)).toBe(
      "2026-11-01T11:00:00.000Z",
    );
  });

  it("ignore un plafond illisible plutôt que d'échouer sur une donnée voisine", () => {
    expect(echeanceAcompte("location", acceptationLe, "pas une date")).toBe(
      "2026-11-01T11:00:00.000Z",
    );
  });

  it("refuse une échéance qui ne laisse aucun délai de paiement", () => {
    // Expiration antérieure ou égale à l'acceptation : le dossier naîtrait
    // déjà échu, et réclamerait un virement impossible.
    const avant = new Date(acceptationLe.getTime() - HEURE).toISOString();
    expect(() => echeanceAcompte("logement", acceptationLe, avant)).toThrow(
      /aucun délai de paiement/,
    );
    expect(() =>
      echeanceAcompte("logement", acceptationLe, acceptationLe.toISOString()),
    ).toThrow(/aucun délai de paiement/);
  });

  it("refuse un instant d'acceptation illisible", () => {
    expect(() => echeanceAcompte("logement", "demain")).toThrow(
      /Instant d'acceptation invalide/,
    );
    expect(() =>
      echeanceAcompte("logement", new Date("n'importe quoi")),
    ).toThrow(/Instant d'acceptation invalide/);
  });

  it("accepte l'acceptation en ISO comme en Date", () => {
    expect(echeanceAcompte("logement", acceptationLe.toISOString())).toBe(
      echeanceAcompte("logement", acceptationLe),
    );
  });
});

describe("Acompte — non-régression sur les délais de confirmation des demandes", () => {
  /**
   * Les deux calendriers restent distincts.
   *
   * Corriger le délai d'acompte ne doit pas toucher `DELAIS` : ces minutes
   * gouvernent la réponse du partenaire et la confirmation du visiteur, pas le
   * paiement. Ce test est le garde-fou — si quelqu'un « arrange » un acompte en
   * allongeant une fenêtre de confirmation, il échoue ici.
   */
  it("laisse les fenêtres de confirmation inchangées", () => {
    expect(DELAIS.logement.confirmationVisiteurMinutes).toBe(12 * 60);
    expect(DELAIS.location.confirmationVisiteurMinutes).toBe(12 * 60);
    expect(DELAIS.trajet.confirmationVisiteurMinutes).toBe(3 * 60);
    expect(DELAIS.taxi.confirmationVisiteurMinutes).toBe(15);
    expect(DELAIS.service.confirmationVisiteurMinutes).toBe(12 * 60);
  });

  it("laisse les délais de réponse du partenaire inchangés", () => {
    expect(DELAIS.logement.expirationReponseMinutes).toBe(120);
    expect(DELAIS.location.expirationReponseMinutes).toBe(6 * 60);
    expect(DELAIS.taxi.expirationReponseMinutes).toBe(30);
  });

  it("ne confond pas le délai d'acompte d'une location avec sa fenêtre de confirmation", () => {
    // Trois heures de paiement, douze heures de confirmation : deux nombres
    // différents, et c'est le plafonnement qui les met d'accord, pas une
    // égalisation.
    expect(delaiAcompteHeures("location")).toBe(3);
    expect(DELAIS.location.confirmationVisiteurMinutes / 60).toBe(12);
  });
});

describe("Acompte — reste dû", () => {
  it("donne ce qui manque après un versement partiel", () => {
    expect(resteDu(38_250, 10_000)).toBe(28_250);
  });

  it("vaut 0 quand tout est versé", () => {
    expect(resteDu(38_250, 38_250)).toBe(0);
  });

  it("ne descend jamais sous zéro : un trop-perçu est une anomalie, pas un solde", () => {
    // Sans ce plancher, l'écran du visiteur afficherait « il vous reste
    // -5 000 FCFA à payer » à quelqu'un qui a trop versé.
    expect(resteDu(38_250, 43_250)).toBe(0);
  });
});
