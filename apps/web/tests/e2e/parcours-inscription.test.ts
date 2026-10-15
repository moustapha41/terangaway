import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

/**
 * Inscription de bout en bout, en processus.
 *
 * Toute la chaîne est traversée — Server Action, cookies, `appelerApi`, jusqu'à
 * `fetch` — contre une fausse API qui applique les règles de la vraie.
 *
 * Les deux affirmations que ce fichier vérifie, et qui sont le cœur du
 * parcours :
 *
 *   1. **Aucune session n'existe avant la vérification du code.** Sans cela,
 *      s'inscrire avec l'adresse de quelqu'un d'autre suffirait à entrer.
 *   2. **La demande en cours de saisie survit au détour par l'inscription.**
 *      Sans cela, le visiteur revient devant un formulaire vide après avoir
 *      choisi ses dates, ses voyageurs et écrit son message.
 *
 * Ce n'est pas un test navigateur : rien ici ne dit du rendu ni des erreurs de
 * console.
 */

/* ────────────────────────── le navigateur simulé ────────────────────────── */

const bocal = new Map<string, { value: string } & Record<string, unknown>>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: (nom: string, valeur: string, opts: Record<string, unknown>) => {
      bocal.set(nom, { value: valeur, ...opts });
    },
    get: (nom: string) => bocal.get(nom),
    delete: (nom: string) => {
      bocal.delete(nom);
    },
  })),
  headers: vi.fn(async () => new Map([["x-forwarded-for", "41.82.0.1"]])),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

class Redirection extends Error {
  digest: string;
  constructor(public url: string) {
    super("NEXT_REDIRECT");
    this.digest = `NEXT_REDIRECT;replace;${url};307;`;
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirection(url);
  },
}));

/** Lit l'URL d'une redirection, ou `null` si l'action a rendu un état. */
async function redirigeVers(promesse: Promise<unknown>): Promise<string | null> {
  try {
    await promesse;
    return null;
  } catch (err) {
    if (err instanceof Redirection) return err.url;
    throw err;
  }
}

/* ───────────────────────────── la fausse API ────────────────────────────── */

const EMAIL = "rokhaya.seck@exemple.sn";
const MOT_DE_PASSE = "un mot de passe assez long";
const CODE = "481502";

interface CompteFaux {
  id: string;
  email: string;
  nom: string;
  motDePasse: string;
  estVerifie: boolean;
}

const comptes = new Map<string, CompteFaux>();
const jetonsEmis = new Set<string>();
const demandes: { reference: string; compteId: string; offreId: string }[] = [];
/** Les codes en attente, par adresse. Jamais renvoyés au client. */
const codes = new Map<string, string>();
let envois = 0;
const appels: { chemin: string; porteur?: string; corps?: Record<string, unknown> }[] = [];

function emettreJeton(): string {
  const jeton = `tws_${"0".repeat(60)}${(jetonsEmis.size + 1).toString().padStart(4, "0")}`;
  jetonsEmis.add(jeton);
  return jeton;
}

function reponse(statut: number, corps: unknown) {
  return { ok: statut >= 200 && statut < 300, status: statut, json: async () => corps } as Response;
}
const erreur = (code: string, message: string, statut: number) =>
  reponse(statut, { erreur: { code, message } });

function porteurDe(entetes: Record<string, string>): string | undefined {
  const auth = entetes["authorization"] ?? entetes["Authorization"];
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  return entetes["x-visiteur-id"];
}

