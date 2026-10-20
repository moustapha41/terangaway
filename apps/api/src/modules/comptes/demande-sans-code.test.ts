import { describe, expect, it } from "vitest";

import { ErreurMetier } from "../../commun/erreurs";
import { enProduction } from "../../commun/securite/posture.test-utils";
import { DepotComptesFixtures } from "./comptes.fixtures";
import { ServiceComptes } from "./comptes.service";

/**
 * Une demande s'envoie sans code — et n'ouvre rien pour autant.
 *
 * Le code à six chiffres a disparu de l'envoi d'une demande : le visiteur
 * choisit, remplit, envoie. Ce qui doit rester vrai malgré cela, et que ces
 * tests verrouillent : les coordonnées rattachent une demande, elles
 * n'ouvrent pas de session. Sans quoi il suffirait de saisir l'adresse de
 * quelqu'un d'autre pour lire ses demandes.
 *
 * Tout se joue en posture de production : c'est la seule qui compte.
 */
describe("Demande sans code — les coordonnées rattachent, elles n'ouvrent pas", () => {
  const service = () => new ServiceComptes(new DepotComptesFixtures());

  it("accepte une demande sur la seule adresse saisie", async () => {
    await enProduction(async () => {
      const comptes = service();
      const visiteur = await comptes.visiteurPourDemande(undefined, {
        email: "fatou@exemple.sn",
        nom: "Fatou Ndiaye",
        telephone: "+221 77 123 45 67",
      });
      expect(visiteur.compteId).toBeTruthy();
      expect(visiteur.email).toBe("fatou@exemple.sn");
    });
  });

  it("retrouve le même carnet d'adresses pour la même adresse, et un autre sinon", async () => {
    await enProduction(async () => {
      const comptes = service();
      const premier = await comptes.visiteurPourDemande(undefined, { email: "fatou@exemple.sn" });
      // Même adresse, écrite autrement : c'est la même personne.
      const second = await comptes.visiteurPourDemande(undefined, { email: " Fatou@Exemple.SN " });
      const autre = await comptes.visiteurPourDemande(undefined, { email: "amadou@exemple.sn" });

      expect(second.compteId).toBe(premier.compteId);
      expect(autre.compteId).not.toBe(premier.compteId);
    });
  });

  it("n'ouvre aucune session : l'identité obtenue ne vaut pas jeton", async () => {
    await enProduction(async () => {
      const comptes = service();
      const visiteur = await comptes.visiteurPourDemande(undefined, { email: "fatou@exemple.sn" });

      // Le cœur de l'affaire : présenter cette identité comme un jeton ne
      // donne pas accès à la lecture des demandes.
      await expect(comptes.exigerVisiteur(visiteur.compteId)).rejects.toThrow(ErreurMetier);
    });
  });

  it("remet des identifiants au premier passage, et à lui seul", async () => {
    await enProduction(async () => {
      const comptes = service();

      const premier = await comptes.visiteurPourDemande(undefined, {
        email: "fatou@exemple.sn",
        nom: "Fatou Ndiaye",
      });
      // Le compte vient de naître : un mot de passe part avec la confirmation.
      expect(premier.identifiants?.email).toBe("fatou@exemple.sn");
      expect(premier.identifiants?.motDePasse).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);

      // La demande suivante ne réécrit rien : on n'envoie pas un nouveau mot de
      // passe à chaque fois, et surtout on ne remplace pas celui qui sert déjà.
      const second = await comptes.visiteurPourDemande(undefined, { email: "fatou@exemple.sn" });
      expect(second.identifiants).toBeUndefined();
      expect(second.compteId).toBe(premier.compteId);
    });
  });

  it("le mot de passe reçu ouvre la session et prouve l'adresse", async () => {
    await enProduction(async () => {
      const depot = new DepotComptesFixtures();
      const comptes = new ServiceComptes(depot);

      const visiteur = await comptes.visiteurPourDemande(undefined, { email: "fatou@exemple.sn" });
      const motDePasse = visiteur.identifiants!.motDePasse;

      // Avant usage : l'adresse n'est pas prouvée, le mot de passe est provisoire.
      const avant = await depot.compteParEmail("fatou@exemple.sn");
      expect(avant?.estVerifie).toBe(false);
      expect(avant?.motDePasseProvisoire).toBe(true);

      const connexion = await comptes.connexionMotDePasse("fatou@exemple.sn", motDePasse);
      expect(connexion.token).toBeTruthy();

      // S'en être servi, c'est avoir relevé la boîte : l'adresse est prouvée et
      // le mot de passe cesse d'être une exception.
      const apres = await depot.compteParEmail("fatou@exemple.sn");
      expect(apres?.estVerifie).toBe(true);
      expect(apres?.motDePasseProvisoire).toBe(false);
    });
  });

  it("un mot de passe faux ne passe pas, provisoire ou non", async () => {
    await enProduction(async () => {
      const comptes = service();
      await comptes.visiteurPourDemande(undefined, { email: "fatou@exemple.sn" });

      await expect(
        comptes.connexionMotDePasse("fatou@exemple.sn", "ABCD-EFGH-JKMN-PQRS"),
      ).rejects.toThrow(ErreurMetier);
    });
  });

  it("refuse une demande sans session et sans adresse", async () => {
    await enProduction(async () => {
      const comptes = service();
      await expect(comptes.visiteurPourDemande()).rejects.toThrow(ErreurMetier);
      await expect(comptes.visiteurPourDemande(undefined, {})).rejects.toThrow(ErreurMetier);
      await expect(comptes.visiteurPourDemande(undefined, { email: "   " })).rejects.toThrow(
        ErreurMetier,
      );
    });
  });

  it("retombe sur les coordonnées quand le jeton présenté est mort", async () => {
    await enProduction(async () => {
      const comptes = service();
      // Un cookie expiré, ou forgé, ne doit pas faire échouer un envoi : il ne
      // doit simplement désigner personne.
      const attendu = await comptes.visiteurPourDemande(undefined, { email: "fatou@exemple.sn" });
      for (const forge of ["visiteur-demo", "a".repeat(40), "fatou@exemple.sn"]) {
        const visiteur = await comptes.visiteurPourDemande(forge, { email: "fatou@exemple.sn" });
        expect(visiteur.compteId, forge).toBe(attendu.compteId);
      }
    });
  });

  it("préfère la session quand il y en a une", async () => {
    await enProduction(async () => {
      const depot = new DepotComptesFixtures();
      const comptes = new ServiceComptes(depot);
      const session = await depot.creerSessionVisiteur("rokhaya@exemple.sn");

      const visiteur = await comptes.visiteurPourDemande(session.token, {
        email: "quelquun.dautre@exemple.sn",
      });

      // L'adresse saisie dans le formulaire ne détourne pas la demande du
      // compte connecté.
      expect(visiteur.compteId).toBe(session.compteId ?? session.id);
      // Et ce compte-là existe déjà : aucun identifiant n'est remis.
      expect(visiteur.identifiants).toBeUndefined();
    });
  });
});
