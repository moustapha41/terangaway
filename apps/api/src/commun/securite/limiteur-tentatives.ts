/**
 * Limiteur de tentatives à fenêtre glissante, en mémoire.
 *
 * Il sert la connexion par mot de passe, que le limiteur OTP ne couvre pas :
 * celui-ci compte les lignes `otp_challenges`, et une tentative de connexion
 * n'en crée aucune. Les compter là reviendrait à faire tomber le quota d'envoi
 * de codes de quelqu'un en se trompant de mot de passe.
 *
 * **Limite assumée : la mémoire du processus.** Avec plusieurs instances d'API,
 * chacune compterait de son côté, et un redémarrage remet les compteurs à zéro.
 * La pile de déploiement n'a qu'un service `api`, donc la protection tient
 * aujourd'hui. Le jour où l'API passe à l'échelle, ces compteurs doivent aller
 * en base ou dans Redis — c'est écrit ici pour que ce ne soit pas oublié.
 */
export interface DecisionTentatives {
  autorise: boolean;
  /** Secondes à attendre avant une nouvelle tentative, quand c'est refusé. */
  delaiRestantSecondes?: number;
}

export class LimiteurTentatives {
  private readonly tentatives = new Map<string, number[]>();

  constructor(
    private readonly maximum: number,
    private readonly fenetreMs: number,
    /** Injectable pour que les tests n'aient pas à attendre. */
    private readonly maintenant: () => number = () => Date.now(),
  ) {}

  /** Cette clé a-t-elle encore droit à une tentative ? N'enregistre rien. */
  verifier(cle: string): DecisionTentatives {
    const recentes = this.recentes(cle);
    if (recentes.length < this.maximum) return { autorise: true };

    // La plus ancienne de la fenêtre décide du moment où une place se libère.
    const plusAncienne = recentes[0];
    const delaiRestantSecondes = Math.max(
      1,
      Math.ceil((plusAncienne + this.fenetreMs - this.maintenant()) / 1000),
    );
    return { autorise: false, delaiRestantSecondes };
  }

  /** Enregistre une tentative échouée. Une réussite ne compte pas. */
  enregistrerEchec(cle: string): void {
    const recentes = this.recentes(cle);
    recentes.push(this.maintenant());
    this.tentatives.set(cle, recentes);
  }

  /** Efface le compteur : à appeler sur une authentification réussie. */
  reinitialiser(cle: string): void {
    this.tentatives.delete(cle);
  }

  /** Les tentatives encore dans la fenêtre, les anciennes étant oubliées au passage. */
  private recentes(cle: string): number[] {
    const limite = this.maintenant() - this.fenetreMs;
    const gardees = (this.tentatives.get(cle) ?? []).filter((t) => t > limite);
    if (gardees.length === 0) {
      this.tentatives.delete(cle);
    } else {
      this.tentatives.set(cle, gardees);
    }
    return gardees;
  }
}