function fausseApi(url: string, init?: RequestInit): Response {
  const chemin = new URL(url).pathname;
  const entetes = (init?.headers ?? {}) as Record<string, string>;
  const corps = (init?.body ? JSON.parse(String(init.body)) : {}) as Record<string, unknown>;
  const jeton = porteurDe(entetes);
  appels.push({ chemin, porteur: jeton, corps });

  const compteDuJeton = jeton && jetonsEmis.has(jeton) ? comptes.get(EMAIL) : undefined;

  switch (chemin) {
    case "/comptes/inscription": {
      const email = String(corps.email ?? "").toLowerCase();
      // Même règle que la vraie API : **seul un compte vérifié** est un
      // doublon. Une inscription en attente se laisse réécrire, sinon
      // s'inscrire le premier avec l'adresse d'un autre la lui bloquerait.
      if (comptes.get(email)?.estVerifie) {
        return erreur("EMAIL_DEJA_UTILISE", "Un compte existe déjà avec cette adresse.", 409);
      }
      comptes.set(email, {
        id: `cmp_${email}`,
        email,
        nom: String(corps.nom ?? ""),
        motDePasse: String(corps.motDePasse ?? ""),
        // Le point qui compte : pas encore vérifié.
        estVerifie: false,
      });
      codes.set(email, CODE);
      envois += 1;
      return reponse(201, {
        donnees: {
          email,
          expireLe: new Date(Date.now() + 600_000).toISOString(),
          delaiAttenteSecondes: 60,
        },
      });
    }

    case "/comptes/inscription/verifier": {
      const email = String(corps.email ?? "").toLowerCase();
      const compte = comptes.get(email);
      if (!compte) return erreur("INSCRIPTION_INTROUVABLE", "Aucune inscription.", 404);
      if (codes.get(email) !== corps.code) {
        return erreur("CODE_INVALIDE", "Le code n'est pas valable.", 401);
      }
      // Usage unique.
      codes.delete(email);
      compte.estVerifie = true;
      return reponse(200, {
        donnees: {
          visiteurId: compte.id,
          token: emettreJeton(),
          compte: {
            id: compte.id,
            email: compte.email,
            nom: compte.nom,
            estVerifie: true,
            aUnMotDePasse: true,
          },
        },
      });
    }

    case "/comptes/inscription/renvoyer": {
      const email = String(corps.email ?? "").toLowerCase();
      if (!comptes.has(email)) return erreur("INSCRIPTION_INTROUVABLE", "Aucune inscription.", 404);
      codes.set(email, CODE);
      envois += 1;
      return reponse(200, {
        donnees: {
          expireLe: new Date(Date.now() + 600_000).toISOString(),
          delaiAttenteSecondes: 60,
        },
      });
    }

    case "/comptes/connexion": {
      const email = String(corps.email ?? "").toLowerCase();
      const compte = comptes.get(email);
      if (!compte || compte.motDePasse !== corps.motDePasse) {
        return erreur("IDENTIFIANTS_INVALIDES", "L'adresse ou le mot de passe ne correspond pas.", 401);
      }
      if (!compte.estVerifie) {
        return erreur("COMPTE_NON_VERIFIE", "Adresse non confirmée.", 403);
      }
      return reponse(200, {
        donnees: {
          visiteurId: compte.id,
          token: emettreJeton(),
          compte: {
            id: compte.id,
            email: compte.email,
            nom: compte.nom,
            estVerifie: true,
            aUnMotDePasse: true,
          },
        },
      });
    }

    case "/comptes/session":
      if (!compteDuJeton) return erreur("NON_AUTHENTIFIE", "Session invalide.", 401);
      return reponse(200, {
        donnees: {
          visiteur: {
            compteId: compteDuJeton.id,
            email: compteDuJeton.email,
            telephone: null,
            token: jeton,
          },
        },
      });

    case "/demandes/logement": {
      if (!compteDuJeton) return erreur("NON_AUTHENTIFIE", "Session invalide.", 401);
      const reference = `TW-L${(demandes.length + 1).toString().padStart(5, "0")}`;
      demandes.push({
        reference,
        compteId: compteDuJeton.id,
        offreId: String(corps.logementId ?? ""),
      });
      return reponse(201, {
        donnees: {
          id: `d-${reference}`,
          reference,
          statut: "envoyee",
          offre: { genre: "logement", logementId: corps.logementId, titre: "Logement" },
          dates: { debut: corps.debut, fin: corps.fin },
          personnes: corps.personnes,
          message: corps.message,
          prix: { prixParNuit: 125000, nuits: 7, fraisFixes: [], total: 875000 },
          frise: [{ statut: "envoyee", horodatage: new Date().toISOString(), origine: "visiteur" }],
        },
      });
    }

    case "/visiteurs/moi/demandes":
      if (!compteDuJeton) return erreur("NON_AUTHENTIFIE", "Session invalide.", 401);
      return reponse(200, {
        donnees: demandes.filter((d) => d.compteId === compteDuJeton.id),
      });

    default:
      return erreur("INTROUVABLE", "Route inconnue.", 404);
  }
}

