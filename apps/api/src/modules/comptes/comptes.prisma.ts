import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../base-de-donnees/prisma.service";
import {
  estIdentiteDemo,
  TELEPHONE_VISITEUR_DEMO,
  VISITEUR_DEMO,
} from "../../commun/securite/identites-demo";
import { config } from "../../config/configuration";
import {
  genererJetonSession,
  hacherJetonDirect,
  hacherOtp,
  hacherSha256,
  normaliserDestination,
  normaliserTelephone,
  verifierMotDePasse,
} from "../../commun/securite/hachage";
import type {
  CodeOtp,
  CompteDeSession,
  CompteResume,
  DepotComptes,
  FinaliteOtp,
  NouveauLienDemande,
  ResultatLienDemande,
  SessionPrestataire,
  SessionVisiteur,
  VerificationRateLimit,
} from "./comptes.depot";
import { PREFIXE_LIEN_DEMANDE } from "./comptes.depot";

/**
 * Les colonnes d'un compte vues du dehors — et pas une de plus.
 *
 * Une seule liste, partagée : le jour où un champ manque ici, `resumer` le
 * remplace par sa valeur par défaut sans rien dire, et une règle entière se
 * met à décider sur une donnée absente. C'est arrivé à `motDePasseProvisoire`.
 */
const SELECTION_RESUME = {
  id: true,
  email: true,
  nom: true,
  estVerifie: true,
  motDePasseHash: true,
  motDePasseProvisoire: true,
} as const;

/**
 * Les liens d'accès à une demande partagent la table des codes, sans partager
 * leurs règles : ni cooldown, ni quota, ni invalidation croisée avec les codes
 * de connexion.
 */
const HORS_LIENS_DEMANDE = {
  NOT: { finalite: { startsWith: PREFIXE_LIEN_DEMANDE } },
} as const;

@Injectable()
export class DepotComptesPrisma implements DepotComptes {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async enregistrerOtp(otp: CodeOtp): Promise<void> {
    const destination = normaliserDestination(otp.destination || otp.telephone || "");
    const estEmail = destination.includes("@");

    await this.prisma.$transaction(async (tx) => {
      // 1. Assure l'existence du compte visiteur (par e-mail ou téléphone)
      const account = estEmail
        ? await tx.account.upsert({
            where: { email: destination },
            update: {},
            create: {
              email: destination,
              role: "VISITEUR",
              typeCompte: "VISITEUR",
              estVerifie: false,
            },
          })
        : await tx.account.upsert({
            where: { telephone: destination },
            update: {},
            create: {
              telephone: destination,
              role: "VISITEUR",
              typeCompte: "VISITEUR",
              estVerifie: false,
            },
          });

      // 2. Invalide atomiquement les challenges précédents non consommés
      // Les liens d'accès à une demande en sont exclus : demander un code de
      // connexion ne doit pas rendre muet l'e-mail déjà parti.
      await tx.otpChallenge.updateMany({
        where: { destination, consumedAt: null, ...HORS_LIENS_DEMANDE },
        data: { consumedAt: new Date() },
      });

      // 3. Enregistre l'empreinte HMAC-SHA-256 avec clé secrète dédiée (protège contre la recherche exhaustive)
      await tx.otpChallenge.create({
        data: {
          destination,
          ipAddress: otp.ipAddress,
          finalite: otp.finalite ?? "connexion_visiteur",
          codeHash: hacherOtp(otp.code),
          attempts: otp.tentatives ?? 0,
          maxAttempts: 5,
          expiresAt: new Date(otp.expireLe),
          accountId: account.id,
        },
      });
    });
  }

