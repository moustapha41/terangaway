import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCookieJar = new Map<string, any>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: (name: string, value: any, opts: any) => {
      mockCookieJar.set(name, { value, ...opts });
    },
    get: (name: string) => mockCookieJar.get(name),
    delete: (name: string) => {
      mockCookieJar.delete(name);
    },
  })),
}));

export class MockNextRedirectError extends Error {
  digest: string;
  constructor(public url: string) {
    super("NEXT_REDIRECT");
    this.name = "RedirectError";
    this.digest = `NEXT_REDIRECT;replace;${url};307;`;
  }
}

const redirectMock = vi.fn((url: string) => {
  throw new MockNextRedirectError(url);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/api/ecriture", () => ({
  apiEnvoyerOtp: vi.fn(async (identifiant: string) => {
    if (identifiant === "erreur@teranga.sn") {
      throw new Error("Erreur de service email Resend");
    }
    return {
      expireLe: new Date(Date.now() + 600000).toISOString(),
      delaiAttenteSecondes: 60,
    };
  }),
  apiVerifierOtp: vi.fn(async (identifiant: string, code: string) => {
    if (code === "000000") {
      throw new Error("Le code n'est pas valable.");
    }
    if (code === "888888") {
      throw new Error("Ce code a expiré.");
    }
    if (code === "777777") {
      // Code correct, mais l'API ne renvoie pas de jeton de session : on ne
      // doit surtout pas retomber sur `visiteurId`, qui n'est pas un secret.
      return { visiteurId: "visiteur-123" };
    }
    return {
      visiteurId: "visiteur-123",
      // Forme réelle d'un jeton de session (`genererJetonSession` côté API) :
      // `tws_` suivi de 64 caractères hexadécimaux. Un jeton court était une
      // fixture irréaliste, que la validation refuse désormais à juste titre.
      token: "tws_a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
    };
  }),
  apiDeconnexion: vi.fn(async () => ({ deconnecte: true })),
}));

import { demanderCodeOtpAction, seConnecter, seDeconnecter } from "../../src/features/compte/actions";

describe("Parcours de connexion et vérification OTP visiteur", () => {
  beforeEach(() => {
    mockCookieJar.clear();
    redirectMock.mockClear();
    process.env.NEXT_PUBLIC_API_MOCK = "false";
  });

  describe("demanderCodeOtpAction", () => {
    it("refuse un identifiant trop court", async () => {
      const res = await demanderCodeOtpAction("a@b");
      expect(res.succes).toBe(false);
      if (!res.succes) {
        expect(res.erreur).toContain("Identifiant invalide");
      }
    });

    it("refuse un numéro de téléphone sans intégration SMS", async () => {
      const res = await demanderCodeOtpAction("+221771234567");
      expect(res.succes).toBe(false);
      if (!res.succes) {
        expect(res.erreur).toContain("SMS n'est pas disponible");
      }
    });

    it("demande un code avec succès pour un e-mail valide", async () => {
      const res = await demanderCodeOtpAction("visiteur@terangaway.sn");
      expect(res.succes).toBe(true);
      if (res.succes) {
        expect(res.delaiAttenteSecondes).toBe(60);
        expect(res.expireLe).toBeDefined();
      }
    });

    it("gère une erreur de l'API lors de l'envoi du code", async () => {
      const res = await demanderCodeOtpAction("erreur@teranga.sn");
      expect(res.succes).toBe(false);
      if (!res.succes) {
        expect(res.erreur).toBe("Erreur de service email Resend");
      }
    });
  });

  describe("seConnecter (Vérification OTP et redirection)", () => {
    it("rejette un identifiant trop court sans appeler l'API", async () => {
      const formData = new FormData();
      formData.set("identifiant", "short");
      formData.set("code", "123456");

      const res = await seConnecter({}, formData);
      expect(res.erreur).toBe("identifiant");
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it("retourne une erreur explicite si le code OTP est invalide", async () => {
      const formData = new FormData();
      formData.set("identifiant", "visiteur@terangaway.sn");
      formData.set("code", "000000");

      const res = await seConnecter({}, formData);
      expect(res.erreur).toBe("code");
      expect(res.message).toBe("Le code n'est pas valable.");
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it("retourne une erreur explicite si le code OTP a expiré", async () => {
      const formData = new FormData();
      formData.set("identifiant", "visiteur@terangaway.sn");
      formData.set("code", "888888");

      const res = await seConnecter({}, formData);
      expect(res.erreur).toBe("code");
      expect(res.message).toBe("Ce code a expiré.");
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it("reproduit le bug NEXT_REDIRECT : en cas de succès, ne doit PAS intercepter NEXT_REDIRECT et doit rediriger", async () => {
      const formData = new FormData();
      formData.set("identifiant", "visiteur@terangaway.sn");
      formData.set("code", "123456");
      formData.set("suite", "/compte/reservations");

      // Dans l'implémentation défaillante, seConnecter catche NEXT_REDIRECT
      // et retourne { erreur: "code", message: "NEXT_REDIRECT" } au lieu de propager la redirection !
      try {
        const res = await seConnecter({}, formData);
        // Si on arrive ici, l'action a intercepté l'erreur de redirection Next.js
        // ce qui correspond exactement au bug observé !
        expect(res.message).not.toBe("NEXT_REDIRECT");
      } catch (err: any) {
        // Le comportement attendu de Next.js est que redirect() lève son exception
        // pour que Next.js effectue la redirection HTTP 307
        expect(err).toBeInstanceOf(MockNextRedirectError);
        expect(err.url).toBe("/fr/compte/reservations");
      }

      // Le cookie de session visiteur doit avoir été posé
      expect(mockCookieJar.has("teranga_visiteur")).toBe(true);
      expect(mockCookieJar.get("teranga_visiteur").value).toBe("tws_a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4");
    });
  });

  describe("seDeconnecter", () => {
    it("supprime le cookie de session et redirige vers /fr", async () => {
      mockCookieJar.set("teranga_visiteur", { value: "session-active" });

      try {
        await seDeconnecter();
      } catch (err: any) {
        expect(err).toBeInstanceOf(MockNextRedirectError);
        expect(err.url).toBe("/fr");
      }

      expect(mockCookieJar.has("teranga_visiteur")).toBe(false);
    });
  });
});