/* ───────────────────────────── mise en place ────────────────────────────── */

const envInitial = { mock: process.env.NEXT_PUBLIC_API_MOCK, api: process.env.API_URL };
const fetchInitial = globalThis.fetch;

process.env.NEXT_PUBLIC_API_MOCK = "false";
process.env.API_URL = "http://api-interne:3101";
globalThis.fetch = vi.fn(async (entree: RequestInfo | URL, init?: RequestInit) =>
  fausseApi(String(entree), init),
) as unknown as typeof fetch;

afterAll(() => {
  globalThis.fetch = fetchInitial;
  process.env.NEXT_PUBLIC_API_MOCK = envInitial.mock;
  process.env.API_URL = envInitial.api;
});

function reinitialiser() {
  bocal.clear();
  comptes.clear();
  codes.clear();
  jetonsEmis.clear();
  demandes.length = 0;
  appels.length = 0;
  envois = 0;
  vi.resetModules();
}

const jetonCourant = () => bocal.get("teranga_visiteur")?.value;

function formulaire(champs: Record<string, string>): FormData {
  const data = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) data.set(cle, valeur);
  return data;
}

const CHAMPS_INSCRIPTION = {
  nom: "Rokhaya Seck",
  email: EMAIL,
  motDePasse: MOT_DE_PASSE,
  confirmation: MOT_DE_PASSE,
  langue: "fr",
};

/* ──────────────────────────────── parcours ──────────────────────────────── */

