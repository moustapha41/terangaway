/**
 * Les ports de données.
 *
 * Un service ne connaît jamais la provenance de ses données : il reçoit un
 * dépôt et l'interroge. Aujourd'hui l'implémentation lit `@teranga/fixtures` ;
 * demain elle lira Postgres. Les contrôleurs, les services, les tests et les
 * contrats ne bougeront pas d'une ligne.
 *
 * C'est la seule raison pour laquelle « on garde les données mockées » ne coûte
 * rien : sans ce point de passage, le mock s'infiltrerait dans les services et
 * il faudrait tout rouvrir le jour de la bascule.
 *
 * Règle : **aucun `import` de `@teranga/fixtures` hors d'un fichier
 * `*.fixtures.ts`**. Le script `verifier-depots` le fait respecter.
 */
export const DEPOT_LOGEMENTS = Symbol("DepotLogements");
export const DEPOT_VEHICULES = Symbol("DepotVehicules");
export const DEPOT_DEMANDES = Symbol("DepotDemandes");
export const DEPOT_JETONS = Symbol("DepotJetons");
export const DEPOT_PARTENAIRES = Symbol("DepotPartenaires");
export const DEPOT_COMPTES = Symbol("DepotComptes");
export const DEPOT_LIEUX = Symbol("DepotLieux");
