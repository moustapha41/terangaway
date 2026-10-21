import { describe, expect, it, vi } from "vitest";

import type { ServiceEmail } from "../../commun/email/email.service";
import type { LigneRelance } from "../../commun/email/modeles/relance-equipe.modele";
import { genererRelanceEquipe } from "../../commun/email/modeles/relance-equipe.modele";
import type { ServiceComptes } from "../comptes/comptes.service";
import type { DemandeARelancer, DepotDemandes } from "./demandes.depot";
import type { ServiceDemandes } from "./demandes.service";
import { VeilleurDemandes } from "./veilleur.service";

/**
 * La veille sur les demandes laissées sans réponse.
 *
 * Trois choses à tenir, et ce sont elles qui font qu'on peut s'y fier :
 * chaque genre a son délai — relancer un taxi au bout d'une heure revient à ne
 * pas le relancer ; on ne relance qu'une fois ; et un e-mail qui échoue
 * n'arrête pas la veille.
 */

const MAINTENANT = new Date("2026-11-01T12:00:00.000Z");
const ilYa = (minutes: number) => new Date(MAINTENANT.getTime() - minutes * 60_000);

/**
 * Un dépôt en mémoire qui applique la même règle que SQL : les demandes
 * « envoyée », non relancées, créées avant le seuil de leur genre.
 */
function depotAvec(
  demandes: Array<{ id: string; genre: string; creeLe: Date }>,
  echues: string[] = [],
) {
  const relancees = new Set<string>();

  const depot: Partial<DepotDemandes> = {
    async aExpirer(_maintenant, limite) {
      return echues.slice(0, limite);
    },
    async aRelancer(seuils, limite) {
      return demandes
        .filter((d) => !relancees.has(d.id))
        .filter((d) => seuils[d.genre] && d.creeLe <= seuils[d.genre])
        .slice(0, limite)
        .map<DemandeARelancer>((d) => ({
          id: d.id,
          reference: `TW-${d.id}`,
          genre: d.genre,
          titre: `Offre ${d.id}`,
          creeLe: d.creeLe.toISOString(),
          expireLe: new Date(d.creeLe.getTime() + 120 * 60_000).toISOString(),
        }));
    },
    async marquerRelancees(ids) {
      for (const id of ids) relancees.add(id);
    },
  };

  return { depot: depot as DepotDemandes, relancees };
}

function veilleur(
  depot: DepotDemandes,
  envoi = vi.fn().mockResolvedValue({ envoye: true }),
  transitionner = vi.fn().mockResolvedValue(undefined),
) {
  const comptes = {
    adressesEquipe: async () => ["terangaway@gmail.com"],
  } as unknown as ServiceComptes;
  const email = { relancerEquipe: envoi } as unknown as ServiceEmail;
  const demandes = { transitionner } as unknown as ServiceDemandes;
  return { service: new VeilleurDemandes(depot, demandes, comptes, email), envoi, transitionner };
}

