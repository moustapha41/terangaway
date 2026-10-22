import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { creerPrismaDeTest } from "../../base-de-donnees/base-de-test.test-utils";
import { ErreurMetier } from "../../commun/erreurs";
import {
  hacherMotDePasse,
  motDePasseAcceptable,
  verifierMotDePasse,
} from "../../commun/securite/hachage";
import { avecPosture, enProduction } from "../../commun/securite/posture.test-utils";
import { DepotComptesPrisma } from "./comptes.prisma";
import { ServiceComptes } from "./comptes.service";

/**
 * Parcours d'inscription, sur PostgreSQL.
 *
 * Le fil conducteur : **l'inscription n'est pas acquise avant la vérification
 * du code**. Le compte existe, il porte son mot de passe, et il reste inactif.
 * C'est ce qui empêche de s'inscrire avec l'adresse de quelqu'un d'autre et
 * d'en obtenir l'accès.
 */
describe("Inscription — compte, mot de passe et vérification", () => {
  let service: ServiceComptes;
  let prisma: PrismaService;
  let depot: DepotComptesPrisma;

  /** Une adresse neuve par test : les tests ne se marchent pas dessus. */
  const adresse = (etiquette: string) =>
    `inscription.${etiquette}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@terangaway.sn`;

  const MOT_DE_PASSE = "un mot de passe assez long";

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    depot = new DepotComptesPrisma(prisma);
    service = new ServiceComptes(depot);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Inscrit une adresse et renvoie le code, en lisant la base plutôt que la réponse. */
  async function inscrireEtLireLeCode(email: string) {
    const resultat = await service.inscrire({ nom: "Rokhaya Seck", email, motDePasse: MOT_DE_PASSE });
    // `codeDemo` n'est présent qu'en mode démo ; les tests tournent avec, mais
    // on vérifie séparément qu'il disparaît hors de ce mode.
    return { resultat, code: resultat.codeDemo! };
  }

  /* ─────────────────────────── Inscription valide ─────────────────────────── */

  it("crée un compte non vérifié, avec mot de passe et sans session", async () => {
    const email = adresse("valide");
    const { resultat } = await inscrireEtLireLeCode(email);

    expect(resultat.email).toBe(email);
    expect(resultat.expireLe).toBeTruthy();

    const compte = await prisma.account.findUnique({ where: { email } });
    expect(compte).not.toBeNull();
    expect(compte!.nom).toBe("Rokhaya Seck");
    // Le point central : pas encore vérifié.
    expect(compte!.estVerifie).toBe(false);
    expect(compte!.verifieLe).toBeNull();
    expect(compte!.motDePasseHash).toBeTruthy();

    // Aucune session n'a été ouverte par l'inscription.
    const sessions = await prisma.session.count({ where: { accountId: compte!.id } });
    expect(sessions).toBe(0);
  });

  it("ne stocke jamais le mot de passe en clair", async () => {
    const email = adresse("hachage");
    await inscrireEtLireLeCode(email);

    const compte = await prisma.account.findUnique({ where: { email } });
    const stocke = compte!.motDePasseHash!;

    expect(stocke).not.toContain(MOT_DE_PASSE);
    expect(stocke.startsWith("scrypt$")).toBe(true);
    // Sel aléatoire : la même phrase ne donne jamais deux fois la même valeur.
    expect(stocke).not.toBe(hacherMotDePasse(MOT_DE_PASSE));
    expect(verifierMotDePasse(MOT_DE_PASSE, stocke)).toBe(true);
    expect(verifierMotDePasse(`${MOT_DE_PASSE} `, stocke)).toBe(false);
  });

  /* ────────────────────────── Inscription invalide ────────────────────────── */

  it("refuse un nom, une adresse ou un mot de passe irrecevables", async () => {
    const base = { nom: "Rokhaya Seck", email: adresse("rejets"), motDePasse: MOT_DE_PASSE };

    const rejets: Array<[string, Parameters<typeof service.inscrire>[0]]> = [
      ["nom vide", { ...base, nom: "" }],
      ["nom d'une lettre", { ...base, nom: "R" }],
      ["adresse sans arobase", { ...base, email: "pas-une-adresse" }],
      ["adresse sans domaine", { ...base, email: "quelquun@" }],
      ["mot de passe vide", { ...base, motDePasse: "" }],
      ["mot de passe de 9 caractères", { ...base, motDePasse: "123456789" }],
      ["mot de passe d'espaces", { ...base, motDePasse: "            " }],
      ["mot de passe démesuré", { ...base, motDePasse: "a".repeat(5000) }],
    ];

    for (const [libelle, entree] of rejets) {
      await expect(service.inscrire(entree), libelle).rejects.toThrow(ErreurMetier);
    }

    expect(motDePasseAcceptable("123456789")).toBe(false);
    expect(motDePasseAcceptable("1234567890")).toBe(true);
  });

  /* ───────────────────────── Adresse déjà utilisée ────────────────────────── */

  it("refuse une adresse déjà inscrite, avec un code distinct", async () => {
    const email = adresse("doublon");
    const { code } = await inscrireEtLireLeCode(email);
    await service.verifierInscription(email, code);

    const erreur = await service
      .inscrire({ nom: "Quelqu'un d'autre", email, motDePasse: "un autre mot de passe" })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(erreur).toBeInstanceOf(ErreurMetier);
    expect((erreur as ErreurMetier).getResponse()).toMatchObject({ code: "EMAIL_DEJA_UTILISE" });

    // Et surtout : le compte n'a pas été réécrit par la seconde tentative.
    const compte = await prisma.account.findUnique({ where: { email } });
    expect(compte!.nom).toBe("Rokhaya Seck");
    expect(verifierMotDePasse(MOT_DE_PASSE, compte!.motDePasseHash)).toBe(true);
  });

  it("laisse réécrire une inscription en attente : le titulaire gagne la course", async () => {
    const email = adresse("attente");

    // Quelqu'un ouvre une inscription sur une adresse qui n'est pas la sienne.
    await service.inscrire({ nom: "Intrus", email, motDePasse: "mot de passe de l intrus" });

    // Le délai minimal entre deux envois s'applique : on l'écarte.
    await prisma.otpChallenge.updateMany({
      where: { destination: email },
      data: { creeLe: new Date(Date.now() - 120_000) },
    });

    // Le titulaire reprend l'inscription. Refuser ici lui bloquerait son
    // adresse pour de bon, au bénéfice de personne.
    const { code } = await inscrireEtLireLeCode(email);
    const session = await service.verifierInscription(email, code);

    expect(session.token).toBeTruthy();
    const compte = await prisma.account.findUnique({ where: { email } });
    expect(compte!.nom).toBe("Rokhaya Seck");
    expect(compte!.estVerifie).toBe(true);
    // Et le mot de passe en place est celui du titulaire, pas celui de l'intrus.
    expect(verifierMotDePasse(MOT_DE_PASSE, compte!.motDePasseHash)).toBe(true);
    expect(verifierMotDePasse("mot de passe de l intrus", compte!.motDePasseHash)).toBe(false);
  });

  it("refuse une inscription sur un compte déjà vérifié", async () => {
    const email = adresse("verifie-doublon");
    const { code } = await inscrireEtLireLeCode(email);
    await service.verifierInscription(email, code);

    // Vérifié : c'est un vrai doublon, et il ne se laisse pas réécrire.
    await expect(
      service.inscrire({ nom: "Intrus", email, motDePasse: "mot de passe de l intrus" }),
    ).rejects.toThrow(ErreurMetier);
  });

  it("laisse s'inscrire sur une adresse qui n'a servi qu'à demander un code", async () => {
    const email = adresse("coquille");

    // `envoyerOtp` crée un compte non vérifié et sans mot de passe. Cette
    // coquille ne doit pas bloquer à vie l'adresse de son titulaire.
    await service.envoyerOtp(email);
    const avant = await prisma.account.findUnique({ where: { email } });
    expect(avant).not.toBeNull();
    expect(avant!.motDePasseHash).toBeNull();

    // Le délai minimal de 60 secondes entre deux envois s'applique aussi ici :
    // on recule le challenge plutôt que d'attendre une minute.
    await prisma.otpChallenge.updateMany({
      where: { destination: email },
      data: { creeLe: new Date(Date.now() - 120_000) },
    });

    const { code } = await inscrireEtLireLeCode(email);
    const session = await service.verifierInscription(email, code);
    expect(session.token).toBeTruthy();

    const apres = await prisma.account.findUnique({ where: { email } });
    expect(apres!.id).toBe(avant!.id); // même compte, complété
    expect(apres!.estVerifie).toBe(true);
  });

  /* ──────────────────────────── Vérification OTP ──────────────────────────── */

  it("active le compte et ouvre une session sur un code valide", async () => {
    const email = adresse("code-valide");
    const { code } = await inscrireEtLireLeCode(email);

    const resultat = await service.verifierInscription(email, code);

    expect(resultat.token).toBeTruthy();
    expect(resultat.token!.startsWith("tws_")).toBe(true);
    expect(resultat.compte.estVerifie).toBe(true);
    // L'empreinte du mot de passe ne sort pas du dépôt.
    expect(JSON.stringify(resultat.compte)).not.toContain("scrypt$");

    const compte = await prisma.account.findUnique({ where: { email } });
    expect(compte!.estVerifie).toBe(true);
    expect(compte!.verifieLe).not.toBeNull();

    // La session est bien celle de ce compte, et le jeton n'est pas stocké en clair.
    const session = await prisma.session.findFirst({ where: { accountId: compte!.id } });
    expect(session).not.toBeNull();
    expect(session!.tokenHash).not.toBe(resultat.token);
    await expect(service.exigerVisiteur(resultat.token)).resolves.toBe(compte!.id);
  });

  it("refuse un code invalide sans activer le compte", async () => {
    const email = adresse("code-faux");
    await inscrireEtLireLeCode(email);

    await expect(service.verifierInscription(email, "000000")).rejects.toThrow(ErreurMetier);

    const compte = await prisma.account.findUnique({ where: { email } });
    expect(compte!.estVerifie).toBe(false);
    expect(await prisma.session.count({ where: { accountId: compte!.id } })).toBe(0);
  });

  it("refuse un code expiré", async () => {
    const email = adresse("code-expire");
    const { code } = await inscrireEtLireLeCode(email);

    await prisma.otpChallenge.updateMany({
      where: { destination: email, consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const erreur = await service
      .verifierInscription(email, code)
      .then(() => null)
      .catch((e: unknown) => e);
    expect((erreur as ErreurMetier).getResponse()).toMatchObject({ code: "CODE_EXPIRE" });

    const compte = await prisma.account.findUnique({ where: { email } });
    expect(compte!.estVerifie).toBe(false);
  });

  it("refuse un code déjà utilisé : usage unique", async () => {
    const email = adresse("code-rejoue");
    const { code } = await inscrireEtLireLeCode(email);

    await service.verifierInscription(email, code);
    // Rejouer le même code ne doit pas ouvrir une seconde session.
    await expect(service.verifierInscription(email, code)).rejects.toThrow(ErreurMetier);

    const compte = await prisma.account.findUnique({ where: { email } });
    expect(await prisma.session.count({ where: { accountId: compte!.id } })).toBe(1);
  });

  it("plafonne les tentatives sur un même code", async () => {
    const email = adresse("tentatives");
    const { code } = await inscrireEtLireLeCode(email);

    for (let essai = 0; essai < 5; essai += 1) {
      await expect(service.verifierInscription(email, "111111")).rejects.toThrow(ErreurMetier);
    }

    // Au-delà du plafond, le bon code lui-même ne passe plus : le challenge est
    // consommé, il faut en demander un nouveau.
    await expect(service.verifierInscription(email, code)).rejects.toThrow(ErreurMetier);

    const compte = await prisma.account.findUnique({ where: { email } });
    expect(compte!.estVerifie).toBe(false);
  });

  it("refuse la vérification d'une adresse sans inscription en attente", async () => {
    const erreur = await service
      .verifierInscription(adresse("inconnue"), "123456")
      .then(() => null)
      .catch((e: unknown) => e);
    expect((erreur as ErreurMetier).getResponse()).toMatchObject({ code: "INSCRIPTION_INTROUVABLE" });
  });

  /* ─────────────────── Cloisonnement des finalités de code ────────────────── */

  it("n'accepte pas un code d'inscription sur la route de connexion", async () => {
    const email = adresse("cloisonnement");
    const { code } = await inscrireEtLireLeCode(email);

    // `verifierOtp` est la connexion par code : un code émis pour une
    // inscription n'y a pas cours.
    await expect(service.verifierOtp(email, code)).rejects.toThrow(ErreurMetier);

    // Et il reste valable pour ce à quoi il sert.
    await expect(service.verifierInscription(email, code)).resolves.toMatchObject({
      compte: { estVerifie: true },
    });
  });

  /* ──────────────────────────── Renvoi du code ───────────────────────────── */

  it("renvoie un code, et l'ancien cesse de valoir", async () => {
    const email = adresse("renvoi");
    const { code: premier } = await inscrireEtLireLeCode(email);

    // Le délai minimal entre deux envois est de 60 secondes : on l'écarte en
    // reculant le challenge, plutôt que d'attendre une minute dans un test.
    await prisma.otpChallenge.updateMany({
      where: { destination: email },
      data: { creeLe: new Date(Date.now() - 120_000) },
    });

    const renvoi = await service.renvoyerCodeInscription(email);
    const second = renvoi.codeDemo!;
    expect(second).toBeTruthy();

    // Un nouveau code invalide le précédent : sinon deux codes vivraient en
    // parallèle, et le plus ancien resterait exploitable.
    await expect(service.verifierInscription(email, premier)).rejects.toThrow(ErreurMetier);
    await expect(service.verifierInscription(email, second)).resolves.toMatchObject({
      compte: { estVerifie: true },
    });
  });

  it("applique la limitation de débit au renvoi", async () => {
    const email = adresse("renvoi-limite");
    await inscrireEtLireLeCode(email);

    const erreur = await service
      .renvoyerCodeInscription(email)
      .then(() => null)
      .catch((e: unknown) => e);

    expect(erreur).toBeInstanceOf(ErreurMetier);
    expect((erreur as ErreurMetier).getResponse()).toMatchObject({ code: "DELAI_ATTENTE" });
  });

  /* ──────────────────────── Le code ne fuite jamais ──────────────────────── */

  it("ne renvoie pas le code d'inscription hors mode démo", async () => {
    await enProduction(async () => {
      const resultat = await service.inscrire({
        nom: "Rokhaya Seck",
        email: adresse("sans-fuite"),
        motDePasse: MOT_DE_PASSE,
      });
      expect(resultat.codeDemo).toBeUndefined();
      expect(Object.keys(resultat)).not.toContain("codeDemo");
      // Et rien qui ressemble à un code à six chiffres dans la réponse.
      expect(JSON.stringify(resultat)).not.toMatch(/\b\d{6}\b/);
    });
  });

  it("ne renvoie pas le code au renvoi hors mode démo", async () => {
    const email = adresse("renvoi-sans-fuite");
    await inscrireEtLireLeCode(email);
    await prisma.otpChallenge.updateMany({
      where: { destination: email },
      data: { creeLe: new Date(Date.now() - 120_000) },
    });

    await avecPosture({ comptesDemo: false, environnement: "development" }, async () => {
      const renvoi = await service.renvoyerCodeInscription(email);
      expect(renvoi.codeDemo).toBeUndefined();
    });
  });

  it("stocke l'empreinte du code, jamais le code", async () => {
    const email = adresse("empreinte-code");
    const { code } = await inscrireEtLireLeCode(email);

    const challenge = await prisma.otpChallenge.findFirst({
      where: { destination: email, consumedAt: null },
      orderBy: { creeLe: "desc" },
    });
    expect(challenge!.finalite).toBe("inscription");
    expect(challenge!.codeHash).toHaveLength(64);
    expect(challenge!.codeHash).not.toBe(code);
    expect(challenge!.codeHash).not.toContain(code);
  });
});
