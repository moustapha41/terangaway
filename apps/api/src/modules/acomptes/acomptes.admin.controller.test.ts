import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { PATH_METADATA, METHOD_METADATA } from "@nestjs/common/constants";

import { ErreurMetier } from "../../commun/erreurs";
import { enProduction } from "../../commun/securite/posture.test-utils";
import { DepotComptesFixtures } from "../comptes/comptes.fixtures";
import { ServiceComptes } from "../comptes/comptes.service";
import { ControleurAcomptesAdmin } from "./acomptes.admin.controller";
import type { ServiceAcomptes } from "./acomptes.service";

const statutDe = (e: unknown) => (e as ErreurMetier).getStatus();

function serviceAcomptesEspion() {
  const appele = vi.fn();
  const service = new Proxy(
    {},
    { get: (_cible, nom) => (...args: unknown[]) => { appele(String(nom), args); return Promise.resolve({}); } },
  ) as unknown as ServiceAcomptes;
  return { service, appele };
}

const res = { setHeader: vi.fn() } as never;

/** Chaque route du contrôleur, appelée avec des arguments valables. */
function appels(c: ControleurAcomptesAdmin, auth?: string) {
  const corps = { montant: 1, montantRecuAvant: 0 };
  return {
    lire: () => c.lire("d-1", res, auth),
    preparer: () => c.preparer("d-1", res, auth),
    confirmerReception: () => c.confirmerReception("d-1", corps, res, auth),
    renvoyerInstructions: () => c.renvoyerInstructions("d-1", res, auth),
    renvoyerConfirmation: () => c.renvoyerConfirmation("d-1", res, auth),
    deciderPaiementTardif: () =>
      c.deciderPaiementTardif("d-1", { issue: "accepter", commentaire: "x" }, res, auth),
    deciderRemboursement: () => c.deciderRemboursement("d-1", { commentaire: "motif" }, res, auth),
    constaterRemboursement: () => c.constaterRemboursement("d-1", { montant: 1 }, res, auth),
  } as Record<string, () => Promise<unknown>>;
}

describe("Acompte — accès réservé aux administrateurs", () => {
  it("couvre toutes les routes du contrôleur (une route ajoutée sans test fait échouer ce test)", () => {
    const routes = Object.getOwnPropertyNames(ControleurAcomptesAdmin.prototype).filter(
      (nom) => nom !== "constructor" && Reflect.hasMetadata(METHOD_METADATA, ControleurAcomptesAdmin.prototype[nom as keyof ControleurAcomptesAdmin]),
    );
    const { service } = serviceAcomptesEspion();
    const testees = Object.keys(appels(new ControleurAcomptesAdmin(service, {} as ServiceComptes)));
    expect(routes.sort()).toEqual(testees.sort());
    expect(Reflect.getMetadata(PATH_METADATA, ControleurAcomptesAdmin)).toBe("administration/demandes/:id/acompte");
  });

  it("refuse chaque route sans session (401), sans toucher au service", async () => {
    await enProduction(async () => {
      const { service, appele } = serviceAcomptesEspion();
      const c = new ControleurAcomptesAdmin(service, new ServiceComptes(new DepotComptesFixtures()));
      for (const [nom, appel] of Object.entries(appels(c))) {
        const erreur = await appel().catch((e) => e);
        expect(erreur, nom).toBeInstanceOf(ErreurMetier);
        expect(statutDe(erreur), nom).toBe(401);
      }
      expect(appele).not.toHaveBeenCalled();
    });
  });

  it("refuse chaque route à un visiteur connecté (403 ou 401), sans toucher au service", async () => {
    await enProduction(async () => {
      const depot = new DepotComptesFixtures();
      const comptes = new ServiceComptes(depot);
      const session = await depot.creerSessionVisiteur("visiteur@exemple.sn");
      const { service, appele } = serviceAcomptesEspion();
      const c = new ControleurAcomptesAdmin(service, comptes);

      for (const [nom, appel] of Object.entries(appels(c, `Bearer ${session.token}`))) {
        const erreur = await appel().catch((e) => e);
        expect(erreur, nom).toBeInstanceOf(ErreurMetier);
        expect([401, 403], nom).toContain(statutDe(erreur));
      }
      expect(appele).not.toHaveBeenCalled();
    });
  });

  it("refuse un jeton forgé", async () => {
    await enProduction(async () => {
      const { service, appele } = serviceAcomptesEspion();
      const c = new ControleurAcomptesAdmin(service, new ServiceComptes(new DepotComptesFixtures()));
      const erreur = await appels(c, "Bearer tws_" + "0".repeat(64)).confirmerReception().catch((e) => e);
      expect(erreur).toBeInstanceOf(ErreurMetier);
      expect(appele).not.toHaveBeenCalled();
    });
  });

  it("laisse passer un administrateur, avec son identité, et marque la réponse no-store", async () => {
    const { service, appele } = serviceAcomptesEspion();
    const comptes = { exigerAdministrateur: vi.fn().mockResolvedValue({ id: "admin-1" }) } as unknown as ServiceComptes;
    const c = new ControleurAcomptesAdmin(service, comptes);
    const entetes = vi.fn();

    await c.confirmerReception("d-9", { montant: 5, montantRecuAvant: 0 }, { setHeader: entetes } as never, "Bearer x");

    expect(entetes).toHaveBeenCalledWith("Cache-Control", "no-store");
    // L'acteur du journal est celui de la session, jamais une valeur du corps.
    expect(appele).toHaveBeenCalledWith("confirmerReception", ["d-9", { montant: 5, montantRecuAvant: 0 }, "admin-1"]);
  });
});