describe("Parcours d'inscription complet", () => {
  beforeEach(reinitialiser);

  it("inscrit, vérifie, puis ouvre une session exploitable", async () => {
    const { inscrireAction, verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    const { visiteurConnecte } = await import("../../src/features/compte/session");

    // 1. Inscription : aucune session.
    const versVerification = await redirigeVers(inscrireAction({}, formulaire(CHAMPS_INSCRIPTION)));
    expect(versVerification).toBe("/fr/inscription/verification");
    expect(jetonCourant()).toBeUndefined();
    expect(await visiteurConnecte()).toBeNull();
    expect(comptes.get(EMAIL)!.estVerifie).toBe(false);
    expect(envois).toBe(1);

    // 2. Vérification : la session s'ouvre.
    const apresVerif = await redirigeVers(
      verifierInscriptionAction({}, formulaire({ code: CODE, langue: "fr" })),
    );
    expect(apresVerif).toBe("/fr/compte");

    const jeton = jetonCourant();
    expect(jeton).toBeDefined();
    expect(jetonsEmis.has(jeton!)).toBe(true);
    // Le cookie ne porte pas l'adresse, mais un jeton émis par l'API.
    expect(jeton).not.toBe(EMAIL);

    // 3. La session est reconnue côté serveur.
    const visiteur = await visiteurConnecte();
    expect(visiteur?.email).toBe(EMAIL);
    expect(comptes.get(EMAIL)!.estVerifie).toBe(true);
  });

  it("le mot de passe ne circule qu'à l'inscription, et jamais dans un cookie", async () => {
    const { inscrireAction, verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );

    await redirigeVers(inscrireAction({}, formulaire(CHAMPS_INSCRIPTION)));
    await redirigeVers(verifierInscriptionAction({}, formulaire({ code: CODE, langue: "fr" })));

    // Un seul appel réseau a vu le mot de passe : la création du compte.
    const vus = appels.filter((a) => JSON.stringify(a.corps ?? {}).includes(MOT_DE_PASSE));
    expect(vus).toHaveLength(1);
    expect(vus[0].chemin).toBe("/comptes/inscription");

    // Et aucun cookie ne le contient, encodé ou non.
    for (const [, cookie] of bocal) {
      const brut = String(cookie.value);
      expect(brut).not.toContain(MOT_DE_PASSE);
      const decode = Buffer.from(brut, "base64url").toString("utf-8");
      expect(decode).not.toContain(MOT_DE_PASSE);
    }
  });

  it("refuse un code faux, puis accepte le bon", async () => {
    const { inscrireAction, verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    await redirigeVers(inscrireAction({}, formulaire(CHAMPS_INSCRIPTION)));

    const etat = await verifierInscriptionAction({}, formulaire({ code: "000000", langue: "fr" }));
    expect(etat.erreur).toBe("code");
    expect(jetonCourant()).toBeUndefined();
    expect(comptes.get(EMAIL)!.estVerifie).toBe(false);

    await redirigeVers(verifierInscriptionAction({}, formulaire({ code: CODE, langue: "fr" })));
    expect(jetonCourant()).toBeDefined();
  });

  it("n'accepte pas deux fois le même code", async () => {
    const { inscrireAction, verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    await redirigeVers(inscrireAction({}, formulaire(CHAMPS_INSCRIPTION)));
    await redirigeVers(verifierInscriptionAction({}, formulaire({ code: CODE, langue: "fr" })));

    // L'attente a été effacée : il n'y a plus rien à vérifier.
    const etat = await verifierInscriptionAction({}, formulaire({ code: CODE, langue: "fr" }));
    expect(etat.erreur).toBe("introuvable");
  });

  it("refuse une seconde inscription sur la même adresse", async () => {
    const { inscrireAction, verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    await redirigeVers(inscrireAction({}, formulaire(CHAMPS_INSCRIPTION)));
    await redirigeVers(verifierInscriptionAction({}, formulaire({ code: CODE, langue: "fr" })));

    bocal.delete("teranga_visiteur");
    const etat = await inscrireAction(
      {},
      formulaire({ ...CHAMPS_INSCRIPTION, nom: "Quelqu'un d'autre" }),
    );

    expect(etat.dejaInscrit).toBe(true);
    // Le compte n'a pas été réécrit.
    expect(comptes.get(EMAIL)!.nom).toBe("Rokhaya Seck");
  });

  it("laisse le titulaire reprendre une inscription ouverte par quelqu'un d'autre", async () => {
    const { inscrireAction, verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );

    // Quelqu'un ouvre une inscription sur une adresse qui n'est pas la sienne.
    await redirigeVers(
      inscrireAction(
        {},
        formulaire({
          ...CHAMPS_INSCRIPTION,
          nom: "Intrus",
          motDePasse: "mot de passe de l intrus",
          confirmation: "mot de passe de l intrus",
        }),
      ),
    );
    bocal.clear();

    // Le titulaire reprend : l'inscription en attente se laisse réécrire.
    const url = await redirigeVers(inscrireAction({}, formulaire(CHAMPS_INSCRIPTION)));
    expect(url).toBe("/fr/inscription/verification");

    await redirigeVers(verifierInscriptionAction({}, formulaire({ code: CODE, langue: "fr" })));
    expect(jetonCourant()).toBeDefined();
    // C'est bien son compte, avec son nom et son mot de passe.
    expect(comptes.get(EMAIL)!.nom).toBe("Rokhaya Seck");
    expect(comptes.get(EMAIL)!.motDePasse).toBe(MOT_DE_PASSE);
  });

  it("renvoie un code puis vérifie avec le nouveau", async () => {
    const { inscrireAction, renvoyerCodeInscriptionAction, verifierInscriptionAction } =
      await import("../../src/features/compte/inscription-actions");
    await redirigeVers(inscrireAction({}, formulaire(CHAMPS_INSCRIPTION)));

    const renvoi = await renvoyerCodeInscriptionAction();
    expect(renvoi.succes).toBe(true);
    expect(envois).toBe(2);

    await redirigeVers(verifierInscriptionAction({}, formulaire({ code: CODE, langue: "fr" })));
    expect(jetonCourant()).toBeDefined();
  });

  it("refuse de renvoyer sans inscription en attente", async () => {
    const { renvoyerCodeInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    const resultat = await renvoyerCodeInscriptionAction();
    expect(resultat.succes).toBe(false);
    expect(envois).toBe(0);
  });

  it("permet de repartir corriger l'adresse", async () => {
    const { inscrireAction, abandonnerInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    await redirigeVers(inscrireAction({}, formulaire(CHAMPS_INSCRIPTION)));
    expect(bocal.has("teranga_inscription")).toBe(true);

    const url = await redirigeVers(abandonnerInscriptionAction("fr"));
    expect(url).toBe("/fr/inscription");
    // L'attente est oubliée : la page de vérification ne s'ouvrira plus.
    expect(bocal.has("teranga_inscription")).toBe(false);
  });
});

describe("Connexion par mot de passe, après inscription", () => {
  beforeEach(reinitialiser);

  /** Inscrit et vérifie, puis repart déconnecté. */
  async function compteActifPuisDeconnecte() {
    const { inscrireAction, verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    await redirigeVers(inscrireAction({}, formulaire(CHAMPS_INSCRIPTION)));
    await redirigeVers(verifierInscriptionAction({}, formulaire({ code: CODE, langue: "fr" })));
    bocal.clear();
  }

  it("ouvre une session avec le mot de passe choisi à l'inscription", async () => {
    await compteActifPuisDeconnecte();
    const { connexionMotDePasseAction } = await import(
      "../../src/features/compte/inscription-actions"
    );

    const url = await redirigeVers(
      connexionMotDePasseAction(
        {},
        formulaire({ email: EMAIL, motDePasse: MOT_DE_PASSE, suite: "/compte/reservations", langue: "fr" }),
      ),
    );

    expect(url).toBe("/fr/compte/reservations");
    expect(jetonsEmis.has(jetonCourant()!)).toBe(true);
  });

  it("refuse un mauvais mot de passe", async () => {
    await compteActifPuisDeconnecte();
    const { connexionMotDePasseAction } = await import(
      "../../src/features/compte/inscription-actions"
    );

    const etat = await connexionMotDePasseAction(
      {},
      formulaire({ email: EMAIL, motDePasse: "ce n est pas le bon", langue: "fr" }),
    );

    expect(etat.erreur).toBe("identifiants");
    expect(jetonCourant()).toBeUndefined();
  });

  it("refuse un compte dont l'adresse n'est pas confirmée", async () => {
    const { inscrireAction, connexionMotDePasseAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    await redirigeVers(inscrireAction({}, formulaire(CHAMPS_INSCRIPTION)));
    bocal.clear();

    const etat = await connexionMotDePasseAction(
      {},
      formulaire({ email: EMAIL, motDePasse: MOT_DE_PASSE, langue: "fr" }),
    );

    expect(etat.erreur).toBe("non_verifie");
    expect(jetonCourant()).toBeUndefined();
  });
});

describe("Reprise d'une demande après inscription", () => {
  beforeEach(reinitialiser);

  it("retrouve la saisie du logement et envoie sans nouveau code", async () => {
    const { mettreDemandeDeCoteEtSInscrire, creerDemandeLogementAction } = await import(
      "../../src/features/demande/actions"
    );
    const { inscrireAction, verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    const { lireBrouillonLogement } = await import("../../src/features/demande/brouillon");

    // 1. La saisie est mise de côté, et on part s'inscrire.
    const versInscription = await redirigeVers(
      mettreDemandeDeCoteEtSInscrire(
        {
          genre: "logement",
          logementId: "l-002",
          debut: "2026-10-25",
          fin: "2026-11-01",
          personnes: 4,
          nom: "Rokhaya Seck",
          email: EMAIL,
          telephone: "+221770000001",
          message: "Arrivée tardive, vers 23 h.",
        },
        "/demande/l-002?debut=2026-10-25&fin=2026-11-01&personnes=4",
        "fr",
      ),
    );
    expect(versInscription).toContain("/fr/inscription?suite=");

    // 2. Inscription puis vérification. La destination revient au tunnel.
    const suite = decodeURIComponent(new URL(versInscription!, "https://x").searchParams.get("suite")!);
    await redirigeVers(inscrireAction({}, formulaire({ ...CHAMPS_INSCRIPTION, suite })));
    const retour = await redirigeVers(
      verifierInscriptionAction({}, formulaire({ code: CODE, langue: "fr" })),
    );
    expect(retour).toBe("/fr/demande/l-002?debut=2026-10-25&fin=2026-11-01&personnes=4");

    // 3. La saisie est intacte — c'est l'affirmation qui compte.
    const brouillon = await lireBrouillonLogement("l-002");
    expect(brouillon).not.toBeNull();
    expect(brouillon!.personnes).toBe(4);
    expect(brouillon!.message).toBe("Arrivée tardive, vers 23 h.");
    expect(brouillon!.telephone).toBe("+221770000001");

    // 4. La demande part sans nouveau code, sur la session ouverte.
    const envoisAvant = envois;
    const resultat = await creerDemandeLogementAction(
      {
        logementId: brouillon!.logementId,
        debut: brouillon!.debut,
        fin: brouillon!.fin,
        personnes: brouillon!.personnes,
        message: brouillon!.message,
      },
      "normal",
      { email: EMAIL },
    );

    expect(resultat.succes).toBe(true);
    expect(envois).toBe(envoisAvant); // aucun code supplémentaire
    expect(demandes).toHaveLength(1);
    // Rattachée au compte réellement créé, pas à un compte de démonstration.
    expect(demandes[0].compteId).toBe(`cmp_${EMAIL}`);
    expect(demandes[0].offreId).toBe("l-002");
  });

  it("ne prérempli pas une autre offre avec le brouillon", async () => {
    const { mettreDemandeDeCoteEtSInscrire } = await import("../../src/features/demande/actions");
    const { lireBrouillonLogement, lireBrouillonTransport } = await import(
      "../../src/features/demande/brouillon"
    );

    await redirigeVers(
      mettreDemandeDeCoteEtSInscrire(
        {
          genre: "logement",
          logementId: "l-002",
          debut: "2026-10-25",
          fin: "2026-11-01",
          personnes: 2,
        },
        "/demande/l-002",
        "fr",
      ),
    );

    // Revenir sur une autre fiche ne doit rien préremplir.
    expect(await lireBrouillonLogement("l-007")).toBeNull();
    expect(await lireBrouillonTransport("v-001")).toBeNull();
    expect(await lireBrouillonLogement("l-002")).not.toBeNull();
  });

  it("garde la saisie d'un transport à travers l'inscription", async () => {
    const { mettreDemandeDeCoteEtSInscrire } = await import("../../src/features/demande/actions");
    const { lireBrouillonTransport } = await import("../../src/features/demande/brouillon");

    await redirigeVers(
      mettreDemandeDeCoteEtSInscrire(
        {
          genre: "vehicule",
          vehiculeId: "v-001",
          prestation: "trajet",
          depart: "Aéroport International Blaise Diagne",
          arrivee: "Ngaparou",
          quand: "2026-10-25T14:00",
          passagers: 3,
          bagages: 4,
          vol: "AF718",
          message: "Deux sièges enfant si possible.",
        },
        "/demande/v-001",
        "fr",
      ),
    );

    const brouillon = await lireBrouillonTransport("v-001");
    expect(brouillon).not.toBeNull();
    expect(brouillon!.prestation).toBe("trajet");
    expect(brouillon!.passagers).toBe(3);
    expect(brouillon!.bagages).toBe(4);
    expect(brouillon!.vol).toBe("AF718");
    expect(brouillon!.message).toBe("Deux sièges enfant si possible.");
  });

  it("ignore un brouillon forgé dont le genre est inconnu", async () => {
    const { lireBrouillon } = await import("../../src/features/demande/brouillon");

    // Le cookie est httpOnly, mais quelqu'un contrôle son propre navigateur :
    // sa forme n'est pas une garantie et chaque champ est retypé.
    for (const charge of [
      { genre: "autre", logementId: "l-002" },
      { genre: "logement" },
      { genre: "logement", logementId: "l-002", debut: "2026-10-25" },
      "pas du json",
    ]) {
      bocal.set("teranga_brouillon_demande", {
        value: Buffer.from(
          typeof charge === "string" ? charge : JSON.stringify(charge),
          "utf-8",
        ).toString("base64url"),
      });
      expect(await lireBrouillon()).toBeNull();
    }
  });

  it("borne les valeurs d'un brouillon démesuré", async () => {
    const { lireBrouillonLogement } = await import("../../src/features/demande/brouillon");

    bocal.set("teranga_brouillon_demande", {
      value: Buffer.from(
        JSON.stringify({
          genre: "logement",
          logementId: "l-002",
          debut: "2026-10-25",
          fin: "2026-11-01",
          personnes: 99999,
          message: "x".repeat(100_000),
        }),
        "utf-8",
      ).toString("base64url"),
    });

    const brouillon = await lireBrouillonLogement("l-002");
    expect(brouillon!.personnes).toBeLessThanOrEqual(50);
    expect(brouillon!.message!.length).toBeLessThanOrEqual(2000);
  });
});
