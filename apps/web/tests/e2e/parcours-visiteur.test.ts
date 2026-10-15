import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

/**
 * Parcours visiteur de bout en bout, en processus.
 *
 * Toute la chaîne du site est traversée pour de vrai — Server Action, session,
 * `appelerApi`, jusqu'à l'appel `fetch` — contre une fausse API montée ici.
 *
 * C'est le niveau auquel la panne de production se voyait, et c'est pourquoi ces
 * tests existent : les tests unitaires remplaçaient `@/lib/api/ecriture`, donc
 * personne ne vérifiait **ce qui partait réellement sur le réseau**. Or le bug
 * était là : le client HTTP ne transmettait pas le cookie de session, l'API
 * répondait 401, et le site affichait un écran muet.
 *
 * La fausse API applique les mêmes règles que la vraie, désormais :
 *   · aucune route privée sans `Authorization: Bearer <jeton émis>` ;
 *   · `visiteur-demo` et les identifiants de compte ne sont pas des jetons ;
 *   · chaque demande est rattachée au compte porteur du jeton.
 *
 * Ce n'est pas un test navigateur : rien ici ne dit du rendu, de l'hydratation
 * ni des erreurs de console. Playwright reste à installer pour cela.
 */

/* ────────────────────────── le navigateur simulé ────────────────────────── */

const bocalCookies = new Map<string, { value: string } & Record<string, unknown>>();
const entetesRequete = new Map<string, string>([["x-forwarded-for", "41.82.0.1"]]);

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: (nom: string, valeur: string, opts: Record<string, unknown>) => {
      bocalCookies.set(nom, { value: valeur, ...opts });
    },
    get: (nom: string) => bocalCookies.get(nom),
    delete: (nom: string) => {
      bocalCookies.delete(nom);
    },
  })),
  headers: vi.fn(async () => entetesRequete),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const redirections: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirections.push(url);
    const erreur = new Error("NEXT_REDIRECT") as Error & { digest: string };
    erreur.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw erreur;
  },
}));

/* ───────────────────────────── la fausse API ────────────────────────────── */

interface DemandeStockee {
  reference: string;
  compteId: string;
  genre: "logement" | "vehicule";
  offreId: string;
}

const COMPTE = { id: "cmp_rokhaya_001", email: "rokhaya.seck@exemple.sn", telephone: "+221770000001" };
const CODE_ATTENDU = "481502";

/** Jetons émis par la fausse API, comme le fait `genererJetonSession()`. */
const jetonsEmis = new Set<string>();
const demandes: DemandeStockee[] = [];
let compteurOtp = 0;
const appels: { chemin: string; porteur?: string }[] = [];

function emettreJeton(): string {
  const jeton = `tws_${"0".repeat(60)}${(jetonsEmis.size + 1).toString().padStart(4, "0")}`;
  jetonsEmis.add(jeton);
  return jeton;
}

/** Le jeton porté par la requête, ou `undefined`. Mêmes règles que l'API. */
function porteur(entetes: Record<string, string>): string | undefined {
  const auth = entetes["authorization"] ?? entetes["Authorization"];
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  return entetes["x-visiteur-id"];
}

function reponse(statut: number, corps: unknown) {
  return {
    ok: statut >= 200 && statut < 300,
    status: statut,
    json: async () => corps,
  } as Response;
}

const refus401 = reponse(401, {
  erreur: { code: "NON_AUTHENTIFIE", message: "Session invalide ou expirée." },
});

