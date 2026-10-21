import { Injectable } from "@nestjs/common";

import { normaliserDestination, verifierMotDePasse } from "../../commun/securite/hachage";
import {
  estIdentiteDemo,
  TELEPHONE_VISITEUR_DEMO,
  VISITEUR_DEMO,
} from "../../commun/securite/identites-demo";
import { config } from "../../config/configuration";
import type {
  CodeOtp,
  CompteDeSession,
  CompteResume,
  DepotComptes,
  FinaliteOtp,
  SessionPrestataire,
  SessionVisiteur,
  VerificationRateLimit,
} from "./comptes.depot";

/** Code OTP de démonstration — aucun SMS réel. */
export const CODE_OTP_DEMO = "123456";

/** Code prestataire de démonstration — aligné sur `@teranga/fixtures`. */
export const CODE_PRESTATAIRE_DEMO = "123456";

@Injectable()
export class DepotComptesFixtures implements DepotComptes {
  private readonly otps = new Map<string, CodeOtp>();
  private readonly sessionsVisiteur = new Map<string, SessionVisiteur>();
  private readonly sessionsPrestataire = new Map<string, SessionPrestataire>();
  private readonly historiquesEnvois = new Map<string, number[]>();

  async enregistrerOtp(otp: CodeOtp): Promise<void> {
    const dest = normaliserDestination(otp.destination || otp.telephone || "");
    this.otps.set(dest, {
      ...otp,
      destination: dest,
      telephone: dest,
    });

    const timestamps = this.historiquesEnvois.get(dest) ?? [];
    timestamps.push(Date.now());
    this.historiquesEnvois.set(dest, timestamps);
  }

  async verifierRateLimit(
    destination: string,
    _ipAddress?: string,
  ): Promise<VerificationRateLimit> {
    const dest = normaliserDestination(destination);
    const timestamps = this.historiquesEnvois.get(dest) ?? [];
    const maintenant = Date.now();

    // 60s cooldown
    const dernier = timestamps[timestamps.length - 1];
    if (dernier && maintenant - dernier < 60_000) {
      const restant = Math.ceil((60_000 - (maintenant - dernier)) / 1000);
      return { autorise: false, motif: "cooldown", delaiRestantSecondes: restant };
    }

    // Max 5 par heure
    const uneHeure = timestamps.filter((t) => maintenant - t < 3600_000);
    if (uneHeure.length >= 5) {
      return { autorise: false, motif: "quota_destination" };
    }

    return { autorise: true };
  }

  async otpPour(destination: string, finalite?: FinaliteOtp): Promise<CodeOtp | null> {
    const code = this.otps.get(normaliserDestination(destination)) ?? null;
    if (!code) return null;
    // Même règle que le dépôt Prisma : un code d'inscription ne sert pas à se
    // connecter. Les codes enregistrés sans finalité valent `connexion_visiteur`.
    if (finalite && (code.finalite ?? "connexion_visiteur") !== finalite) return null;
    return code;
  }

  async incrementerTentatives(destination: string): Promise<number> {
    const dest = normaliserDestination(destination);
    const otp = this.otps.get(dest);
    if (!otp) return 0;
    otp.tentatives = (otp.tentatives ?? 0) + 1;
    if (otp.tentatives >= 5) {
      this.otps.delete(dest);
    }
    return otp.tentatives;
  }

  async consommerOtp(destination: string): Promise<boolean> {
    const norm = normaliserDestination(destination);
    return this.otps.delete(norm);
  }

  async creerSessionVisiteur(destination: string): Promise<SessionVisiteur> {
    const dest = normaliserDestination(destination);
    const session: SessionVisiteur = {
      id: `visiteur-${dest}`,
      destination: dest,
      telephone: dest.includes("@") ? undefined : dest,
      email: dest.includes("@") ? dest : undefined,
      creeLe: new Date().toISOString(),
      token: `tws_fixture_${dest}`,
    };
    this.sessionsVisiteur.set(session.id, session);
    this.sessionsVisiteur.set(session.token!, session);
    return session;
  }

  async sessionVisiteur(id: string): Promise<SessionVisiteur | null> {
    if (estIdentiteDemo(id)) {
      // Refus par défaut, comme le dépôt Prisma : le même verrou des deux côtés.
      if (!config.autoriserComptesDemo) return null;
      return {
        id: VISITEUR_DEMO,
        destination: TELEPHONE_VISITEUR_DEMO,
        telephone: TELEPHONE_VISITEUR_DEMO,
        email: "demo@terangaway.sn",
        creeLe: new Date().toISOString(),
      };
    }
    return this.sessionsVisiteur.get(id) ?? null;
  }

  /**
   * Le compte derrière un jeton, rôle compris.
   *
   * En mémoire, le rôle ne vient pas d'une table mais de la configuration :
   * les adresses de `ADMIN_EMAILS` sont administratrices, les autres non.
   * C'est le seul moyen d'exercer le backoffice sans Postgres, et cela reste
   * fermé par défaut — sans variable, aucune adresse n'est admise.
   */
  async compteDeSession(jeton: string): Promise<CompteDeSession | null> {
    const session = this.sessionsVisiteur.get(jeton);
    if (!session) return null;
    const email = session.email ?? session.destination;
    return {
      id: session.compteId ?? session.id,
      role: email && config.adminEmails.includes(email) ? "ADMINISTRATEUR" : "VISITEUR",
      email: session.email,
    };
  }

