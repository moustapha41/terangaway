import { HttpStatus } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { ErreurMetier } from "../../commun/erreurs";
import { traduireRefusDeLaBase } from "./acomptes.prisma";

const code = (e: ErreurMetier | undefined) => (e?.getResponse() as { code: string } | undefined)?.code;

/**
 * Les refus d'intégrité de PostgreSQL deviennent des erreurs métier ; rien d'autre
 * n'est touché. Les messages ci-dessous sont ceux que la base lève réellement
 * (contraintes et déclencheurs des trois migrations d'acompte).
 */
describe("Traduction des refus de la base en erreurs métier", () => {
  const brute = (message: string) => new Error(`Invalid invocation. ConnectorError: ${message}`);

  it.each([
    ["new row for relation \"deposit_payments\" violates check constraint \\\"deposit_payments_paye_check\\\"", /atteigne le montant attendu/],
    ["violates check constraint \\\"deposit_payments_partiel_check\\\"", /Partiel exige/],
    ["violates check constraint \\\"deposit_payments_en_attente_check\\\"", /en attente n'a rien reçu/],
    ["violates check constraint \\\"deposit_payments_annule_check\\\"", /annulé n'a rien reçu/],
    ["new row for relation \"deposit_payment_events\" violates check constraint \\\"deposit_payment_events_acteur_requis_check\\\"", /personne nommée/],
    ["violates check constraint \\\"deposit_payment_events_montant_requis_check\\\"", /exige un montant/],
  ])("contrainte : %s", (message, attendu) => {
    const e = traduireRefusDeLaBase(brute(message));
    expect(code(e)).toBe("ACOMPTE_EVENEMENT_INVALIDE");
    expect(e!.message).toMatch(attendu);
    expect(e!.message).toContain("Rien n'a été enregistré");
  });

  it("transition interdite : conflit 409, jamais une erreur brute", () => {
    const e = traduireRefusDeLaBase(brute("deposit_payments : passage de rembourse à paye interdit"));
    expect(code(e)).toBe("ACOMPTE_TRANSITION_INTERDITE");
    expect(e!.getStatus()).toBe(HttpStatus.CONFLICT);
  });

  it("montants figés et cumul décroissant", () => {
    expect(code(traduireRefusDeLaBase(brute("deposit_payments : la demande, le taux et les montants sont figés à la préparation")))).toBe("ACOMPTE_EVENEMENT_INVALIDE");
    expect(code(traduireRefusDeLaBase(brute("deposit_payments : le montant reçu ne diminue pas (186000 vers 0)")))).toBe("ACOMPTE_EVENEMENT_INVALIDE");
  });

  it("statut sans événement de journal", () => {
    const e = traduireRefusDeLaBase(brute("deposit_payments : le statut « paye » n'a pas son événement de journal (reception_confirmee ou verification)"));
    expect(code(e)).toBe("ACOMPTE_EVENEMENT_INVALIDE");
    expect(e!.message).toMatch(/événement de journal/);
  });

  it("ne reprend aucune valeur de la base dans le message rendu", () => {
    const e = traduireRefusDeLaBase(brute("deposit_payments : le montant reçu ne diminue pas (186000 vers 0)"));
    expect(e!.message).not.toMatch(/186000/);
  });

  it("laisse passer tout ce qui n'est pas un garde-fou : unicité, réseau, erreur métier, autre table", () => {
    expect(traduireRefusDeLaBase(brute("Unique constraint failed on the fields: (`demandeId`) deposit_payments_demandeId_key"))).toBeUndefined();
    expect(traduireRefusDeLaBase(new Error("Connection refused"))).toBeUndefined();
    expect(traduireRefusDeLaBase(brute("violates check constraint \\\"accounts_email_check\\\""))).toBeUndefined();
    expect(traduireRefusDeLaBase(new ErreurMetier("ACOMPTE_NON_PAYE", "x"))).toBeUndefined();
    expect(traduireRefusDeLaBase("pas une erreur")).toBeUndefined();
    expect(traduireRefusDeLaBase(undefined)).toBeUndefined();
  });

  it("une contrainte d'acompte inconnue reçoit un message générique, pas son nom", () => {
    const e = traduireRefusDeLaBase(brute("violates check constraint \\\"deposit_payments_futur_check\\\""));
    expect(code(e)).toBe("ACOMPTE_EVENEMENT_INVALIDE");
    expect(e!.message).not.toContain("futur");
  });
});
