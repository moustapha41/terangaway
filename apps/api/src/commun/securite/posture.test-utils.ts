import { config } from "../../config/configuration";

/**
 * Bascule temporairement la posture de sécurité, le temps d'un test.
 *
 * `config` est figé au démarrage, ce qui est voulu en production et gênant en
 * test : vérifier qu'un accès est refusé demande de pouvoir fermer le verrou.
 * Plutôt que de laisser chaque test caster `config` dans son coin — et oublier
 * un jour de le remettre —, cet utilitaire restaure toujours l'état initial,
 * y compris si l'assertion échoue.
 *
 * Réservé aux tests : rien dans `src` ne doit l'importer.
 */
type PostureModifiable = {
  autoriserComptesDemo: boolean;
  environnement: string;
  estProduction: boolean;
};

export interface PostureSouhaitee {
  /** Les raccourcis de démonstration sont-ils ouverts ? */
  comptesDemo: boolean;
  /** Valeur de `NODE_ENV` vue par le code, si le test en dépend. */
  environnement?: string;
}

export async function avecPosture(
  posture: PostureSouhaitee,
  corps: () => Promise<void> | void,
): Promise<void> {
  const mutable = config as unknown as PostureModifiable;
  const initial = {
    autoriserComptesDemo: mutable.autoriserComptesDemo,
    environnement: mutable.environnement,
    estProduction: mutable.estProduction,
  };

  mutable.autoriserComptesDemo = posture.comptesDemo;
  if (posture.environnement !== undefined) {
    mutable.environnement = posture.environnement;
    mutable.estProduction = posture.environnement === "production";
  }

  try {
    await corps();
  } finally {
    mutable.autoriserComptesDemo = initial.autoriserComptesDemo;
    mutable.environnement = initial.environnement;
    mutable.estProduction = initial.estProduction;
  }
}

/** Raccourci le plus fréquent : la posture réelle de production. */
export function enProduction(corps: () => Promise<void> | void): Promise<void> {
  return avecPosture({ comptesDemo: false, environnement: "production" }, corps);
}