  async verifierRateLimit(
    destination: string,
    ipAddress?: string,
  ): Promise<VerificationRateLimit> {
    const dest = normaliserDestination(destination);

    // 1. Délai minimal entre deux envois (cooldown de 60 secondes)
    const soixanteSecondes = new Date(Date.now() - 60_000);
    const recent = await this.prisma.otpChallenge.findFirst({
      where: {
        destination: dest,
        creeLe: { gte: soixanteSecondes },
        ...HORS_LIENS_DEMANDE,
      },
      orderBy: { creeLe: "desc" },
    });

    if (recent) {
      const tempsEcouleMs = Date.now() - recent.creeLe.getTime();
      const delaiRestantSecondes = Math.max(1, Math.ceil((60_000 - tempsEcouleMs) / 1000));
      return {
        autorise: false,
        motif: "cooldown",
        delaiRestantSecondes,
      };
    }

    // 2. Quota maximal par destination (5 par heure)
    const uneHeure = new Date(Date.now() - 3600_000);
    const countDestination = await this.prisma.otpChallenge.count({
      where: {
        destination: dest,
        creeLe: { gte: uneHeure },
        ...HORS_LIENS_DEMANDE,
      },
    });

    if (countDestination >= 5) {
      return { autorise: false, motif: "quota_destination" };
    }

    // 3. Quota maximal par IP (20 par heure)
    if (ipAddress) {
      const countIp = await this.prisma.otpChallenge.count({
        where: {
          ipAddress,
          creeLe: { gte: uneHeure },
          ...HORS_LIENS_DEMANDE,
        },
      });

      if (countIp >= 20) {
        return { autorise: false, motif: "quota_ip" };
      }
    }

    return { autorise: true };
  }