function fausseApi(url: string, init?: RequestInit): Response {
  const chemin = new URL(url).pathname;
  const entetes = (init?.headers ?? {}) as Record<string, string>;
  const corps = init?.body ? JSON.parse(String(init.body)) : {};
  const jeton = porteur(entetes);
  appels.push({ chemin, porteur: jeton });

  // Une session n'existe que si l'API a émis le jeton. `visiteur-demo`, une
  // adresse e-mail ou un identifiant de compte ne sont pas des jetons.
  const compteId = jeton && jetonsEmis.has(jeton) ? COMPTE.id : undefined;

  switch (chemin) {
    case "/comptes/otp/envoyer":
      compteurOtp += 1;
      return reponse(200, {
        donnees: { expireLe: new Date(Date.now() + 600_000).toISOString(), delaiAttenteSecondes: 60 },
      });

    case "/comptes/otp/verifier": {
      if (corps.code !== CODE_ATTENDU) {
        return reponse(401, {
          erreur: { code: "CODE_INVALIDE", message: "Le code n'est pas valable." },
        });
      }
      // La vraie API renvoie toujours le jeton, jamais seulement l'identifiant.
      return reponse(200, { donnees: { visiteurId: COMPTE.id, token: emettreJeton() } });
    }

    case "/comptes/session":
      if (!compteId) return refus401;
      return reponse(200, {
        donnees: {
          visiteur: {
            compteId,
            email: COMPTE.email,
            telephone: COMPTE.telephone,
            token: jeton,
          },
        },
      });

    case "/demandes/logement": {
      if (!compteId) return refus401;
      const reference = `TW-L${(demandes.length + 1).toString().padStart(5, "0")}`;
      demandes.push({ reference, compteId, genre: "logement", offreId: corps.logementId });
      return reponse(201, {
        donnees: {
          id: `d-${reference}`,
          reference,
          statut: "envoyee",
          offre: { genre: "logement", logementId: corps.logementId, titre: "Logement", vignette: "/x.jpg" },
          dates: { debut: corps.debut, fin: corps.fin },
          personnes: corps.personnes,
          prix: { prixParNuit: 125000, nuits: 7, fraisFixes: [], total: 875000 },
          frise: [{ statut: "envoyee", horodatage: new Date().toISOString(), origine: "visiteur" }],
        },
      });
    }

    case "/demandes/vehicule": {
      if (!compteId) return refus401;
      const reference = `TW-V${(demandes.length + 1).toString().padStart(5, "0")}`;
      demandes.push({ reference, compteId, genre: "vehicule", offreId: corps.vehiculeId });
      return reponse(201, {
        donnees: {
          id: `d-${reference}`,
          reference,
          statut: "envoyee",
          offre: { genre: "vehicule", vehiculeId: corps.vehiculeId, titre: "Véhicule" },
          dates: { debut: corps.quand, fin: corps.quand },
          personnes: corps.passagers,
          prix: { total: 25000 },
          frise: [{ statut: "envoyee", horodatage: new Date().toISOString(), origine: "visiteur" }],
        },
      });
    }

    case "/visiteurs/moi/demandes":
      if (!compteId) return refus401;
      return reponse(
        200,
        { donnees: demandes.filter((d) => d.compteId === compteId) },
      );

    default:
      return reponse(404, { erreur: { code: "INTROUVABLE", message: "Route inconnue." } });
  }
}

/* ───────────────────────────── mise en place ────────────────────────────── */

const envInitial = {
  mock: process.env.NEXT_PUBLIC_API_MOCK,
  apiUrl: process.env.API_URL,
};
const fetchInitial = globalThis.fetch;

process.env.NEXT_PUBLIC_API_MOCK = "false"; // la configuration du site déployé
process.env.API_URL = "http://api-interne:3101";

globalThis.fetch = vi.fn(async (entree: RequestInfo | URL, init?: RequestInit) =>
  fausseApi(String(entree), init),
) as unknown as typeof fetch;

afterAll(() => {
  globalThis.fetch = fetchInitial;
  process.env.NEXT_PUBLIC_API_MOCK = envInitial.mock;
  process.env.API_URL = envInitial.apiUrl;
});

function reinitialiser() {
  bocalCookies.clear();
  jetonsEmis.clear();
  demandes.length = 0;
  redirections.length = 0;
  appels.length = 0;
  compteurOtp = 0;
  vi.resetModules();
}

/** Le jeton actuellement posé dans le cookie de session, s'il y en a un. */
const jetonCourant = () => bocalCookies.get("teranga_visiteur")?.value;

/* ──────────────────────────────── parcours ──────────────────────────────── */

describe("Parcours de connexion", () => {
  beforeEach(reinitialiser);

  it("un code correct ouvre une session portant le jeton émis par l'API", async () => {
    const { demanderCodeOtpAction, seConnecter } = await import("../../src/features/compte/actions");

    const envoi = await demanderCodeOtpAction(COMPTE.email);
    expect(envoi.succes).toBe(true);
    expect(compteurOtp).toBe(1);

    const formulaire = new FormData();
    formulaire.set("identifiant", COMPTE.email);
    formulaire.set("code", CODE_ATTENDU);
    formulaire.set("suite", "/compte/reservations");

    // `seConnecter` termine par `redirect()`, qui lève par conception.
    await expect(seConnecter({}, formulaire)).rejects.toThrow("NEXT_REDIRECT");
    expect(redirections).toContain("/fr/compte/reservations");

    // Le cookie porte un jeton émis, et non l'adresse e-mail saisie.
    const jeton = jetonCourant();
    expect(jeton).toBeDefined();
    expect(jetonsEmis.has(jeton!)).toBe(true);
    expect(jeton).not.toBe(COMPTE.email);
  });

  it("un code faux n'ouvre aucune session et le dit", async () => {
    const { seConnecter } = await import("../../src/features/compte/actions");

    const formulaire = new FormData();
    formulaire.set("identifiant", COMPTE.email);
    formulaire.set("code", "000000");

    const resultat = await seConnecter({}, formulaire);
    expect(resultat.erreur).toBe("code");
    expect(resultat.message).toBeTruthy();
    expect(jetonCourant()).toBeUndefined();
    expect(redirections).toHaveLength(0);
  });

  it("la session est reconnue côté serveur après connexion", async () => {
    const { seConnecter } = await import("../../src/features/compte/actions");
    const { visiteurConnecte } = await import("../../src/features/compte/session");

    const formulaire = new FormData();
    formulaire.set("identifiant", COMPTE.email);
    formulaire.set("code", CODE_ATTENDU);
    await expect(seConnecter({}, formulaire)).rejects.toThrow("NEXT_REDIRECT");

    const visiteur = await visiteurConnecte();
    expect(visiteur?.compteId).toBe(COMPTE.id);
    expect(visiteur?.email).toBe(COMPTE.email);
  });
});

