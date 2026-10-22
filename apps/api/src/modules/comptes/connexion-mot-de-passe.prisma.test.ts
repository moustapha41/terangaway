import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { creerPrismaDeTest } from "../../base-de-donnees/base-de-test.test-utils";
import { ErreurMetier } from "../../commun/erreurs";
import { LimiteurTentatives } from "../../commun/securite/limiteur-tentatives";
import { DepotComptesPrisma } from "./comptes.prisma";
import { ServiceComptes } from "./comptes.service";

const MOT_DE_PASSE = "un mot de passe assez long";

const codeDe = (erreur: unknown) => (erreur as ErreurMetier).getResponse();

describe("Connexion par mot de passe", () => {
  let service: ServiceComptes;
  let prisma: PrismaService;

  const adresse = (etiquette: string) =>
    `connexion.${etiquette}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@terangaway.sn`;

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    service = new ServiceComptes(new DepotComptesPrisma(prisma));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Inscrit puis vérifie : un compte actif, avec mot de passe. */
  async function compteActif(etiquette: string) {
    const email = adresse(etiquette);
    const { codeDemo } = await service.inscrire({
      nom: "Rokhaya Seck",
      email,
      motDePasse: MOT_DE_PASSE,
    });
    await service.verifierInscription(email, codeDemo!);
    return email;
  }

  it("ouvre une session sur le bon mot de passe", async () => {
    const email = await compteActif("ok");

    const resultat = await service.connexionMotDePasse(email, MOT_DE_PASSE);

    expect(resultat.token).toBeTruthy();
    expect(resultat.token!.startsWith("tws_")).toBe(true);
    expect(resultat.compte.estVerifie).toBe(true);
    // L'empreinte ne remonte jamais jusqu'à l'appelant.
    expect(JSON.stringify(resultat.compte)).not.toContain("scrypt$");
    // Et la session est réellement exploitable.
    await expect(service.exigerVisiteur(resultat.token)).resolves.toBe(resultat.visiteurId);
  });

  it("refuse un mauvais mot de passe sans rien dire de plus", async () => {
    const email = await compteActif("faux");

    const erreur = await service
      .connexionMotDePasse(email, "ce n est pas le bon")
      .then(() => null)
      .catch((e: unknown) => e);

    expect(codeDe(erreur)).toMatchObject({ code: "IDENTIFIANTS_INVALIDES" });
  });

  it("répond exactement la même chose pour une adresse inconnue", async () => {
    // Un message différent dirait à n'importe qui si une adresse a un compte
    // sur le site. Les deux refus doivent être indiscernables.
    const surCompteConnu = await service
      .connexionMotDePasse(await compteActif("enumeration"), "mauvais mot de passe")
      .then(() => null)
      .catch((e: unknown) => e);

    const surAdresseInconnue = await service
      .connexionMotDePasse(adresse("jamais-vue"), "mauvais mot de passe")
      .then(() => null)
      .catch((e: unknown) => e);

    expect(codeDe(surAdresseInconnue)).toEqual(codeDe(surCompteConnu));
    expect((surAdresseInconnue as ErreurMetier).getStatus()).toBe(
      (surCompteConnu as ErreurMetier).getStatus(),
    );
  });

  it("refuse un compte dont l'adresse n'est pas confirmée, et le dit", async () => {
    const email = adresse("non-verifie");
    await service.inscrire({ nom: "Rokhaya Seck", email, motDePasse: MOT_DE_PASSE });

    // Mot de passe correct, adresse jamais confirmée : un code distinct, pour
    // pouvoir renvoyer la personne vers la vérification au lieu de la laisser
    // devant un refus incompréhensible.
    const erreur = await service
      .connexionMotDePasse(email, MOT_DE_PASSE)
      .then(() => null)
      .catch((e: unknown) => e);

    expect(codeDe(erreur)).toMatchObject({ code: "COMPTE_NON_VERIFIE" });

    const compte = await prisma.account.findUnique({ where: { email } });
    expect(await prisma.session.count({ where: { accountId: compte!.id } })).toBe(0);
  });

  it("refuse un compte historique qui n'a pas de mot de passe", async () => {
    // Les comptes nés d'une demande de code n'ont pas de mot de passe. Ils
    // continuent de se connecter par code — voir le test suivant — mais la
    // route mot de passe ne doit pas les authentifier avec une chaîne vide.
    const email = adresse("historique");
    await service.envoyerOtp(email);

    for (const essai of ["", " ", MOT_DE_PASSE]) {
      await expect(service.connexionMotDePasse(email, essai), `« ${essai} »`).rejects.toThrow(
        ErreurMetier,
      );
    }
  });

  it("ne retire rien au parcours par code des comptes existants", async () => {
    // La garantie de non-régression : le mécanisme de connexion antérieur
    // fonctionne toujours, exactement comme avant.
    const email = adresse("compatibilite");
    const { codeDemo } = await service.envoyerOtp(email);

    const session = await service.verifierOtp(email, codeDemo!);
    expect(session.token).toBeTruthy();
    await expect(service.exigerVisiteur(session.token)).resolves.toBe(session.visiteurId);
  });

  it("plafonne les tentatives répétées, puis repart après une réussite", async () => {
    const email = await compteActif("plafond");

    // Dix échecs autorisés, le onzième est refusé pour cause de débit.
    for (let essai = 0; essai < 10; essai += 1) {
      await expect(service.connexionMotDePasse(email, `faux ${essai}`)).rejects.toThrow(ErreurMetier);
    }

    const bloque = await service
      .connexionMotDePasse(email, "encore faux")
      .then(() => null)
      .catch((e: unknown) => e);
    expect(codeDe(bloque)).toMatchObject({ code: "TENTATIVES_DEPASSEES" });

    // Même le bon mot de passe est refusé tant que la fenêtre n'est pas passée :
    // sinon le plafond ne protégerait rien.
    await expect(service.connexionMotDePasse(email, MOT_DE_PASSE)).rejects.toThrow(ErreurMetier);
  });

  it("ne consomme pas le quota d'envoi de codes", async () => {
    // Se tromper de mot de passe ne doit pas empêcher de demander un code
    // ensuite : ce sont deux compteurs distincts.
    const email = await compteActif("quotas-distincts");

    for (let essai = 0; essai < 3; essai += 1) {
      await expect(service.connexionMotDePasse(email, "faux")).rejects.toThrow(ErreurMetier);
    }

    await prisma.otpChallenge.updateMany({
      where: { destination: email },
      data: { creeLe: new Date(Date.now() - 120_000) },
    });

    await expect(service.envoyerOtp(email)).resolves.toMatchObject({ canal: "email" });
  });
});

