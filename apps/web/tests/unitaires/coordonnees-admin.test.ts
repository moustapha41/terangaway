import { readFileSync } from "node:fs";
import path from "node:path";

import { ETATS_COORDONNEES, type CoordonneesAdmin } from "@teranga/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CHAMPS_COORDONNEES,
  cleErreurCoordonnees,
  nomActeur,
  saisieAEnvoyer,
  saisieInitiale,
  visiblesParLeVisiteur,
} from "@/features/admin/coordonnees-admin";
import {
  apiAdminCoordonnees,
  apiAdminSaisirCoordonnees,
  apiAdminVerifierCoordonnees,
} from "@/lib/api/administration";

/**
 * L'encart des coordonnées dans le backoffice : ce qu'il montre, ce qu'il
 * envoie, et les textes qu'il pose sur un refus. Valeurs de test seulement.
 */
const vue = (partiel: Partial<CoordonneesAdmin>): CoordonneesAdmin => ({
  demandeId: "d-1",
  statut: "acceptee",
  famille: "logement",
  etat: "absentes",
  saisissable: true,
  peutVerifier: false,
  ...partiel,
});

const catalogue = (langue: string) =>
  JSON.parse(readFileSync(path.resolve(__dirname, `../../src/messages/${langue}.json`), "utf8"));
const lire = (objet: unknown, cle: string) =>
  cle.split(".").reduce<unknown>((n, s) => (n && typeof n === "object" ? (n as Record<string, unknown>)[s] : undefined), objet);

describe("Coordonnées admin — formulaire", () => {
  it("chaque famille a ses champs, ceux que l'API exige", () => {
    expect(CHAMPS_COORDONNEES.logement.map((c) => [c.cle, c.requis])).toEqual([
      ["adresseExacte", true],
      ["telephone", true],
      ["consignesArrivee", false],
    ]);
    expect(CHAMPS_COORDONNEES.vehicule.map((c) => [c.cle, c.requis])).toEqual([
      ["immatriculation", true],
      ["telephoneChauffeur", true],
      ["lieuDeRendezVous", false],
    ]);
  });

  it("pré-remplit avec ce qui est enregistré", () => {
    const enregistrees = vue({
      etat: "saisies",
      coordonnees: { adresseExacte: "ADRESSE-DE-TEST", telephone: "+000 00" },
    });
    expect(saisieInitiale(enregistrees)).toEqual({
      adresseExacte: "ADRESSE-DE-TEST",
      telephone: "+000 00",
      consignesArrivee: "",
    });
  });

  it("n'envoie que les champs de la famille, nettoyés, sans les vides", () => {
    expect(
      saisieAEnvoyer("vehicule", {
        immatriculation: "  IMMAT-TEST  ",
        telephoneChauffeur: "+000 11",
        lieuDeRendezVous: " ",
        adresseExacte: "ADRESSE-DE-TEST",
      }),
    ).toEqual({ immatriculation: "IMMAT-TEST", telephoneChauffeur: "+000 11" });
  });
});

describe("Coordonnées admin — ce qui est dit à l'équipe", () => {
  it("« visibles par le visiteur » seulement vérifiées et à confirmée ou terminée", () => {
    expect(visiblesParLeVisiteur(vue({ etat: "verifiees", statut: "confirmee" }))).toBe(true);
    expect(visiblesParLeVisiteur(vue({ etat: "verifiees", statut: "terminee" }))).toBe(true);
    expect(visiblesParLeVisiteur(vue({ etat: "verifiees", statut: "acceptee" }))).toBe(false);
    expect(visiblesParLeVisiteur(vue({ etat: "saisies", statut: "confirmee" }))).toBe(false);
    expect(visiblesParLeVisiteur(vue({ etat: "absentes", statut: "confirmee" }))).toBe(false);
  });

  it("nomme l'auteur par son nom, sinon son adresse, sinon son identifiant", () => {
    const le = "2026-10-22T08:00:00.000Z";
    expect(nomActeur({ le, par: { id: "a", nom: "Awa", email: "a@x.test" } })).toBe("Awa");
    expect(nomActeur({ le, par: { id: "a", email: "a@x.test" } })).toBe("a@x.test");
    expect(nomActeur({ le, par: { id: "a" } })).toBe("a");
  });

  it("chaque refus a son texte dans les trois langues ; la validation garde le message serveur", () => {
    const codes = [
      "COORDONNEES_QUATRE_YEUX",
      "COORDONNEES_CONFLIT",
      "COORDONNEES_STATUT_NON_ELIGIBLE",
      "COORDONNEES_DEJA_VERIFIEES",
      "COORDONNEES_ABSENTES",
      "COORDONNEES_A_RESAISIR",
      "COORDONNEES_SAISIE_NON_TRACEE",
      "COORDONNEES_GENRE_NON_PRIS_EN_CHARGE",
      "COORDONNEES_MIGRATION_EN_ATTENTE",
      "NON_AUTHENTIFIE",
      "ACCES_INTERDIT",
      "INJOIGNABLE",
      "CODE_INCONNU",
    ];
    for (const langue of ["fr", "en", "es"]) {
      const messages = catalogue(langue);
      for (const code of codes) {
        const cle = cleErreurCoordonnees(code)!;
        expect(typeof lire(messages, cle), `${langue} · ${code}`).toBe("string");
      }
    }
    expect(cleErreurCoordonnees("COORDONNEES_INVALIDES")).toBeNull();
  });

  it("états et libellés de champs existent dans les trois langues", () => {
    for (const langue of ["fr", "en", "es"]) {
      const messages = catalogue(langue);
      for (const etat of ETATS_COORDONNEES) {
        expect(typeof lire(messages, `admin.coordonnees.etat.${etat}`), `${langue} · ${etat}`).toBe("string");
      }
      for (const champ of [...CHAMPS_COORDONNEES.logement, ...CHAMPS_COORDONNEES.vehicule]) {
        expect(typeof lire(messages, `admin.coordonnees.champ.${champ.cle}`), `${langue} · ${champ.cle}`).toBe("string");
      }
    }
  });
});

describe("Coordonnées admin — appels à l'API", () => {
  afterEach(() => vi.unstubAllGlobals());

  const capturer = () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ donnees: vue({}) }),
    });
    vi.stubGlobal("fetch", fetch);
    return fetch;
  };

  it("lit, saisit (PUT) et vérifie (POST) avec le jeton d'équipe, sans cache", async () => {
    const fetch = capturer();

    await apiAdminCoordonnees("jeton-equipe", "d/1");
    await apiAdminSaisirCoordonnees("jeton-equipe", "d/1", { adresseExacte: "ADRESSE-DE-TEST" });
    await apiAdminVerifierCoordonnees("jeton-equipe", "d/1", "2026-10-22T08:00:00.000Z");

    const [lecture, saisie, verification] = fetch.mock.calls;
    expect(lecture[0]).toMatch(/\/administration\/demandes\/d%2F1\/coordonnees$/);
    expect(lecture[1]).toMatchObject({ method: "GET", cache: "no-store" });

    expect(saisie[1]).toMatchObject({ method: "PUT", cache: "no-store" });
    expect(JSON.parse(saisie[1].body)).toEqual({ adresseExacte: "ADRESSE-DE-TEST" });

    expect(verification[0]).toMatch(/\/coordonnees\/verification$/);
    expect(verification[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(verification[1].body)).toEqual({ saisieLe: "2026-10-22T08:00:00.000Z" });

    for (const [, options] of fetch.mock.calls) {
      expect(options.headers.authorization).toBe("Bearer jeton-equipe");
    }
  });
});