  async otpPour(destination: string, finalite?: FinaliteOtp): Promise<CodeOtp | null> {
    const dest = normaliserDestination(destination);
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        destination: dest,
        consumedAt: null,
        // Un code d'inscription ne vaut rien sur la route de connexion.
        ...(finalite ? { finalite } : {}),
      },
      orderBy: { creeLe: "desc" },
    });

    if (!challenge) return null;

    return {
      id: challenge.id,
      destination: challenge.destination,
      telephone: challenge.destination,
      code: challenge.codeHash, // Contient l'empreinte pour vérification sécurisée
      expireLe: challenge.expiresAt.toISOString(),
      tentatives: challenge.attempts,
      ipAddress: challenge.ipAddress ?? undefined,
    };
  }

  async incrementerTentatives(destination: string): Promise<number> {
    const dest = normaliserDestination(destination);
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { destination: dest, consumedAt: null, ...HORS_LIENS_DEMANDE },
      orderBy: { creeLe: "desc" },
    });

    if (!challenge) return 0;

    const misAJour = await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });

    if (misAJour.attempts >= misAJour.maxAttempts) {
      // Dépassement des tentatives : challenge consommé et invalidé
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
    }

    return misAJour.attempts;
  }

  async consommerOtp(idOuDestination: string): Promise<boolean> {
    const res = await this.prisma.otpChallenge.updateMany({
      where: {
        OR: [
          { id: idOuDestination },
          { destination: normaliserDestination(idOuDestination), ...HORS_LIENS_DEMANDE },
        ],
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
    return res.count > 0;
  }

  async enregistrerLienDemande(lien: NouveauLienDemande): Promise<void> {
    await this.prisma.otpChallenge.create({
      data: {
        destination: normaliserDestination(lien.email),
        ipAddress: lien.ipAddress,
        finalite: `${PREFIXE_LIEN_DEMANDE}${lien.demandeId}`,
        codeHash: lien.empreinte,
        // Un jeton de 256 bits ne se devine pas : le plafond de tentatives n'a
        // rien à protéger ici, et une seule utilisation est permise de toute façon.
        maxAttempts: 1,
        expiresAt: new Date(lien.expireLe),
        accountId: lien.compteId,
      },
    });
  }

  async consommerLienDemande(empreinte: string): Promise<ResultatLienDemande> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { codeHash: empreinte, finalite: { startsWith: PREFIXE_LIEN_DEMANDE } },
    });
    if (!challenge || !challenge.accountId) return { etat: "inconnu" };
    if (challenge.consumedAt !== null) return { etat: "utilise" };
    if (challenge.expiresAt.getTime() < Date.now()) return { etat: "expire" };

    // Usage unique, atomique : deux clics simultanés ne passent pas tous les deux.
    const pris = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (pris.count === 0) return { etat: "utilise" };

    return {
      etat: "valide",
      lien: {
        compteId: challenge.accountId,
        email: challenge.destination,
        demandeId: challenge.finalite.slice(PREFIXE_LIEN_DEMANDE.length),
        expireLe: challenge.expiresAt.toISOString(),
      },
    };
  }

  async creerSessionVisiteur(destination: string): Promise<SessionVisiteur> {
    const dest = normaliserDestination(destination);
    const estEmail = dest.includes("@");

    const account = estEmail
      ? await this.prisma.account.upsert({
          where: { email: dest },
          update: { estVerifie: true, verifieLe: new Date() },
          create: {
            email: dest,
            role: "VISITEUR",
            typeCompte: "VISITEUR",
            estVerifie: true,
            verifieLe: new Date(),
          },
        })
      : await this.prisma.account.upsert({
          where: { telephone: dest },
          update: { estVerifie: true, verifieLe: new Date() },
          create: {
            telephone: dest,
            role: "VISITEUR",
            typeCompte: "VISITEUR",
            estVerifie: true,
            verifieLe: new Date(),
          },
        });

    const DUREE_SESSION_JOURS = 30;
    const token = genererJetonSession();
    const tokenHash = hacherJetonDirect(token);
    const expiresAt = new Date(Date.now() + DUREE_SESSION_JOURS * 24 * 3600 * 1000); // 30 jours

    const session = await this.prisma.session.create({
      data: {
        accountId: account.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      id: session.id,
      destination: dest,
      telephone: account.telephone ?? undefined,
      email: account.email ?? undefined,
      creeLe: session.creeLe.toISOString(),
      compteId: account.id,
      token,
    };
  }

  /**
   * Le compte derrière un jeton de session, rôle compris.
   *
   * Le rôle est relu en base à chaque appel, jamais déduit du jeton : retirer
   * les droits d'administration doit fermer la porte tout de suite, sans
   * attendre l'expiration de la session.
   */
  async compteDeSession(jeton: string): Promise<CompteDeSession | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hacherJetonDirect(jeton) },
      include: { account: true },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
    return {
      id: session.account.id,
      role: session.account.role,
      email: session.account.email ?? undefined,
      nom: session.account.nom ?? undefined,
    };
  }

  async sessionVisiteur(idOuToken: string): Promise<SessionVisiteur | null> {
    // 1. Démo isolée de développement, refusée par défaut (voir
    //    `config.autoriserComptesDemo`). Elle ne crée un compte que si elle est
    //    explicitement ouverte : sinon on ne touche même pas à la base.
    if (estIdentiteDemo(idOuToken)) {
      if (!config.autoriserComptesDemo) {
        return null;
      }
      const demo = await this.prisma.account.upsert({
        where: { id: VISITEUR_DEMO },
        update: {},
        create: {
          id: VISITEUR_DEMO,
          telephone: TELEPHONE_VISITEUR_DEMO,
          nom: "Visiteur Démo",
          role: "VISITEUR",
          typeCompte: "VISITEUR",
          estVerifie: true,
          verifieLe: new Date(),
        },
      });
      return {
        id: demo.id,
        telephone: demo.telephone ?? TELEPHONE_VISITEUR_DEMO,
        creeLe: demo.creeLe.toISOString(),
        compteId: demo.id,
      };
    }

    const maintenant = new Date();

    // 2. Recherche par empreinte de jeton session (mécanisme primaire sécurisé)
    const tokenHash = hacherJetonDirect(idOuToken);
    const sessionParToken = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { account: true },
    });

    if (
      sessionParToken &&
      !sessionParToken.revokedAt &&
      sessionParToken.expiresAt > maintenant
    ) {
      return {
        id: sessionParToken.id,
        telephone: sessionParToken.account.telephone ?? "",
        email: sessionParToken.account.email ?? undefined,
        creeLe: sessionParToken.creeLe.toISOString(),
        compteId: sessionParToken.accountId,
        token: idOuToken,
      };
    }

    // 3. Recherches de transition historiques, refusées par défaut.
    //
    // Résoudre une session depuis un `session.id` ou, pire, un `account.id`
    // revient à accepter un identifiant non secret comme preuve d'identité :
    // ces deux valeurs circulent dans les URL, les journaux et les exports.
    // Seul le condensé du jeton (étape 2) prouve quelque chose.
    //
    // Le garde-fou se lit sur `autoriserComptesDemo`, et non sur NODE_ENV :
    // c'est exactement cette lecture qui avait laissé la porte ouverte en
    // production.
    if (config.autoriserComptesDemo) {
      // Recherche par identifiant de session (hors production uniquement)
      const sessionParId = await this.prisma.session.findUnique({
        where: { id: idOuToken },
        include: { account: true },
      });

      if (
        sessionParId &&
        !sessionParId.revokedAt &&
        sessionParId.expiresAt > maintenant
      ) {
        return {
          id: sessionParId.id,
          telephone: sessionParId.account.telephone ?? "",
          email: sessionParId.account.email ?? undefined,
          creeLe: sessionParId.creeLe.toISOString(),
          compteId: sessionParId.accountId,
        };
      }

      // Recherche par identifiant de compte (hors production uniquement)
      const account = await this.prisma.account.findUnique({
        where: { id: idOuToken },
      });
      if (account) {
        return {
          id: account.id,
          telephone: account.telephone ?? "",
          email: account.email ?? undefined,
          creeLe: account.creeLe.toISOString(),
          compteId: account.id,
        };
      }
    }

    return null;
  }

  async creerSessionPrestataire(telephone: string): Promise<SessionPrestataire> {
    const digits = normaliserTelephone(telephone);

    const account = await this.prisma.account.upsert({
      where: { telephone: digits },
      update: { estVerifie: true, verifieLe: new Date() },
      create: {
        telephone: digits,
        role: "PRESTATAIRE",
        typeCompte: "LES_DEUX",
        estVerifie: true,
        verifieLe: new Date(),
      },
    });

    const token = genererJetonSession();
    const tokenHash = hacherJetonDirect(token);
    const expiresAt = new Date(Date.now() + 8 * 3600 * 1000);

    const session = await this.prisma.session.create({
      data: {
        accountId: account.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      id: session.id,
      telephone: digits,
      creeLe: session.creeLe.toISOString(),
      compteId: account.id,
      token,
    };
  }

  async sessionPrestataire(idOuToken: string): Promise<SessionPrestataire | null> {
    if (idOuToken === "prestataire-demo") {
      const demo = await this.prisma.account.upsert({
        where: { id: "prestataire-demo" },
        update: {},
        create: {
          id: "prestataire-demo",
          telephone: "771234567",
          nom: "Prestataire Démo",
          role: "PRESTATAIRE",
          typeCompte: "LES_DEUX",
          estVerifie: true,
          verifieLe: new Date(),
        },
      });
      return {
        id: demo.id,
        telephone: demo.telephone ?? "771234567",
        creeLe: demo.creeLe.toISOString(),
        compteId: demo.id,
      };
    }

    const maintenant = new Date();
    const tokenHash = hacherJetonDirect(idOuToken);

    const sessionParToken = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { account: true },
    });

    if (
      sessionParToken &&
      !sessionParToken.revokedAt &&
      sessionParToken.expiresAt > maintenant &&
      sessionParToken.account.role === "PRESTATAIRE"
    ) {
      return {
        id: sessionParToken.id,
        telephone: sessionParToken.account.telephone ?? "",
        creeLe: sessionParToken.creeLe.toISOString(),
        compteId: sessionParToken.accountId,
        token: idOuToken,
      };
    }

    const sessionParId = await this.prisma.session.findUnique({
      where: { id: idOuToken },
      include: { account: true },
    });

    if (
      sessionParId &&
      !sessionParId.revokedAt &&
      sessionParId.expiresAt > maintenant &&
      sessionParId.account.role === "PRESTATAIRE"
    ) {
      return {
        id: sessionParId.id,
        telephone: sessionParId.account.telephone ?? "",
        creeLe: sessionParId.creeLe.toISOString(),
        compteId: sessionParId.accountId,
      };
    }

    const account = await this.prisma.account.findUnique({
      where: { id: idOuToken },
    });
    if (account && account.role === "PRESTATAIRE") {
      return {
        id: account.id,
        telephone: account.telephone ?? "",
        creeLe: account.creeLe.toISOString(),
        compteId: account.id,
      };
    }

    return null;
  }

  async revoquerSession(idOuToken: string): Promise<void> {
    const maintenant = new Date();
    const tokenHash = hacherJetonDirect(idOuToken);

    await this.prisma.session.updateMany({
      where: {
        OR: [{ id: idOuToken }, { tokenHash }],
        revokedAt: null,
      },
      data: { revokedAt: maintenant },
    });
  }

  /* ───────────────────────────── Inscription ───────────────────────────── */

  async compteParEmail(email: string): Promise<CompteResume | null> {
    const normalise = normaliserDestination(email);
    if (!normalise.includes("@")) return null;

    const compte = await this.prisma.account.findUnique({
      where: { email: normalise },
      select: SELECTION_RESUME,
    });
    if (!compte) return null;

    return this.resumer(compte);
  }

  async preparerInscription(entree: {
    email: string;
    nom: string;
    motDePasseHash: string;
  }): Promise<CompteResume> {
    const email = normaliserDestination(entree.email);

    // `upsert` et non `create` : une demande de code antérieure a pu laisser un
    // compte non vérifié et sans mot de passe sur cette adresse. Le service a
    // déjà refusé le cas d'un compte réellement inscrit — ici, on complète.
    //
    // Le compte reste `estVerifie: false` : l'inscription n'est pas acquise
    // avant la vérification du code.
    const compte = await this.prisma.account.upsert({
      where: { email },
      update: {
        nom: entree.nom,
        motDePasseHash: entree.motDePasseHash,
      },
      create: {
        email,
        nom: entree.nom,
        motDePasseHash: entree.motDePasseHash,
        role: "VISITEUR",
        typeCompte: "VISITEUR",
        estVerifie: false,
      },
      select: SELECTION_RESUME,
    });

    return this.resumer(compte);
  }

  /**
   * `updateMany` plutôt que `update` : la condition `nom: null` fait partie de
   * la requête, donc aucune lecture préalable, donc aucune fenêtre entre le
   * moment où l'on constate que le nom est vide et celui où on l'écrit.
   */
  async renseignerNomSiVide(compteId: string, nom: string): Promise<void> {
    const propre = nom.trim().slice(0, 120);
    if (!propre) return;
    await this.prisma.account.updateMany({
      where: { id: compteId, nom: null },
      data: { nom: propre },
    });
  }

  async activerCompte(compteId: string): Promise<CompteResume> {
    const compte = await this.prisma.account.update({
      where: { id: compteId },
      // Le drapeau « provisoire » retombe ici : l'adresse est prouvée, le mot
      // de passe cesse d'être une exception et redevient un mot de passe.
      data: { estVerifie: true, verifieLe: new Date(), motDePasseProvisoire: false },
      select: SELECTION_RESUME,
    });
    return this.resumer(compte);
  }

  async adressesEquipe(): Promise<string[]> {
    const comptes = await this.prisma.account.findMany({
      where: { role: "ADMINISTRATEUR", email: { not: null } },
      select: { email: true },
    });
    return comptes.map((c) => c.email!).filter(Boolean);
  }

  /* ────────────────────── Demande envoyée sans compte ────────────────────── */

  async visiteurDeContact(contact: {
    email: string;
    nom?: string;
    telephone?: string;
    motDePasseHash?: string;
  }): Promise<{ compte: CompteResume; creeMaintenant: boolean }> {
    const email = normaliserDestination(contact.email);
    const nom = contact.nom?.trim().slice(0, 120) || undefined;
    // Les chiffres seulement, comme partout ailleurs. Une saisie trop courte
    // n'est pas un numéro : mieux vaut aucun que faux.
    const chiffres = contact.telephone ? normaliserTelephone(contact.telephone) : "";
    const telephone = chiffres.length >= 6 ? chiffres : undefined;

    const existant = await this.prisma.account.findUnique({
      where: { email },
      select: SELECTION_RESUME,
    });

    // `create` et non `upsert` : il faut savoir si ce compte vient de naître,
    // et un `upsert` ne le dit pas. La collision est rattrapée plus bas — deux
    // demandes simultanées sur la même adresse ne doivent pas en perdre une.
    //
    // Ni `estVerifie`, ni `verifieLe` : une demande n'est pas une preuve que
    // l'on relève cette boîte. Ce qui la prouvera, c'est l'usage du mot de
    // passe expédié à cette adresse.
    let compte = existant;
    let creeMaintenant = false;

    if (!compte) {
      try {
        compte = await this.prisma.account.create({
          data: {
            email,
            nom,
            role: "VISITEUR",
            typeCompte: "VISITEUR",
            estVerifie: false,
            motDePasseHash: contact.motDePasseHash,
            motDePasseProvisoire: Boolean(contact.motDePasseHash),
          },
          select: SELECTION_RESUME,
        });
        creeMaintenant = true;
      } catch {
        // Quelqu'un a créé le compte entre la lecture et l'écriture : on le
        // relit, et il n'est pas « créé maintenant » de notre fait.
        compte = await this.prisma.account.findUnique({
          where: { email },
          select: SELECTION_RESUME,
        });
      }
    }

    if (!compte) throw new Error(`Compte de contact introuvable pour ${email}`);

    if (nom) await this.renseignerNomSiVide(compte.id, nom);
    if (telephone) await this.renseignerTelephoneSiVide(compte.id, telephone);

    // Relu après coup : le résumé rendu doit porter le nom qui vient d'être
    // posé, pas celui d'avant.
    const relu = await this.prisma.account.findUnique({
      where: { id: compte.id },
      select: SELECTION_RESUME,
    });
    return { compte: this.resumer(relu ?? compte), creeMaintenant };
  }

  /**
   * Pose le numéro de rappel s'il n'y en a pas déjà un.
   *
   * `telephone` est unique en base : deux visiteurs qui donnent le même numéro
   * — un hôtel, un accompagnateur — ne doivent pas faire échouer la seconde
   * demande. La collision est donc attendue et avalée : le numéro reste dans la
   * demande, l'équipe l'a sous les yeux de toute façon.
   */
  private async renseignerTelephoneSiVide(compteId: string, telephone: string): Promise<void> {
    try {
      await this.prisma.account.updateMany({
        where: { id: compteId, telephone: null },
        data: { telephone },
      });
    } catch {
      // Numéro déjà porté par un autre compte : on n'insiste pas.
    }
  }

  async verifierMotDePasseCompte(compteId: string, motDePasse: string): Promise<boolean> {
    const compte = await this.prisma.account.findUnique({
      where: { id: compteId },
      select: { motDePasseHash: true },
    });
    // L'empreinte ne quitte pas cette méthode.
    return verifierMotDePasse(motDePasse, compte?.motDePasseHash);
  }

  /** Vue publique d'un compte : jamais l'empreinte, seulement sa présence. */
  private resumer(compte: {
    id: string;
    email: string | null;
    nom: string | null;
    estVerifie: boolean;
    motDePasseHash: string | null;
    motDePasseProvisoire?: boolean;
  }): CompteResume {
    return {
      id: compte.id,
      email: compte.email,
      nom: compte.nom,
      estVerifie: compte.estVerifie,
      aUnMotDePasse: Boolean(compte.motDePasseHash),
      motDePasseProvisoire: compte.motDePasseProvisoire ?? false,
    };
  }
}