describe("Veilleur — qui relancer, et quand", () => {
  it("respecte le délai propre à chaque genre", async () => {
    // PRD §10 : taxi 10 min, trajet 30 min, logement 60 min.
    const { depot } = depotAvec([
      { id: "taxi-tardif", genre: "taxi", creeLe: ilYa(15) },
      { id: "taxi-recent", genre: "taxi", creeLe: ilYa(5) },
      { id: "trajet-tardif", genre: "trajet", creeLe: ilYa(45) },
      { id: "logement-recent", genre: "logement", creeLe: ilYa(45) },
      { id: "logement-tardif", genre: "logement", creeLe: ilYa(90) },
    ]);
    const { service, envoi } = veilleur(depot);

    const nombre = await service.veiller(MAINTENANT);

    expect(nombre).toBe(3);
    const lignes = envoi.mock.calls[0][1] as LigneRelance[];
    expect(lignes.map((l) => l.reference).sort()).toEqual([
      "TW-logement-tardif",
      "TW-taxi-tardif",
      "TW-trajet-tardif",
    ]);
  });

  it("ne relance qu'une fois la même demande", async () => {
    const { depot, relancees } = depotAvec([
      { id: "a", genre: "logement", creeLe: ilYa(90) },
    ]);
    const { service, envoi } = veilleur(depot);

    expect(await service.veiller(MAINTENANT)).toBe(1);
    expect(relancees.has("a")).toBe(true);

    // Second passage, cinq minutes plus tard : plus rien à dire.
    expect(await service.veiller(new Date(MAINTENANT.getTime() + 300_000))).toBe(0);
    expect(envoi).toHaveBeenCalledTimes(1);
  });

  it("n'écrit rien à personne quand tout est traité", async () => {
    const { depot } = depotAvec([{ id: "a", genre: "logement", creeLe: ilYa(10) }]);
    const { service, envoi } = veilleur(depot);

    expect(await service.veiller(MAINTENANT)).toBe(0);
    expect(envoi).not.toHaveBeenCalled();
  });

  it("marque les demandes même si l'e-mail n'est pas parti", async () => {
    // Une relance rejouée toutes les cinq minutes finirait en filtre : mieux
    // vaut la trace dans le journal qu'une alerte que plus personne ne lit.
    const { depot, relancees } = depotAvec([
      { id: "a", genre: "logement", creeLe: ilYa(90) },
    ]);
    const { service } = veilleur(depot, vi.fn().mockResolvedValue({ envoye: false }));

    await service.veiller(MAINTENANT);
    expect(relancees.has("a")).toBe(true);
  });

  it("compose le temps d'attente et l'échéance en clair", async () => {
    const { depot } = depotAvec([
      { id: "a", genre: "logement", creeLe: ilYa(80) },
      { id: "b", genre: "logement", creeLe: ilYa(200) },
    ]);
    const { service, envoi } = veilleur(depot);

    await service.veiller(MAINTENANT);
    const lignes = envoi.mock.calls[0][1] as LigneRelance[];

    expect(lignes[0].depuis).toBe("depuis 1 h 20");
    expect(lignes[0].echeance).toBe("expire dans 40 min");
    // Celle de plus de trois heures a dépassé son délai de réponse.
    expect(lignes[1].echeance).toContain("expirée");
    expect(lignes[0].lien).toContain("/fr/admin/demandes/a");
  });
});

describe("Veilleur — prononcer l'expiration", () => {
  it("fait passer par la machine à états, au nom du système", async () => {
    const { depot } = depotAvec([], ["d-1", "d-2"]);
    const { service, transitionner } = veilleur(depot);

    await service.veiller(MAINTENANT);

    expect(transitionner).toHaveBeenCalledTimes(2);
    expect(transitionner).toHaveBeenCalledWith("d-1", "expiree", "systeme");
    expect(transitionner).toHaveBeenCalledWith("d-2", "expiree", "systeme");
  });

  it("une demande qui résiste n'arrête pas les suivantes", async () => {
    const { depot } = depotAvec([], ["d-1", "d-2", "d-3"]);
    const transitionner = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("TRANSITION_INTERDITE"))
      .mockResolvedValueOnce(undefined);
    const { service } = veilleur(depot, undefined, transitionner);

    await expect(service.veiller(MAINTENANT)).resolves.toBe(0);
    expect(transitionner).toHaveBeenCalledTimes(3);
  });

  it("expire avant de relancer : on ne rappelle pas une demande morte", async () => {
    const ordre: string[] = [];
    const { depot } = depotAvec([{ id: "a", genre: "logement", creeLe: ilYa(90) }], ["a"]);
    const transitionner = vi.fn().mockImplementation(async () => {
      ordre.push("expiration");
    });
    const envoi = vi.fn().mockImplementation(async () => {
      ordre.push("relance");
      return { envoye: true };
    });
    const { service } = veilleur(depot, envoi, transitionner);

    await service.veiller(MAINTENANT);
    expect(ordre).toEqual(["expiration", "relance"]);
  });
});

describe("Relance — le message", () => {
  const ligne: LigneRelance = {
    reference: "TW-784188",
    genre: "logement",
    titre: "Villa trois chambres à Nguérigne",
    depuis: "depuis 1 h 20",
    echeance: "expire dans 40 min",
    lien: "https://teranga-way.com/fr/admin/demandes/d-1",
  };

  it("nomme la demande quand il n'y en a qu'une", () => {
    const { sujet, texte } = genererRelanceEquipe([ligne]);
    expect(sujet).toContain("TW-784188");
    expect(texte).toContain("depuis 1 h 20");
    expect(texte).toContain("https://teranga-way.com/fr/admin/demandes/d-1");
  });

  it("les compte quand il y en a plusieurs", () => {
    const { sujet, html } = genererRelanceEquipe([ligne, { ...ligne, reference: "TW-000002" }]);
    expect(sujet).toBe("2 demandes attendent une réponse");
    expect(html).toContain("TW-000002");
  });
});
