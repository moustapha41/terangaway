import { describe, expect, it } from "vitest";

import {
  genererAlerteTransfert,
  genererEmailTransfert,
  type TransfertEquipe,
  type TransfertVisiteur,
} from "./modeles/transfert.modele";

/**
 * Les deux messages du transfert depuis l'aéroport.
 *
 * Au visiteur, l'accusé de sa demande : ce qui a été noté, ce qui se passe
 * ensuite. À l'équipe, ce qu'il y a à faire. Ce qui est verrouillé, c'est ce
 * qu'ils **ne promettent pas** — ni véhicule ni prix, qui ne sont pas décidés —
 * et que rien de ce que le visiteur a écrit n'y entre sans être échappé.
 */

const VISITEUR: TransfertVisiteur = {
  reference: "TW-424242",
  titre: "Villa cinq chambres à Somone",
  lieu: "Centre, Somone",
  jour: "10 novembre 2026",
  personnes: 3,
  lienWhatsapp: "https://wa.me/221765222929?text=Bonjour%20TW-424242&x=1",
  lienVehicules: "https://teranga-way.com/fr/transports/resultats?depart=A&arrivee=B",
};

const EQUIPE: TransfertEquipe = {
  reference: "TW-424242",
  titre: "Villa cinq chambres à Somone",
  lieu: "Centre, Somone",
  jour: "10 novembre 2026",
  personnes: 3,
  contact: { nom: "Fatou Ndiaye", email: "fatou@exemple.sn", telephone: "221771234567" },
  lien: "https://teranga-way.com/fr/admin/demandes/d-9",
};

describe("E-mail du transfert — le visiteur", () => {
  const { sujet, texte, html } = genererEmailTransfert(VISITEUR);

  it("porte la référence dans l'objet, pour le retrouver dans sa boîte", () => {
    expect(sujet).toContain("TW-424242");
  });

  it("répète ce qui a été noté, en texte comme en HTML", () => {
    for (const attendu of ["TW-424242", "Villa cinq chambres à Somone", "Aéroport AIBD → Centre, Somone", "10 novembre 2026"]) {
      expect(texte, `texte : ${attendu}`).toContain(attendu);
      expect(html, `html : ${attendu}`).toContain(attendu);
    }
  });

  it("dit ce qui se passe ensuite, et que rien n'est payé maintenant", () => {
    expect(texte).toContain("confirmer le véhicule, l'heure de prise en charge et le prix");
    expect(texte).toContain("Rien n'est payé maintenant");
    expect(html).toContain("Rien n'est payé maintenant");
  });

  it("invite à envoyer le numéro de vol, par WhatsApp et sur un message déjà écrit", () => {
    expect(texte).toContain("numéro de vol");
    expect(texte).toContain(VISITEUR.lienWhatsapp);
    // Dans un attribut HTML, une esperluette s'écrit `&amp;`.
    expect(html).toContain(`href="${VISITEUR.lienWhatsapp.replace(/&/g, "&amp;")}"`);
  });

  it("laisse choisir le véhicule soi-même", () => {
    expect(texte).toContain(VISITEUR.lienVehicules);
  });

  it("ne promet ni véhicule, ni prix, ni heure : ils ne sont pas décidés", () => {
    // Le message annonce que nous allons les confirmer, il n'en annonce aucun.
    expect(texte).not.toMatch(/\d[\d  ]*\s?(F\s?CFA|FCFA|€|\$)/);
    expect(texte).not.toMatch(/(Toyota|Ford|Hyundai|minibus|berline)/i);
    expect(texte).not.toMatch(/\b\d{1,2}\s?h\s?\d{0,2}\b/);
  });

  it("n'utilise pas de pseudo-élément CSS, que la plupart des messageries ignorent", () => {
    // Les numéros d'étape disparaîtraient : ils sont écrits dans le HTML.
    expect(html).not.toContain("::before");
    expect(html).toContain("<strong>1.</strong>");
    expect(html).toContain("<strong>3.</strong>");
  });

  it("échappe ce qui vient de la base", () => {
    const hostile = genererEmailTransfert({
      ...VISITEUR,
      titre: '<script>alert("x")</script>',
      lieu: '"><img src=x onerror=alert(1)>',
    });
    expect(hostile.html).not.toContain("<script>");
    expect(hostile.html).not.toContain("<img src=x");
    expect(hostile.html).toContain("&lt;script&gt;");
  });
});

describe("Alerte du transfert — l'équipe", () => {
  const { sujet, texte, html } = genererAlerteTransfert(EQUIPE);

  it("nomme la demande et le lieu dès l'objet", () => {
    expect(sujet).toContain("TW-424242");
    expect(sujet).toContain("Centre, Somone");
  });

  it("donne de quoi rappeler, sans ouvrir le backoffice", () => {
    for (const attendu of ["Fatou Ndiaye", "fatou@exemple.sn", "221771234567", "10 novembre 2026", "3"]) {
      expect(texte, attendu).toContain(attendu);
    }
  });

  it("dit ce qu'il reste à faire : le véhicule, l'heure, le prix, le vol", () => {
    expect(texte).toContain("confirmer le véhicule, l'heure de prise en charge et le prix");
    expect(texte).toContain("demander le numéro de vol");
    // Et ce que le visiteur a déjà reçu, pour ne pas lui promettre deux fois.
    expect(texte).toContain("Le visiteur a reçu un e-mail");
  });

  it("porte le lien direct vers la demande", () => {
    expect(texte).toContain(EQUIPE.lien);
    expect(html).toContain(`href="${EQUIPE.lien}"`);
  });

  it("se contente de ce qu'on sait : pas de ligne vide ni de « undefined »", () => {
    const sansContact = genererAlerteTransfert({ ...EQUIPE, contact: { email: "x@y.sn" } });
    expect(sansContact.texte).not.toContain("undefined");
    expect(sansContact.texte).not.toContain("Téléphone");
    expect(sansContact.html).not.toContain("undefined");
  });

  it("échappe le nom, que le visiteur a écrit lui-même", () => {
    const hostile = genererAlerteTransfert({ ...EQUIPE, contact: { nom: "<b>Fatou</b>" } });
    expect(hostile.html).not.toContain("<b>Fatou");
    expect(hostile.html).toContain("&lt;b&gt;Fatou");
  });
});
