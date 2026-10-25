import { describe, expect, it } from "vitest";
import { lienTransfert } from "@teranga/contracts";

import { genererEmailDemande, type DetailsDemande } from "./modeles/demande.modele";

/**
 * L'accusé de réception d'une demande, et la suite du séjour qu'il propose.
 *
 * C'est l'e-mail où le visiteur revient quand il a fermé l'onglet : la
 * référence, les identifiants quand le compte vient d'être ouvert, et les trois
 * chemins — l'arrivée, le séjour, le retour. Ce qui est verrouillé ici, c'est
 * que ces chemins mènent là où l'écran de confirmation les annonçait, et qu'ils
 * disparaissent plutôt que de se tromper.
 */

const BASE = "https://teranga-way.com/fr";
const sejour = { lieu: "Centre, Somone", debut: "2026-11-01", fin: "2026-11-08", personnes: 4 };

const DETAILS: DetailsDemande = {
  reference: "TW-784188",
  titre: "Villa cinq chambres à Somone",
  sejour: "1 novembre 2026 → 8 novembre 2026",
  total: "1 707 000 FCFA",
  urlSite: "https://teranga-way.com",
  suite: {
    lieu: sejour.lieu,
    arrivee: `${BASE}${lienTransfert({ sens: "arrivee", ...sejour })}`,
    depart: `${BASE}${lienTransfert({ sens: "depart", ...sejour })}`,
    services: `${BASE}/services`,
  },
};

describe("Accusé de réception — la suite du séjour", () => {
  it("propose l'arrivée, le séjour et le retour, en texte comme en HTML", () => {
    const { texte, html } = genererEmailDemande(DETAILS);

    for (const attendu of [
      "Complétez votre séjour",
      "Votre transfert depuis l'aéroport",
      "Pendant votre séjour",
      "Votre retour à l'aéroport",
      "Centre, Somone",
      DETAILS.suite!.arrivee,
      DETAILS.suite!.depart,
      DETAILS.suite!.services,
    ]) {
      expect(texte, `texte : ${attendu}`).toContain(attendu);
    }
    // En HTML, un `&` dans un attribut s'écrit `&amp;` : les clients de
    // messagerie le tolèrent nu, mais ce n'est pas du HTML correct.
    for (const lien of [DETAILS.suite!.arrivee, DETAILS.suite!.depart, DETAILS.suite!.services]) {
      expect(html, lien).toContain(`href="${lien.replace(/&/g, "&amp;")}"`);
    }
    expect(html).not.toMatch(/href="[^"]*&(?!amp;)[^"]*"/);
  });

  it("mène à l'aéroport à l'arrivée, et en vient au retour", () => {
    const { arrivee, depart } = DETAILS.suite!;
    const lire = (adresse: string) => new URL(adresse).searchParams;

    expect(lire(arrivee).get("depart")).toBe("Aéroport AIBD");
    expect(lire(arrivee).get("arrivee")).toBe("Centre, Somone");
    expect(lire(arrivee).get("quand")).toBe("2026-11-01T10:00");

    expect(lire(depart).get("depart")).toBe("Centre, Somone");
    expect(lire(depart).get("arrivee")).toBe("Aéroport AIBD");
    expect(lire(depart).get("quand")).toBe("2026-11-08T08:00");

    expect(lire(arrivee).get("passagers")).toBe("4");
  });

  it("dit que rien n'est payé maintenant", () => {
    const { texte } = genererEmailDemande(DETAILS);
    expect(texte).toContain("rien n'est payé maintenant");
  });

  it("disparaît quand il n'y a pas de logement à raccompagner", () => {
    // Un transport ou un service n'appelle pas de transfert depuis l'aéroport.
    const { texte, html } = genererEmailDemande({ ...DETAILS, suite: undefined });

    expect(texte).not.toContain("Complétez votre séjour");
    expect(html).not.toContain("Complétez votre séjour");
    expect(texte).not.toContain("undefined");
    // Le reste de l'accusé est intact.
    expect(texte).toContain("TW-784188");
  });

  it("garde les identifiants après la suite, et jamais avant", () => {
    const { texte } = genererEmailDemande({
      ...DETAILS,
      identifiants: { email: "fatou@exemple.sn", motDePasse: "K7MP-4RT9-XB2F-H6QD" },
    });

    // Les deux blocs coexistent : un nouveau visiteur reçoit sa suite de séjour
    // et son compte, dans cet ordre — la suite d'abord, parce que c'est elle qui
    // transforme une demande en séjour.
    expect(texte.indexOf("Complétez votre séjour")).toBeGreaterThan(-1);
    expect(texte.indexOf("Votre compte")).toBeGreaterThan(texte.indexOf("Complétez votre séjour"));
    expect(texte).toContain("K7MP-4RT9-XB2F-H6QD");
  });

  it("échappe ce qui vient du visiteur dans le HTML", () => {
    const { html } = genererEmailDemande({
      ...DETAILS,
      suite: { ...DETAILS.suite!, lieu: '<img src=x onerror="alert(1)">' },
    });

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });
});