describe("Parcours logement", () => {
  beforeEach(reinitialiser);

  it("réserve avec un code, puis rattache la demande au bon compte", async () => {
    const { creerDemandeLogementAction } = await import("../../src/features/demande/actions");

    const resultat = await creerDemandeLogementAction(
      {
        logementId: "l-002",
        debut: "2026-10-25",
        fin: "2026-11-01",
        personnes: 2,
        code: CODE_ATTENDU,
      },
      "normal",
      { email: COMPTE.email },
    );

    expect(resultat.succes).toBe(true);

    // La demande est en base, rattachée au compte du visiteur — et non à un
    // compte de démonstration partagé.
    expect(demandes).toHaveLength(1);
    expect(demandes[0].compteId).toBe(COMPTE.id);
    expect(demandes[0].offreId).toBe("l-002");

    // Le jeton a bien été transmis à l'API sur la route de création : c'est le
    // maillon qui manquait en production.
    const creation = appels.find((a) => a.chemin === "/demandes/logement");
    expect(creation?.porteur).toBeDefined();
    expect(jetonsEmis.has(creation!.porteur!)).toBe(true);
  });

  it("une session déjà ouverte évite un nouveau code (§B.1)", async () => {
    const { seConnecter } = await import("../../src/features/compte/actions");
    const { creerDemandeLogementAction } = await import("../../src/features/demande/actions");

    const formulaire = new FormData();
    formulaire.set("identifiant", COMPTE.email);
    formulaire.set("code", CODE_ATTENDU);
    await expect(seConnecter({}, formulaire)).rejects.toThrow("NEXT_REDIRECT");

    const otpApresConnexion = compteurOtp;
    const jetonAvant = jetonCourant();

    // Aucun code fourni : la session existante doit suffire.
    const resultat = await creerDemandeLogementAction(
      { logementId: "l-002", debut: "2026-10-25", fin: "2026-11-01", personnes: 2 },
      "normal",
      { email: COMPTE.email },
    );

    expect(resultat.succes).toBe(true);
    expect(demandes[0].compteId).toBe(COMPTE.id);
    // Ni nouveau code demandé, ni nouvelle vérification.
    expect(compteurOtp).toBe(otpApresConnexion);
    expect(appels.filter((a) => a.chemin === "/comptes/otp/verifier")).toHaveLength(1);
    // Et le jeton n'a pas été remplacé en route.
    expect(jetonCourant()).toBe(jetonAvant);
  });

  it("sans session ni code, aucune demande n'est créée et l'échec est explicite", async () => {
    const { creerDemandeLogementAction } = await import("../../src/features/demande/actions");

    const resultat = await creerDemandeLogementAction(
      { logementId: "l-002", debut: "2026-10-25", fin: "2026-11-01", personnes: 2 },
      "normal",
      { email: COMPTE.email },
    );

    expect(resultat.succes).toBe(false);
    if (!resultat.succes) {
      // Une issue nommée, que le formulaire sait afficher — pas un silence.
      expect(resultat.erreur).toBe("code_invalide");
    }
    expect(demandes).toHaveLength(0);
  });

  it("un cookie forgé ne crée aucune réservation", async () => {
    const { creerDemandeLogementAction } = await import("../../src/features/demande/actions");

    for (const forge of ["visiteur-demo", COMPTE.email, "a".repeat(40)]) {
      bocalCookies.set("teranga_visiteur", { value: forge });

      const resultat = await creerDemandeLogementAction(
        { logementId: "l-002", debut: "2026-10-25", fin: "2026-11-01", personnes: 2 },
        "normal",
        { email: COMPTE.email },
      );

      expect(resultat.succes, `cookie « ${forge} »`).toBe(false);
    }

    expect(demandes).toHaveLength(0);
  });

  it("refuse des dates incohérentes avant tout appel réseau", async () => {
    const { creerDemandeLogementAction } = await import("../../src/features/demande/actions");

    const resultat = await creerDemandeLogementAction(
      { logementId: "l-002", debut: "2026-11-01", fin: "2026-10-25", personnes: 2, code: CODE_ATTENDU },
      "normal",
      { email: COMPTE.email },
    );

    expect(resultat.succes).toBe(false);
    if (!resultat.succes) expect(resultat.erreur).toBe("validation");
    expect(demandes).toHaveLength(0);
    expect(appels).toHaveLength(0);
  });
});

