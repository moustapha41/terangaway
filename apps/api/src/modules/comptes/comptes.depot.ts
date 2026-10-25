/** À quoi sert ce code ? Un code d'inscription ne connecte pas, et inversement. */
export type FinaliteOtp = "connexion_visiteur" | "inscription";

/**
 * Préfixe de `OtpChallenge.finalite` pour un lien d'accès à une demande ; la
 * suite est l'identifiant de la demande. Aucune colonne en plus : la finalité
 * porte déjà « à quoi ça sert », et ici « pour quelle demande ».
 */
export const PREFIXE_LIEN_DEMANDE = "lien_demande:";

export interface NouveauLienDemande {
  email: string;
  compteId: string;
  demandeId: string;
  /** Empreinte SHA-256 du jeton : le jeton lui-même n'est jamais stocké. */
  empreinte: string;
  expireLe: string;
  ipAddress?: string;
}

export type ResultatLienDemande =
  | {
      etat: "valide";
      lien: { compteId: string; email: string; demandeId: string; expireLe: string };
    }
  | { etat: "inconnu" | "expire" | "utilise" };

export interface CodeOtp {
  id?: string;
  destination: string;
  telephone?: string;
  code: string;
  expireLe: string;
  tentatives: number;
  ipAddress?: string;
  /** Par défaut `connexion_visiteur`, pour ne rien changer aux appels existants. */
  finalite?: FinaliteOtp;
}

/**
 * Un compte vu depuis le parcours d'inscription.
 *
 * `motDePasseHash` n'en fait pas partie : le service n'a pas besoin de le voir
 * pour décider, et une empreinte qui ne sort pas du dépôt est une empreinte
 * qui ne fuite pas dans un journal. La vérification se fait par
 * `verifierMotDePasseCompte`, qui compare à l'intérieur du dépôt.
 */
export interface CompteResume {
  id: string;
  email?: string | null;
  nom?: string | null;
  estVerifie: boolean;
  /** Ce compte a-t-il un mot de passe, ou se connecte-t-il seulement par code ? */
  aUnMotDePasse: boolean;
  /**
   * Ce mot de passe est-il celui que nous avons engendré et envoyé par e-mail ?
   *
   * Il ouvre la session alors même que l'adresse n'est pas vérifiée : s'en
   * servir, c'est avoir relevé la boîte où il a été expédié. Il retombe à la
   * première connexion.
   */
  motDePasseProvisoire: boolean;
}

export interface VerificationRateLimit {
  autorise: boolean;
  motif?: "cooldown" | "quota_destination" | "quota_ip";
  delaiRestantSecondes?: number;
}

export interface SessionVisiteur {
  id: string;
  destination?: string;
  telephone?: string;
  email?: string;
  creeLe: string;
  compteId?: string;
  token?: string;
}

/**
 * Le compte derrière un jeton, avec son rôle.
 *
 * Le backoffice en a besoin et rien d'autre ne l'avait : `sessionVisiteur`
 * rend une session, pas une autorisation. Faire porter le rôle par la session
 * aurait laissé croire qu'un jeton suffit — c'est le compte qui est
 * administrateur, et il peut cesser de l'être pendant que la session vit.
 */
export interface CompteDeSession {
  id: string;
  role: "VISITEUR" | "PRESTATAIRE" | "ADMINISTRATEUR";
  email?: string;
  nom?: string;
}

export interface SessionPrestataire {
  id: string;
  telephone: string;
  creeLe: string;
  compteId?: string;
  token?: string;
}

export interface DepotComptes {
  enregistrerOtp(otp: CodeOtp): Promise<void>;
  /**
   * Le code actif pour cette destination.
   *
   * `finalite` filtre : un code émis pour une inscription ne doit pas pouvoir
   * servir sur la route de connexion, et inversement. Sans argument, le
   * comportement d'origine est conservé.
   */
  otpPour(destination: string, finalite?: FinaliteOtp): Promise<CodeOtp | null>;
  incrementerTentatives?(destination: string): Promise<number>;
  consommerOtp(idOuDestination: string): Promise<boolean | void>;
  /** Mémorise un lien d'accès à une demande, sans toucher aux codes de connexion. */
  enregistrerLienDemande(lien: NouveauLienDemande): Promise<void>;
  /** Consomme le lien d'un seul coup s'il est valide ; dit pourquoi sinon. */
  consommerLienDemande(empreinte: string): Promise<ResultatLienDemande>;
  verifierRateLimit?(destination: string, ipAddress?: string): Promise<VerificationRateLimit>;
  creerSessionVisiteur(destination: string): Promise<SessionVisiteur>;
  sessionVisiteur(id: string): Promise<SessionVisiteur | null>;
  creerSessionPrestataire(telephone: string): Promise<SessionPrestataire>;
  sessionPrestataire(id: string): Promise<SessionPrestataire | null>;
  revoquerSession?(idOuToken: string): Promise<void>;