  async revoquerSession(idOuToken: string): Promise<void> {
    const s = this.sessionsVisiteur.get(idOuToken);
    if (s) {
      this.sessionsVisiteur.delete(s.id);
      if (s.token) this.sessionsVisiteur.delete(s.token);
    }
    this.sessionsVisiteur.delete(idOuToken);
  }

  async creerSessionPrestataire(telephone: string): Promise<SessionPrestataire> {
    const session: SessionPrestataire = {
      id: `prestataire-${normaliserDestination(telephone)}`,
      telephone: normaliserDestination(telephone),
      creeLe: new Date().toISOString(),
    };
    this.sessionsPrestataire.set(session.id, session);
    return session;
  }

  async sessionPrestataire(id: string): Promise<SessionPrestataire | null> {
    return this.sessionsPrestataire.get(id) ?? null;
  }

  /* ───────────────────────────── Inscription ───────────────────────────── */

  /**
   * Les comptes, en mémoire, par adresse normalisée.
   *
   * L'empreinte du mot de passe est gardée ici et ne sort jamais par
   * `CompteResume` : le dépôt en mémoire respecte la même discipline que celui
   * sur Postgres, sinon les tests ne prouveraient rien.
   */
  private readonly comptes = new Map<string, CompteEnMemoire>();

  async compteParEmail(email: string): Promise<CompteResume | null> {
    const normalise = normaliserDestination(email);
    const compte = this.comptes.get(normalise);
    return compte ? resumerCompte(compte) : null;
  }

  async preparerInscription(entree: {
    email: string;
    nom: string;
    motDePasseHash: string;
  }): Promise<CompteResume> {
    const email = normaliserDestination(entree.email);
    const existant = this.comptes.get(email);

    const compte = {
      id: existant?.id ?? `cmp-${email}`,
      email,
      nom: entree.nom,
      // L'inscription n'est pas acquise avant la vérification du code.
      estVerifie: false,
      motDePasseHash: entree.motDePasseHash,
      // Un mot de passe choisi par la personne n'a rien de provisoire.
      motDePasseProvisoire: false,
    };
    this.comptes.set(email, compte);
    return resumerCompte(compte);
  }

  async renseignerNomSiVide(compteId: string, nom: string): Promise<void> {
    const propre = nom.trim().slice(0, 120);
    if (!propre) return;
    for (const [cle, compte] of this.comptes) {
      if (compte.id === compteId && !compte.nom) {
        this.comptes.set(cle, { ...compte, nom: propre });
        return;
      }
    }
  }

  async activerCompte(compteId: string): Promise<CompteResume> {
    for (const [cle, compte] of this.comptes) {
      if (compte.id === compteId) {
        const actif = { ...compte, estVerifie: true, motDePasseProvisoire: false };
        this.comptes.set(cle, actif);
        return resumerCompte(actif);
      }
    }
    throw new Error(`Compte inconnu : ${compteId}`);
  }

  /** En mémoire, il n'y a pas de table des rôles : la configuration fait foi. */
  async adressesEquipe(): Promise<string[]> {
    return [...config.adminEmails];
  }

  /* ────────────────────── Demande envoyée sans compte ────────────────────── */

  async visiteurDeContact(contact: {
    email: string;
    nom?: string;
    telephone?: string;
    motDePasseHash?: string;
  }): Promise<{ compte: CompteResume; creeMaintenant: boolean }> {
    const email = normaliserDestination(contact.email);
    const nom = contact.nom?.trim().slice(0, 120) || null;
    const existant = this.comptes.get(email);

    // Le compte reste non vérifié : une demande ne prouve pas l'adresse. Le
    // mot de passe n'est posé qu'à la création — celui d'un compte existant ne
    // se remplace pas sur une simple demande.
    const compte: CompteEnMemoire = existant ?? {
      id: `cmp-${email}`,
      email,
      nom,
      estVerifie: false,
      motDePasseHash: contact.motDePasseHash ?? null,
      motDePasseProvisoire: Boolean(contact.motDePasseHash),
    };
    if (!compte.nom && nom) compte.nom = nom;
    this.comptes.set(email, compte);
    return { compte: resumerCompte(compte), creeMaintenant: !existant };
  }

  async verifierMotDePasseCompte(compteId: string, motDePasse: string): Promise<boolean> {
    for (const compte of this.comptes.values()) {
      if (compte.id === compteId) {
        return verifierMotDePasse(motDePasse, compte.motDePasseHash);
      }
    }
    return false;
  }
}

/** Un compte tel que le dépôt en mémoire le garde, empreinte comprise. */
interface CompteEnMemoire {
  id: string;
  email: string;
  nom: string | null;
  estVerifie: boolean;
  motDePasseHash: string | null;
  motDePasseProvisoire: boolean;
}

/** Vue publique d'un compte : la présence d'un mot de passe, jamais l'empreinte. */
function resumerCompte(compte: CompteEnMemoire): CompteResume {
  return {
    id: compte.id,
    email: compte.email,
    nom: compte.nom,
    estVerifie: compte.estVerifie,
    aUnMotDePasse: Boolean(compte.motDePasseHash),
    motDePasseProvisoire: compte.motDePasseProvisoire,
  };
}