describe("Parcours transport", () => {
  beforeEach(reinitialiser);

  it("réserve un trajet et le rattache au bon compte", async () => {
    const { creerDemandeTransportAction } = await import("../../src/features/demande/actions");

    const resultat = await creerDemandeTransportAction(
      {
        vehiculeId: "v-001",
        prestation: "trajet",
        depart: "Aéroport International Blaise Diagne",
        arrivee: "Dakar Plateau",
        quand: new Date(Date.now() + 6 * 3600_000).toISOString(),
        passagers: 2,
        bagages: 2,
        code: CODE_ATTENDU,
      },
      "normal",
      { email: COMPTE.email },
    );

    expect(resultat.succes).toBe(true);
    expect(demandes).toHaveLength(1);
    expect(demandes[0].genre).toBe("vehicule");
    expect(demandes[0].compteId).toBe(COMPTE.id);

    const creation = appels.find((a) => a.chemin === "/demandes/vehicule");
    expect(jetonsEmis.has(creation!.porteur!)).toBe(true);
  });

  it("enchaîne logement puis transport sur la même session, sans nouveau code", async () => {
    const { seConnecter } = await import("../../src/features/compte/actions");
    const { creerDemandeLogementAction, creerDemandeTransportAction } = await import(
      "../../src/features/demande/actions"
    );

    const formulaire = new FormData();
    formulaire.set("identifiant", COMPTE.email);
    formulaire.set("code", CODE_ATTENDU);
    await expect(seConnecter({}, formulaire)).rejects.toThrow("NEXT_REDIRECT");

    const jeton = jetonCourant();
    const otpApresConnexion = compteurOtp;

    const logement = await creerDemandeLogementAction(
      { logementId: "l-002", debut: "2026-10-25", fin: "2026-11-01", personnes: 2 },
      "normal",
      { email: COMPTE.email },
    );
    const transport = await creerDemandeTransportAction(
      {
        vehiculeId: "v-001",
        prestation: "trajet",
        depart: "Aéroport International Blaise Diagne",
        arrivee: "Ngaparou",
        quand: new Date(Date.now() + 6 * 3600_000).toISOString(),
        passagers: 2,
        bagages: 2,
      },
      "normal",
      { email: COMPTE.email },
    );

    expect(logement.succes).toBe(true);
    expect(transport.succes).toBe(true);
    expect(demandes).toHaveLength(2);
    expect(demandes.every((d) => d.compteId === COMPTE.id)).toBe(true);

    // Un seul code sur tout le parcours, et le même jeton du début à la fin.
    expect(compteurOtp).toBe(otpApresConnexion);
    expect(jetonCourant()).toBe(jeton);
  });
});

describe("Parcours consultation des réservations", () => {
  beforeEach(reinitialiser);

  it("liste les réservations du compte connecté, et elles seules", async () => {
    const { seConnecter } = await import("../../src/features/compte/actions");
    const { creerDemandeLogementAction } = await import("../../src/features/demande/actions");
    const { listerDemandes } = await import("../../src/mocks/api");

    const formulaire = new FormData();
    formulaire.set("identifiant", COMPTE.email);
    formulaire.set("code", CODE_ATTENDU);
    await expect(seConnecter({}, formulaire)).rejects.toThrow("NEXT_REDIRECT");

    await creerDemandeLogementAction(
      { logementId: "l-002", debut: "2026-10-25", fin: "2026-11-01", personnes: 2 },
      "normal",
      { email: COMPTE.email },
    );

    const liste = await listerDemandes();
    expect(liste).toHaveLength(1);
    expect(liste[0].reference).toBe(demandes[0].reference);

    // La consultation a bien présenté le jeton : c'est ce qui manquait quand
    // l'espace client affichait « Aucune réservation » à tout le monde.
    const lecture = appels.find((a) => a.chemin === "/visiteurs/moi/demandes");
    expect(jetonsEmis.has(lecture!.porteur!)).toBe(true);
  });

  it("sans session, la consultation échoue au lieu d'afficher une liste vide", async () => {
    const { listerDemandes } = await import("../../src/mocks/api");

    // L'API refuse (401). Le site doit traiter un refus, pas le confondre avec
    // « ce compte n'a aucune réservation » : c'est ce qui a masqué la panne.
    await expect(listerDemandes()).rejects.toThrow();
  });
});
