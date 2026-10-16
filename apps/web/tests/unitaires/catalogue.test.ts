import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  chercherLogements,
  obtenirLogement,
  logementParId,
  avisLogement,
  chercherVehicules,
  facettesVehicules,
  obtenirVehicule,
  vehiculeParId,
  lieux,
  villes,
  estimerTaxi,
  ErreurServeur,
} from "../../src/mocks/api";
import { LOGEMENTS } from "../../src/mocks/fixtures/logements";

describe("Catalogue Logements & Transports — Disponibilité et Intégrité", () => {
  const envInitial = process.env.NEXT_PUBLIC_API_MOCK;

  beforeEach(() => {
    // Simuler l'environnement de production Dokploy où NEXT_PUBLIC_API_MOCK=false
    process.env.NEXT_PUBLIC_API_MOCK = "false";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = envInitial;
  });

  it("1. Contient les logements réels accessibles via chercherLogements", async () => {
    const resultats = await chercherLogements({});
    expect(resultats.total).toBe(LOGEMENTS.length);
    expect(resultats.elements.length).toBe(LOGEMENTS.length);

    for (const logement of resultats.elements) {
      expect(logement.id).toBeDefined();
      expect(logement.slug).toBeDefined();
      expect(logement.titre.trim().length).toBeGreaterThan(0);
      expect(logement.prixParNuit).toBeGreaterThan(0);
      expect(logement.capacite).toBeGreaterThan(0);
      expect(logement.photos.length).toBeGreaterThan(0);
    }
  });

  it("2. Retrouve chaque logement par son slug exact, et renvoie null pour un slug inconnu", async () => {
    for (const l of LOGEMENTS) {
      const trouve = await obtenirLogement(l.slug);
      expect(trouve).not.toBeNull();
      expect(trouve?.id).toBe(l.id);
      expect(trouve?.titre).toBe(l.titre);
    }

    // Fiche inexistante renvoie null (permet de déclencher un vrai 404 dans Next.js)
    const inconnu = await obtenirLogement("logement-inexistant-404");
    expect(inconnu).toBeNull();

    const vide = await obtenirLogement("");
    expect(vide).toBeNull();
  });

  it("3. Retrouve chaque logement par son id exact, et renvoie null pour un id inconnu", async () => {
    for (const l of LOGEMENTS) {
      const trouve = await logementParId(l.id);
      expect(trouve).not.toBeNull();
      expect(trouve?.slug).toBe(l.slug);
    }

    const inconnu = await logementParId("id-totalement-inconnu");
    expect(inconnu).toBeNull();

    const vide = await logementParId("");
    expect(vide).toBeNull();
  });

  it("4. Affiche les 4 hébergements recommandés de la page d'accueil (MIS_EN_AVANT)", async () => {
    const MIS_EN_AVANT = ["l-001", "l-002", "l-003", "l-004"];
    const logements = await Promise.all(MIS_EN_AVANT.map(logementParId));

    expect(logements.length).toBe(4);
    for (const l of logements) {
      expect(l).not.toBeNull();
      expect(l?.photos[0]?.url).toBeDefined();
      expect(l?.prixParNuit).toBeGreaterThan(0);
    }
  });

  it("5. Filtre par ville, type, équipement, prix et effectue les tris", async () => {
    // Filtre ville
    const dakar = await chercherLogements({ ville: "Dakar" });
    expect(dakar.total).toBeGreaterThan(0);
    for (const l of dakar.elements) {
      expect(l.ville.toLowerCase()).toContain("dakar");
    }

    // Filtre type
    const villas = await chercherLogements({ types: ["villa"] });
    expect(villas.total).toBeGreaterThan(0);
    for (const l of villas.elements) {
      expect(l.type).toBe("villa");
    }

    // Filtre équipement
    const avecPiscine = await chercherLogements({ equipements: ["piscine"] });
    expect(avecPiscine.total).toBeGreaterThan(0);
    for (const l of avecPiscine.elements) {
      expect(l.equipements).toContain("piscine");
    }

    // Tri prix croissant
    const triPrix = await chercherLogements({ tri: "prix-croissant" });
    for (let i = 0; i < triPrix.elements.length - 1; i++) {
      expect(triPrix.elements[i].prixParNuit).toBeLessThanOrEqual(
        triPrix.elements[i + 1].prixParNuit,
      );
    }

    // Tri prix décroissant
    const triPrixDesc = await chercherLogements({ tri: "prix-decroissant" });
    for (let i = 0; i < triPrixDesc.elements.length - 1; i++) {
      expect(triPrixDesc.elements[i].prixParNuit).toBeGreaterThanOrEqual(
        triPrixDesc.elements[i + 1].prixParNuit,
      );
    }
  });

  it("6. Gère les erreurs techniques sans les masquer sous forme de liste vide", async () => {
    // Un état d'erreur simulé DOIT lever une ErreurServeur
    await expect(chercherLogements({}, "erreur")).rejects.toThrow(ErreurServeur);

    // Un catalogue vide renvoie 0 résultats avec ses facettes
    const vide = await chercherLogements({}, "vide");
    expect(vide.total).toBe(0);
    expect(vide.elements).toEqual([]);
    expect(vide.facettes).toBeDefined();

    // Des filtres sans correspondance renvoient une liste vide sans lever d'erreur
    const impossible = await chercherLogements({ prixMax: 10 });
    expect(impossible.total).toBe(0);
    expect(impossible.elements).toEqual([]);
  });

  it("7. Vérifie que toutes les photos référencées dans le catalogue existent sur disque dans public/", () => {
    const publicDir = path.resolve(__dirname, "../../public");

    let totalPhotos = 0;
    for (const logement of LOGEMENTS) {
      expect(logement.photos.length).toBeGreaterThan(0);
      for (const photo of logement.photos) {
        totalPhotos++;
        expect(photo.url.startsWith("/images/logements/")).toBe(true);

        const relativePath = photo.url.replace(/^\//, "");
        const filePath = path.join(publicDir, relativePath);
        const exists = fs.existsSync(filePath);

        expect(
          exists,
          `Photo manquante sur disque: ${photo.url} pour le logement ${logement.slug}`,
        ).toBe(true);
      }
    }

    expect(totalPhotos).toBeGreaterThanOrEqual(122);
  });

  it("8. Fournit le catalogue de transport, avis, lieux et estimation taxi en mode mock=false", async () => {
    // Véhicules
    const vehicules = await chercherVehicules("location", {});
    expect(vehicules.length).toBeGreaterThan(0);

    const facettes = await facettesVehicules("location", {});
    expect(facettes.total).toBeGreaterThan(0);

    const premierVehicule = vehicules[0];
    const vehiculeSlug = await obtenirVehicule(premierVehicule.slug);
    expect(vehiculeSlug?.id).toBe(premierVehicule.id);

    const vehiculeId = await vehiculeParId(premierVehicule.id);
    expect(vehiculeId?.slug).toBe(premierVehicule.slug);

    // Lieux et villes
    const listeLieux = await lieux();
    expect(listeLieux.length).toBeGreaterThan(0);

    const listeVilles = await villes();
    expect(listeVilles.length).toBeGreaterThan(0);
    expect(listeVilles).toContain("Dakar");

    // Estimation taxi
    const taxi = await estimerTaxi(3);
    expect(taxi.bas).toBeGreaterThan(0);
    expect(taxi.haut).toBeGreaterThan(taxi.bas);

    // Avis logement
    const avis = await avisLogement(LOGEMENTS[0].slug, 3);
    expect(Array.isArray(avis)).toBe(true);
  });
});
