import { randomInt } from "node:crypto";
import { HttpStatus, Inject, Injectable, Optional } from "@nestjs/common";
import type { CompteAdministrateur } from "@teranga/contracts";

import { ServiceEmail } from "../../commun/email/email.service";
import { DEPOT_COMPTES } from "../../commun/depots/depot";
import { ErreurMetier } from "../../commun/erreurs";
import {
  hacherMotDePasse,
  LONGUEUR_MINIMALE_MOT_DE_PASSE,
  motDePasseAcceptable,
  normaliserDestination,
  verifierOtpHash,
} from "../../commun/securite/hachage";
import { estIdentiteDemo, VISITEUR_DEMO } from "../../commun/securite/identites-demo";
import { LimiteurTentatives } from "../../commun/securite/limiteur-tentatives";
import { config } from "../../config/configuration";
import type { CompteResume, DepotComptes, FinaliteOtp } from "./comptes.depot";
import { CODE_OTP_DEMO, CODE_PRESTATAIRE_DEMO } from "./comptes.fixtures";

const DUREE_OTP_MINUTES = 10;
const MAX_TENTATIVES_OTP = 5;

/** Longueur maximale acceptée pour un mot de passe, pour borner le coût de scrypt. */
const LONGUEUR_MAXIMALE_MOT_DE_PASSE = 200;
const LONGUEUR_MAXIMALE_NOM = 120;

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Message unique pour « adresse inconnue » et « mot de passe faux ».
 *
 * Distinguer les deux dirait à n'importe qui si une adresse possède un compte
 * sur le site. Pour une plateforme de réservation, c'est une information
 * personnelle qu'on n'a pas à divulguer.
 */
const IDENTIFIANTS_REFUSES = "L'adresse e-mail ou le mot de passe ne correspond pas.";

@Injectable()
export class ServiceComptes {
  /**
   * Plafond des connexions par mot de passe : dix échecs par quart d'heure.
   *
   * Le limiteur OTP ne peut pas servir ici : il compte les lignes
   * `otp_challenges`, et une tentative de connexion n'en crée aucune. Les y
   * compter ferait tomber le quota d'envoi de codes de quelqu'un parce qu'il
   * s'est trompé de mot de passe.
   *
   * Compteurs en mémoire du processus : voir la réserve écrite dans
   * `limiteur-tentatives.ts`.
   */
  private readonly limiteurConnexion = new LimiteurTentatives(10, 15 * 60_000);

  constructor(
    @Inject(DEPOT_COMPTES) private readonly depot: DepotComptes,
    @Optional() private readonly emailService?: ServiceEmail,
  ) {}

