import { readFileSync } from "node:fs";
import { join } from "node:path";

import { STATUTS_ACOMPTE } from "@teranga/contracts";
import { describe, expect, it } from "vitest";

import { chargerConfiguration } from "../../config/configuration";
import { TRANSITIONS_ACOMPTE, transitionAcompteAutorisee } from "./acomptes.depot";

/**
 * Le contrat du dépôt d'acomptes, sans base.
 *
 * Les tests PostgreSQL vivent dans `acomptes.prisma.test.ts` ; ceux-ci tiennent
 * ce qui se vérifie à la lecture : la table des transitions, et le fait que
 * la persistance ne sait rien faire d'autre que persister.
 */
describe("Acompte — transitions de statut", () => {
  it("couvre chaque statut, et rien d'autre", () => {
    expect(Object.keys(TRANSITIONS_ACOMPTE).sort()).toEqual([...STATUTS_ACOMPTE].sort());
    for (const cibles of Object.values(TRANSITIONS_ACOMPTE)) {
      for (const cible of cibles) expect(STATUTS_ACOMPTE).toContain(cible);
    }
  });

  it("refuse de rester sur place", () => {
    for (const statut of STATUTS_ACOMPTE) {
      expect(transitionAcompteAutorisee(statut, statut)).toBe(false);
    }
  });

  it("ne rouvre jamais un acompte annulé, ni un acompte expiré en attente", () => {
    expect(transitionAcompteAutorisee("annule", "paye")).toBe(false);
    expect(transitionAcompteAutorisee("expire", "en_attente")).toBe(false);
    expect(transitionAcompteAutorisee("expire", "partiel")).toBe(false);
  });

  it("laisse une décision humaine accepter un paiement tardif", () => {
    // La table l'autorise ; le dépôt exige en plus une vérification signée et
    // commentée, et le service une demande encore vivante.
    expect(transitionAcompteAutorisee("expire", "paye")).toBe(true);
  });

  it("laisse partir vers le remboursement ce qui a été reçu", () => {
    expect(transitionAcompteAutorisee("expire", "a_rembourser")).toBe(true);
    expect(transitionAcompteAutorisee("partiel", "a_rembourser")).toBe(true);
    expect(transitionAcompteAutorisee("paye", "a_rembourser")).toBe(true);
  });

  it("n'annule jamais de l'argent reçu, et n'a rien à rembourser d'un acompte annulé", () => {
    // De l'argent reçu se rend, il ne s'annule pas ; un acompte annulé n'a rien reçu.
    expect(transitionAcompteAutorisee("partiel", "annule")).toBe(false);
    expect(transitionAcompteAutorisee("paye", "annule")).toBe(false);
    expect(transitionAcompteAutorisee("expire", "annule")).toBe(false);
    expect(TRANSITIONS_ACOMPTE.annule).toEqual([]);
    for (const statut of STATUTS_ACOMPTE) {
      if (statut !== "annule") {
        // Seul un acompte qui n'a rien reçu peut s'annuler.
        expect(transitionAcompteAutorisee(statut, "annule")).toBe(statut === "en_attente");
      }
    }
  });

  it("ne déclare « remboursé » que ce qui était à rembourser, et s'y arrête", () => {
    expect(TRANSITIONS_ACOMPTE.a_rembourser).toEqual(["rembourse"]);
    expect(TRANSITIONS_ACOMPTE.rembourse).toEqual([]);
    for (const statut of STATUTS_ACOMPTE) {
      if (statut !== "a_rembourser") expect(transitionAcompteAutorisee(statut, "rembourse")).toBe(false);
    }
  });

  it("suit le chemin attendu d'un acompte en deux versements", () => {
    expect(transitionAcompteAutorisee("en_attente", "partiel")).toBe(true);
    expect(transitionAcompteAutorisee("partiel", "paye")).toBe(true);
  });
});

describe("Acompte — la persistance ne réclame ni n'encaisse rien", () => {
  const source = (fichier: string) => readFileSync(join(__dirname, fichier), "utf8");
  const fichiers = ["acomptes.depot.ts", "acomptes.prisma.ts"];

  it("n'importe ni e-mail, ni client HTTP, ni configuration bancaire", () => {
    for (const fichier of fichiers) {
      const texte = source(fichier);
      expect(texte, fichier).not.toMatch(/from ["'][^"']*email[^"']*["']/i);
      expect(texte, fichier).not.toMatch(/from ["']resend["']/);
      expect(texte, fichier).not.toMatch(/\bfetch\s*\(/);
      expect(texte, fichier).not.toMatch(/from ["']node:https?["']/);
      expect(texte, fichier).not.toMatch(/config\/configuration/);
      expect(texte, fichier).not.toMatch(/beneficiaire|iban|\bbic\b/i);
    }
  });

  it("n'expose aucune méthode de modification ou d'effacement du journal", () => {
    const texte = source("acomptes.depot.ts");
    expect(texte).not.toMatch(/(modifier|supprimer|effacer|corriger)Evenement/i);
    expect(texte).not.toMatch(/depositPaymentEvent\.(update|delete|upsert)/);
    expect(source("acomptes.prisma.ts")).not.toMatch(/depositPaymentEvent\.(update|delete|upsert)/);
  });

  it("reste fermée par défaut : sans variable, l'acompte n'est pas actif", () => {
    const acompte = chargerConfiguration({ NODE_ENV: "test" } as NodeJS.ProcessEnv).acompte;
    expect(acompte.actif).toBe(false);
    expect(acompte.beneficiaire).toBeUndefined();
  });
});
