import { describe, expect, it } from "vitest";

import { ASSISTANCE, lienWhatsapp } from "../../src/lib/assistance";

/**
 * Le lien WhatsApp porte un message déjà écrit : le logement, les dates, le
 * nombre de voyageurs. Un caractère mal encodé le couperait net — une
 * apostrophe, un guillemet français, une esperluette — et l'équipe recevrait
 * une demi-phrase.
 */
describe("Lien WhatsApp", () => {
  it("ouvre la conversation avec le numéro de l'assistance", () => {
    expect(lienWhatsapp()).toBe(`https://wa.me/${ASSISTANCE.whatsapp}`);
  });

  it("emporte le message tel qu'il a été écrit", () => {
    const message = "Bonjour, je suis intéressé(e) par « Villa d'architecte & piscine » du 2 nov. au 9 nov., pour 3 personne(s). Est-ce disponible ?";
    const lien = lienWhatsapp(message);

    const [base, requete] = lien.split("?");
    expect(base).toBe(`https://wa.me/${ASSISTANCE.whatsapp}`);
    // Un seul paramètre : une esperluette non encodée en aurait fait deux.
    expect([...new URLSearchParams(requete).keys()]).toEqual(["text"]);
    expect(new URLSearchParams(requete).get("text")).toBe(message);
  });

  it("n'ajoute pas de paramètre vide quand il n'y a pas de message", () => {
    expect(lienWhatsapp("")).toBe(`https://wa.me/${ASSISTANCE.whatsapp}`);
    expect(lienWhatsapp()).not.toContain("?");
  });

  it("ne laisse pas un message hostile sortir de son paramètre", () => {
    const lien = lienWhatsapp("x&text=autre&phone=123#fragment");
    const requete = new URLSearchParams(lien.split("?")[1]);
    expect(requete.get("text")).toBe("x&text=autre&phone=123#fragment");
    expect(requete.get("phone")).toBeNull();
  });
});