  /** Le compte vivant derrière ce jeton, rôle compris, ou `null`. */
  compteDeSession(jeton: string): Promise<CompteDeSession | null>;

  /* ───────────────────────────── Inscription ───────────────────────────── */

  /** Le compte portant cette adresse, ou `null`. */
  compteParEmail(email: string): Promise<CompteResume | null>;

  /**
   * Crée ou complète une inscription en attente : compte non vérifié, nom et
   * empreinte du mot de passe posés. N'ouvre aucune session.
   *
   * Complète plutôt que de refuser, car une simple demande de code crée déjà un
   * compte non vérifié sans mot de passe : ces coquilles ne doivent pas bloquer
   * à vie l'adresse de quelqu'un.
   */
  preparerInscription(entree: {
    email: string;
    nom: string;
    motDePasseHash: string;
  }): Promise<CompteResume>;

  /** Marque l'adresse confirmée et le compte actif. */
  activerCompte(compteId: string): Promise<CompteResume>;

  /** Compare un mot de passe à l'empreinte du compte, sans la faire sortir du dépôt. */
  verifierMotDePasseCompte(compteId: string, motDePasse: string): Promise<boolean>;

  /* ──────────────────────────── L'équipe ──────────────────────────── */

  /**
   * Les adresses des comptes qui portent le rôle d'administrateur.
   *
   * C'est à elles qu'une demande nouvelle est signalée. On les lit en base
   * plutôt que dans une variable d'environnement : `ADMIN_EMAILS` ne sert
   * qu'au dépôt en mémoire, et sur Postgres c'est le rôle du compte qui fait
   * foi. Une alerte adressée à une variable oubliée ne serait signalée à
   * personne — et c'est précisément ce qu'on cherche à éviter ici.
   */
  adressesEquipe?(): Promise<string[]>;

  /* ────────────────────── Demande envoyée sans compte ────────────────────── */

  /**
   * Le compte de contact derrière une demande envoyée sans session.
   *
   * Retrouve le compte portant cette adresse, ou en crée un **non vérifié**,
   * sans mot de passe. Il n'ouvre aucune session et ne marque jamais une
   * adresse comme vérifiée : envoyer une demande n'est pas prouver qu'on relève
   * cette boîte. C'est ce qui permet de ne plus exiger de code à l'envoi sans
   * ouvrir pour autant la lecture des demandes de quelqu'un d'autre.
   *
   * Le nom et le numéro ne sont posés que sur les champs restés vides : ce sont
   * des coordonnées de rappel, et une saisie de passage ne doit pas écraser ce
   * que la personne a elle-même renseigné sur son compte.
   *
   * `creeMaintenant` dit si ce compte vient de naître. C'est à cela que l'on
   * sait s'il faut joindre des identifiants à l'e-mail de confirmation : on
   * n'envoie un mot de passe qu'à qui n'en avait pas.
   */
  visiteurDeContact(contact: {
    email: string;
    nom?: string;
    telephone?: string;
    /**
     * Mot de passe provisoire, déjà haché, posé **seulement à la création**.
     *
     * Un compte qui existe déjà garde le sien : une demande de passage ne doit
     * pas changer le mot de passe de quelqu'un — ce serait, à la lettre, le
     * moyen de lui prendre son compte.
     */
    motDePasseHash?: string;
  }): Promise<{ compte: CompteResume; creeMaintenant: boolean }>;

  /* ──────────────────────── Connexion par Google ──────────────────────── */

  /**
   * Pose le nom si le compte n'en a pas encore.
   *
   * Un compte né d'un simple code n'a pas de nom : Google en fournit un, autant
   * le garder. « Si vide » et non « toujours » : le nom saisi à l'inscription
   * est celui que la personne a choisi, et il ne doit pas être écrasé par
   * l'intitulé de son compte Google.
   *
   * Facultative, comme les autres méthodes de confort du dépôt : un dépôt qui
   * ne l'implémente pas laisse simplement le nom vide.
   */
  renseignerNomSiVide?(compteId: string, nom: string): Promise<void>;
}