  /**
   * Envoie un code OTP à une adresse e-mail (ou téléphone hors-production uniquement).
   * L'empreinte cryptographique est enregistrée en base sans jamais stocker le code en clair.
   */
  async envoyerOtp(
    identifiant: string,
    ipAddress?: string,
    finalite: FinaliteOtp = "connexion_visiteur",
  ): Promise<{ expireLe: string; delaiAttenteSecondes: number; codeDemo?: string; canal: "email" | "sms" }> {
    const estEmail = identifiant.includes("@");
    let destination: string;

    if (estEmail) {
      destination = identifiant.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
        throw new ErreurMetier("EMAIL_INVALIDE", "Adresse e-mail invalide.");
      }
    } else {
      destination = identifiant.replace(/\D/g, "");
      if (destination.length < 9) {
        throw new ErreurMetier("TELEPHONE_INVALIDE", "Numéro de téléphone invalide.");
      }
      // Aucun fournisseur SMS (Twilio, Infobip, etc.) n'est intégré dans l'API.
      // Refuser formellement pour ne jamais tromper l'utilisateur : lui annoncer
      // un SMS qui ne partira pas est pire qu'un refus net. Seul le mode démo,
      // où le code revient dans la réponse, peut s'en passer.
      if (!config.autoriserComptesDemo) {
        throw new ErreurMetier(
          "FOURNISSEUR_SMS_NON_DISPONIBLE",
          "L'envoi de codes par SMS n'est pas disponible actuellement. Veuillez utiliser votre adresse e-mail pour recevoir votre code de vérification.",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // 1. Contrôle du Rate Limiting (délai entre renvois, quotas destination et IP)
    if (this.depot.verifierRateLimit) {
      const verif = await this.depot.verifierRateLimit(destination, ipAddress);
      if (!verif.autorise) {
        if (verif.motif === "cooldown") {
          throw new ErreurMetier(
            "DELAI_ATTENTE",
            `Veuillez patienter ${verif.delaiRestantSecondes ?? 60} secondes avant de demander un nouveau code.`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        if (verif.motif === "quota_destination") {
          throw new ErreurMetier(
            "QUOTA_DEPASSE",
            "Nombre maximal de demandes atteint pour cette adresse. Veuillez réessayer plus tard.",
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        if (verif.motif === "quota_ip") {
          throw new ErreurMetier(
            "QUOTA_IP_DEPASSE",
            "Trop de demandes de vérification depuis cette connexion. Veuillez réessayer plus tard.",
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    }

    // 2. Génération cryptographiquement sécurisée d'un code à 6 chiffres
    const code = randomInt(100000, 1000000).toString();
    const expireLe = new Date(Date.now() + DUREE_OTP_MINUTES * 60_000).toISOString();

    // 3. Persistance en base PostgreSQL avec empreinte HMAC-SHA-256 (jamais le code brut)
    await this.depot.enregistrerOtp({
      destination,
      telephone: estEmail ? undefined : destination,
      code,
      expireLe,
      tentatives: 0,
      ipAddress,
      finalite,
    });

    // 4. Envoi par e-mail si destination e-mail
    if (estEmail && this.emailService) {
      await this.emailService.envoyerCodeOtp(destination, code, DUREE_OTP_MINUTES);
    }

    const reponse: {
      expireLe: string;
      delaiAttenteSecondes: number;
      codeDemo?: string;
      canal: "email" | "sms";
    } = {
      expireLe,
      delaiAttenteSecondes: 60,
      canal: estEmail ? "email" : "sms",
    };

    // Renvoyer le code dans la réponse HTTP est un confort de développement qui
    // vaut, sur un déploiement public, une prise de contrôle de n'importe quel
    // compte : il suffit de demander un code pour une adresse et de le lire
    // dans la réponse. Même verrou à refus par défaut que les autres
    // raccourcis, et non la seule lecture de NODE_ENV.
    if (config.autoriserComptesDemo) {
      reponse.codeDemo = code;
    }

    return reponse;
  }

  async verifierOtp(
    identifiant: string,
    code: string,
  ): Promise<{ visiteurId: string; token?: string }> {
    const destination = normaliserDestination(identifiant);
    await this.consommerCodeValide(destination, code, "connexion_visiteur");

    // Création de la session sécurisée persistée
    const session = await this.depot.creerSessionVisiteur(destination);
    return {
      visiteurId: session.compteId ?? session.id,
      token: session.token ?? session.id,
    };
  }

  /**
   * Vérifie un code et le consomme, ou lève une erreur métier.
   *
   * Extrait de `verifierOtp` pour que l'inscription applique **exactement** les
   * mêmes règles : expiration, plafond de tentatives, usage unique, comparaison
   * HMAC en temps constant. Dupliquer cette séquence, c'est se garantir qu'une
   * des deux copies finira par oublier un contrôle.
   *
   * `finalite` est ce qui empêche un code d'inscription de servir à se
   * connecter, et inversement.
   */
  private async consommerCodeValide(
    destination: string,
    code: string,
    finalite: FinaliteOtp,
  ): Promise<void> {
    // Le code fixe de démonstration n'est pas traité à part : il doit
    // correspondre au challenge réellement stocké, comme n'importe quel autre
    // code. Il n'y a donc rien à écrire ici — un `if` vide se lisait comme un
    // garde-fou et n'en était pas un.
    const otp = await this.depot.otpPour(destination, finalite);
    if (!otp) {
      throw new ErreurMetier("CODE_INVALIDE", "Le code n'est pas valable.", HttpStatus.UNAUTHORIZED);
    }

    if (otp.tentatives >= MAX_TENTATIVES_OTP) {
      await this.depot.consommerOtp(otp.id ?? destination);
      throw new ErreurMetier(
        "TENTATIVES_DEPASSEES",
        "Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (new Date(otp.expireLe).getTime() < Date.now()) {
      await this.depot.consommerOtp(otp.id ?? destination);
      throw new ErreurMetier("CODE_EXPIRE", "Ce code a expiré.", HttpStatus.UNAUTHORIZED);
    }

    // Vérification cryptographique de l'empreinte HMAC-SHA-256 en temps constant (timing-safe)
    let codeValide = verifierOtpHash(code, otp.code);
    if (!codeValide && config.autoriserComptesDemo) {
      // Tolérance démo locale sans empreinte cryptographique si fixtures en
      // mémoire. Adossée au même verrou que les autres raccourcis : refusée par
      // défaut, impossible en production.
      codeValide = code === otp.code;
    }

    if (!codeValide) {
      const tentatives = await this.depot.incrementerTentatives?.(destination);
      if (tentatives !== undefined && tentatives >= MAX_TENTATIVES_OTP) {
        throw new ErreurMetier(
          "TENTATIVES_DEPASSEES",
          "Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new ErreurMetier("CODE_INVALIDE", "Le code n'est pas valable.", HttpStatus.UNAUTHORIZED);
    }

    // Invalidation immédiate et atomique du code après utilisation unique (single-use)
    // Empêche toute réutilisation concurrente (TOCTOU / replay attack)
    const consomme = await this.depot.consommerOtp(otp.id ?? destination);
    if (!consomme) {
      throw new ErreurMetier("CODE_DEJA_UTILISE", "Ce code a déjà été utilisé.", HttpStatus.UNAUTHORIZED);
    }
  }

  async connexionPrestataire(
    telephone: string,
    code: string,
  ): Promise<{ prestataireId: string; token?: string }> {
    const digits = telephone.replace(/\D/g, "");
    if (digits.length < 9) {
      throw new ErreurMetier("TELEPHONE_INVALIDE", "Numéro de téléphone invalide.");
    }
    if (code !== CODE_PRESTATAIRE_DEMO) {
      throw new ErreurMetier("CODE_INVALIDE", "Le code n'est pas valable.", HttpStatus.UNAUTHORIZED);
    }
    const session = await this.depot.creerSessionPrestataire(digits);
    return {
      prestataireId: session.compteId ?? session.id,
      token: session.token ?? session.id,
    };
  }

  async deconnecter(tokenOuId?: string): Promise<void> {
    if (tokenOuId) {
      await this.depot.revoquerSession?.(tokenOuId);
    }
  }

  /**
   * Résout l'identité visiteur depuis un jeton de session, et rien d'autre.
   *
   * Un seul chemin accorde une identité : un jeton que le dépôt reconnaît comme
   * une session vivante. Les deux raccourcis historiques — « un code OTP suffit »
   * et « aucun en-tête, donc visiteur de démonstration » — n'existent plus que
   * si `config.autoriserComptesDemo` les réclame explicitement, ce qui est
   * impossible en production.
   *
   * L'audit de production a montré l'importance de la nuance : ces raccourcis
   * étaient gardés par `NODE_ENV === "production"`, et cette seule lecture a
   * suffi à les laisser ouverts sur le site public.
   */
  async exigerVisiteur(visiteurHeader?: string, code?: string): Promise<string> {
    const refus = (message = "Session invalide ou expirée.") =>
      new ErreurMetier("NON_AUTHENTIFIE", message, HttpStatus.UNAUTHORIZED);

    if (visiteurHeader) {
      // Épuration préfixe Bearer si présent
      const tokenNettoye = visiteurHeader.startsWith("Bearer ")
        ? visiteurHeader.slice(7).trim()
        : visiteurHeader.trim();

      // `visiteur-demo` n'est jamais un jeton : c'est une chaîne publique, que
      // n'importe qui peut poser dans un cookie. Elle ne passe que si les
      // comptes de démonstration sont ouverts.
      if (estIdentiteDemo(tokenNettoye) && !config.autoriserComptesDemo) {
        throw refus();
      }

      const session = await this.depot.sessionVisiteur(tokenNettoye);
      if (session) return session.compteId ?? session.id;
      throw refus();
    }

    if (code) {
      // Un code OTP se vérifie contre un challenge stocké, par `verifierOtp`.
      // Il n'ouvre pas de session par lui-même sur une route métier.
      if (!config.autoriserComptesDemo) {
        throw refus();
      }
      if (code !== CODE_OTP_DEMO) {
        throw new ErreurMetier("CODE_INVALIDE", "Le code n'est pas valable.", HttpStatus.UNAUTHORIZED);
      }
      return VISITEUR_DEMO;
    }

    if (!config.autoriserComptesDemo) {
      throw refus("Authentification requise.");
    }

    // Démo de développement sans auth explicite, sur demande expresse.
    return VISITEUR_DEMO;
  }

  /**
   * Résout un administrateur depuis un jeton de session, ou refuse.
   *
   * Deux refus distincts, et c'est volontaire : pas de session vivante, c'est
   * 401 — reconnectez-vous ; session vivante sur un compte sans le rôle, c'est
   * 403 — ce n'est pas votre porte. Les confondre ferait boucler un visiteur
   * égaré sur un écran de connexion qui ne lui servirait à rien.
   *
   * Le rôle est relu à chaque appel, jamais porté par le jeton : retirer les
   * droits ferme l'accès tout de suite.
   */
  async exigerAdministrateur(enTete?: string): Promise<CompteAdministrateur> {
    const refus = () =>
      new ErreurMetier("NON_AUTHENTIFIE", "Session invalide ou expirée.", HttpStatus.UNAUTHORIZED);

    if (!enTete) throw refus();
    const jeton = enTete.startsWith("Bearer ") ? enTete.slice(7).trim() : enTete.trim();
    // Les identités de démonstration sont des chaînes publiques : elles
    // n'ouvrent jamais le backoffice, même quand le mode démo est actif.
    if (!jeton || estIdentiteDemo(jeton)) throw refus();

    const compte = await this.depot.compteDeSession(jeton);
    if (!compte) throw refus();

    // Deux façons d'être de l'équipe : le rôle en base, ou l'adresse listée
    // dans `ADMIN_EMAILS`.
    //
    // La seconde est l'amorce, et elle n'est pas un contournement : sur un
    // déploiement neuf, personne n'a de rôle, et il faut bien que quelqu'un
    // entre une première fois. Exiger d'exécuter un script dans le conteneur
    // pour cela, c'est fermer le backoffice à qui n'a pas de shell sur le
    // serveur. Qui pose cette variable tient déjà le déploiement entier : elle
    // n'accorde rien que cette personne ne puisse déjà prendre.
    //
    // La base reste la source première : promouvoir un compte avec `db:seed`
    // ou en SQL suffit, sans toucher à l'environnement.
    const dansLaListe =
      !!compte.email && config.adminEmails.includes(compte.email.trim().toLowerCase());

    if (compte.role !== "ADMINISTRATEUR" && !dansLaListe) {
      throw new ErreurMetier(
        "ACCES_INTERDIT",
        "Ce compte n'a pas accès au backoffice.",
        HttpStatus.FORBIDDEN,
      );
    }

    return { id: compte.id, email: compte.email, nom: compte.nom };
  }

  /* ──────────────────────────── Inscription ───────────────────────────── */

  /**
   * Ouvre une inscription en attente et envoie un code à l'adresse.
   *
   * **Aucune session n'est créée ici.** Le compte existe, non vérifié, avec son
   * mot de passe : il ne devient actif qu'à la vérification du code. C'est ce
   * qui empêche de s'inscrire avec l'adresse de quelqu'un d'autre et d'en
   * obtenir l'accès.
   */
  async inscrire(entree: {
    nom: string;
    email: string;
    motDePasse: string;
    ipAddress?: string;
  }): Promise<{ email: string; expireLe: string; delaiAttenteSecondes: number; codeDemo?: string }> {
    const nom = entree.nom?.trim() ?? "";
    const email = normaliserDestination(entree.email ?? "");
    const motDePasse = entree.motDePasse ?? "";

    if (nom.length < 2 || nom.length > LONGUEUR_MAXIMALE_NOM) {
      throw new ErreurMetier("NOM_INVALIDE", "Indiquez votre nom complet.");
    }
    if (!EMAIL_VALIDE.test(email)) {
      throw new ErreurMetier("EMAIL_INVALIDE", "Adresse e-mail invalide.");
    }
    if (motDePasse.length > LONGUEUR_MAXIMALE_MOT_DE_PASSE) {
      throw new ErreurMetier("MOT_DE_PASSE_INVALIDE", "Ce mot de passe est trop long.");
    }
    if (!motDePasseAcceptable(motDePasse)) {
      throw new ErreurMetier(
        "MOT_DE_PASSE_INVALIDE",
        `Le mot de passe doit comporter au moins ${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères.`,
      );
    }

    // **Seul un compte vérifié est un doublon.** Une inscription en attente,
    // elle, se laisse réécrire, et c'est voulu.
    //
    // Le raisonnement compte, parce que l'intuition inverse est tentante :
    // refuser une adresse qui a déjà une inscription en attente paraît plus
    // prudent, mais c'est l'inverse. Qui s'inscrirait le premier avec l'adresse
    // de quelqu'un d'autre lui bloquerait l'inscription pour de bon — sans rien
    // obtenir, puisque le code part à cette adresse et qu'il ne la lit pas.
    //
    // En laissant réécrire tant que rien n'est vérifié, le titulaire de
    // l'adresse reprend simplement son inscription, reçoit le code et gagne la
    // course. C'est lui qui lit la boîte.
    //
    // Effet de bord assumé : une tentative d'inscription peut écraser le `nom`
    // d'un compte non vérifié. Aucun accès n'est accordé pour autant, et la
    // valeur est rétablie à l'inscription suivante.
    const existant = await this.depot.compteParEmail(email);
    if (existant?.estVerifie) {
      throw new ErreurMetier(
        "EMAIL_DEJA_UTILISE",
        "Un compte existe déjà avec cette adresse e-mail. Connectez-vous.",
        HttpStatus.CONFLICT,
      );
    }

    // L'envoi d'abord : il porte la limitation de débit, et évite d'écrire en
    // base sur une rafale de demandes.
    const envoi = await this.envoyerOtp(email, entree.ipAddress, "inscription");

    await this.depot.preparerInscription({
      email,
      nom,
      motDePasseHash: hacherMotDePasse(motDePasse),
    });

    // La clé `codeDemo` n'est pas seulement laissée à `undefined` : elle est
    // absente. Une clé présente mais vide traverse `Object.keys` et les
    // journaux structurés, et laisse croire que le champ existe côté client.
    return {
      email,
      expireLe: envoi.expireLe,
      delaiAttenteSecondes: envoi.delaiAttenteSecondes,
      ...(envoi.codeDemo ? { codeDemo: envoi.codeDemo } : {}),
    };
  }

  /**
   * Vérifie le code d'inscription, active le compte et ouvre la session.
   *
   * Le code passe par `consommerCodeValide`, donc par les mêmes contrôles que
   * la connexion : expiration, plafond de tentatives, usage unique.
   */
  async verifierInscription(
    email: string,
    code: string,
  ): Promise<{ visiteurId: string; token?: string; compte: CompteResume }> {
    const destination = normaliserDestination(email ?? "");
    if (!EMAIL_VALIDE.test(destination)) {
      throw new ErreurMetier("EMAIL_INVALIDE", "Adresse e-mail invalide.");
    }

    const compte = await this.depot.compteParEmail(destination);
    if (!compte || !compte.aUnMotDePasse) {
      // Aucune inscription en attente sur cette adresse. Le message reste
      // neutre : il ne dit pas si l'adresse existe par ailleurs.
      throw new ErreurMetier(
        "INSCRIPTION_INTROUVABLE",
        "Aucune inscription en attente pour cette adresse. Reprenez l'inscription.",
        HttpStatus.NOT_FOUND,
      );
    }

    await this.consommerCodeValide(destination, code, "inscription");

    const actif = await this.depot.activerCompte(compte.id);
    const session = await this.depot.creerSessionVisiteur(destination);

    return {
      visiteurId: session.compteId ?? session.id,
      token: session.token ?? session.id,
      compte: actif,
    };
  }

  /** Renvoie un code d'inscription, sous la même limitation de débit que l'envoi initial. */
  async renvoyerCodeInscription(
    email: string,
    ipAddress?: string,
  ): Promise<{ expireLe: string; delaiAttenteSecondes: number; codeDemo?: string }> {
    const destination = normaliserDestination(email ?? "");
    if (!EMAIL_VALIDE.test(destination)) {
      throw new ErreurMetier("EMAIL_INVALIDE", "Adresse e-mail invalide.");
    }

    const compte = await this.depot.compteParEmail(destination);
    if (!compte || !compte.aUnMotDePasse) {
      throw new ErreurMetier(
        "INSCRIPTION_INTROUVABLE",
        "Aucune inscription en attente pour cette adresse. Reprenez l'inscription.",
        HttpStatus.NOT_FOUND,
      );
    }

    const envoi = await this.envoyerOtp(destination, ipAddress, "inscription");
    return {
      expireLe: envoi.expireLe,
      delaiAttenteSecondes: envoi.delaiAttenteSecondes,
      ...(envoi.codeDemo ? { codeDemo: envoi.codeDemo } : {}),
    };
  }

  /* ───────────────────── Connexion par mot de passe ───────────────────── */

  /**
   * Connecte un compte par adresse et mot de passe.
   *
   * N'enlève rien au parcours par code : les comptes antérieurs, qui n'ont pas
   * de mot de passe, continuent de passer par `envoyerOtp` + `verifierOtp`.
   * Cette méthode refuse simplement de les authentifier, avec le même message
   * que pour un mot de passe faux.
   */
  /**
   * Ouvre une session pour une adresse **déjà vérifiée par un fournisseur**.
   *
   * Il n'y a ni mot de passe à comparer ni code à consommer : la preuve a été
   * faite ailleurs, et le site l'a contrôlée avant d'appeler. Cette route ne
   * décide donc de rien — elle range.
   *
   * `creerSessionVisiteur` fait déjà le reste : elle crée le compte s'il
   * n'existe pas, vérifié et **sans mot de passe**, exactement comme un compte
   * né d'un code. C'est pour cela que `motDePasseHash` est nullable : ces
   * comptes-là continueront de se connecter par Google ou par code, jamais par
   * mot de passe, et la route `connexionMotDePasse` les refuse déjà.
   *
   * Aucune limitation de débit ici : l'appelant est notre propre serveur, et le
   * frein se pose chez Google, qui impose son écran de consentement avant de
   * délivrer quoi que ce soit.
   */
  async connexionFederee(
    email: string,
    nom?: string,
  ): Promise<{ visiteurId: string; token?: string; compte: CompteResume | null }> {
    const destination = normaliserDestination(email ?? "");
    if (!EMAIL_VALIDE.test(destination)) {
      throw new ErreurMetier(
        "IDENTIFIANTS_INVALIDES",
        IDENTIFIANTS_REFUSES,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const session = await this.depot.creerSessionVisiteur(destination);
    const compteId = session.compteId ?? session.id;

    if (nom?.trim() && this.depot.renseignerNomSiVide) {
      await this.depot.renseignerNomSiVide(compteId, nom);
    }

    return {
      visiteurId: compteId,
      token: session.token ?? session.id,
      compte: await this.depot.compteParEmail(destination),
    };
  }

  async connexionMotDePasse(
    email: string,
    motDePasse: string,
    ipAddress?: string,
  ): Promise<{ visiteurId: string; token?: string; compte: CompteResume }> {
    const destination = normaliserDestination(email ?? "");

    // La clé de comptage est l'adresse *et* l'IP : limiter sur l'adresse seule
    // laisse balayer les adresses une par une ; limiter sur l'IP seule permet
    // de bloquer le compte de quelqu'un depuis n'importe où.
    const cles = [`email:${destination}`, ...(ipAddress ? [`ip:${ipAddress}`] : [])];
    for (const cle of cles) {
      const decision = this.limiteurConnexion.verifier(cle);
      if (!decision.autorise) {
        throw new ErreurMetier(
          "TENTATIVES_DEPASSEES",
          `Trop de tentatives de connexion. Réessayez dans ${decision.delaiRestantSecondes ?? 60} secondes.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const echec = () => {
      for (const cle of cles) this.limiteurConnexion.enregistrerEchec(cle);
      return new ErreurMetier("IDENTIFIANTS_INVALIDES", IDENTIFIANTS_REFUSES, HttpStatus.UNAUTHORIZED);
    };

    if (!EMAIL_VALIDE.test(destination) || !motDePasse) throw echec();

    const compte = await this.depot.compteParEmail(destination);
    // Adresse inconnue, compte sans mot de passe : même refus, même message.
    if (!compte || !compte.aUnMotDePasse) throw echec();

    const correspond = await this.depot.verifierMotDePasseCompte(compte.id, motDePasse);
    if (!correspond) throw echec();

    // Mot de passe bon mais adresse jamais confirmée : on le dit, pour pouvoir
    // renvoyer la personne vers la vérification plutôt que la laisser bloquée.
    if (!compte.estVerifie) {
      throw new ErreurMetier(
        "COMPTE_NON_VERIFIE",
        "Votre adresse e-mail n'est pas encore confirmée. Vérifiez votre compte pour continuer.",
        HttpStatus.FORBIDDEN,
      );
    }

    for (const cle of cles) this.limiteurConnexion.reinitialiser(cle);

    const session = await this.depot.creerSessionVisiteur(destination);
    return {
      visiteurId: session.compteId ?? session.id,
      token: session.token ?? session.id,
      compte,
    };
  }

  /**
   * Retourne les informations du profil visiteur pour la session active.
   */
  async profilVisiteur(jeton: string): Promise<{
    compteId: string;
    email?: string;
    telephone?: string;
    token?: string;
  }> {
    const compteId = await this.exigerVisiteur(jeton);
    const session = await this.depot.sessionVisiteur(jeton);
    return {
      compteId,
      email: session?.email,
      telephone: session?.telephone,
      token: jeton,
    };
  }
}