describe("Limiteur de tentatives", () => {
  it("laisse passer jusqu'au plafond, puis refuse avec un délai", () => {
    let horloge = 1_000_000;
    const limiteur = new LimiteurTentatives(3, 60_000, () => horloge);

    for (let i = 0; i < 3; i += 1) {
      expect(limiteur.verifier("cle").autorise).toBe(true);
      limiteur.enregistrerEchec("cle");
    }

    const refus = limiteur.verifier("cle");
    expect(refus.autorise).toBe(false);
    expect(refus.delaiRestantSecondes).toBe(60);
  });

  it("oublie les tentatives sorties de la fenêtre", () => {
    let horloge = 1_000_000;
    const limiteur = new LimiteurTentatives(2, 60_000, () => horloge);

    limiteur.enregistrerEchec("cle");
    limiteur.enregistrerEchec("cle");
    expect(limiteur.verifier("cle").autorise).toBe(false);

    // La fenêtre glisse : les deux tentatives en sortent.
    horloge += 60_001;
    expect(limiteur.verifier("cle").autorise).toBe(true);
  });

  it("compte chaque clé séparément", () => {
    const limiteur = new LimiteurTentatives(1, 60_000);
    limiteur.enregistrerEchec("email:a@b.sn");

    expect(limiteur.verifier("email:a@b.sn").autorise).toBe(false);
    expect(limiteur.verifier("email:autre@b.sn").autorise).toBe(true);
    expect(limiteur.verifier("ip:41.82.0.1").autorise).toBe(true);
  });

  it("repart à zéro sur réinitialisation", () => {
    const limiteur = new LimiteurTentatives(1, 60_000);
    limiteur.enregistrerEchec("cle");
    expect(limiteur.verifier("cle").autorise).toBe(false);

    limiteur.reinitialiser("cle");
    expect(limiteur.verifier("cle").autorise).toBe(true);
  });
});
