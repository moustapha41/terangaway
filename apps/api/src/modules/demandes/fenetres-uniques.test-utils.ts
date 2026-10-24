/**
 * Des dates qui n'ont jamais servi, pour les tests qui créent des demandes en base.
 *
 * Une offre ne se confirme qu'une fois sur des dates qui se recouvrent (voir
 * `occupation.ts`). Les tests d'intégration partagent une base **persistante** et
 * réutilisaient les mêmes dates d'un test, et d'une exécution, à l'autre : leurs
 * confirmations se seraient refusées entre elles.
 *
 * Le hasard ne suffit pas : la base ne se vide jamais, les réservations confirmées s'y
 * accumulent, et la probabilité qu'un tirage tombe sur l'une d'elles croît à chaque
 * exécution — des échecs sporadiques qui s'aggravent. Les fenêtres sont donc allouées
 * **à la suite**, à partir du jour le plus lointain déjà présent en base : aucune ne peut
 * recouvrir une demande existante, et l'exécution suivante repart après celle-ci.
 *
 * À appeler une fois par fichier, dans `beforeAll`, après `prisma.$connect()` :
 * `await reserverFenetres(prisma)`.
 *
 * **Réservé aux tests** : rien dans `src` ne doit l'importer, comme
 * `base-de-test.test-utils.ts`.
 */

const JOUR = 86_400_000;
/** Écart entre deux fenêtres allouées : un séjour de 7 nuits et ses voisins immédiats tiennent dedans. */
const ECART_JOURS = 24;
const DEPART = Date.UTC(2300, 0, 1);

let prochain: number | undefined;

interface LecteurBase {
  $queryRaw<T = unknown>(requete: TemplateStringsArray, ...valeurs: unknown[]): Promise<T>;
}

/** Fixe le point de départ : le lendemain du jour le plus lointain déjà porté par une demande. */
export async function reserverFenetres(prisma: LecteurBase): Promise<void> {
  const lignes = await prisma.$queryRaw<{ dernier: string | null }[]>`
    SELECT max(substr("dateDebut", 1, 10)) AS dernier
    FROM "demands"
    WHERE "dateDebut" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'`;
  const dernier = lignes[0]?.dernier ? Date.parse(`${lignes[0].dernier}T00:00:00Z`) : Number.NaN;
  prochain = Math.max(DEPART, Number.isNaN(dernier) ? DEPART : dernier + 2 * ECART_JOURS * JOUR);
}

function suivant(): number {
  if (prochain === undefined) {
    throw new Error("Appelez `await reserverFenetres(prisma)` dans le `beforeAll` du fichier de test.");
  }
  const jour = prochain;
  prochain += ECART_JOURS * JOUR;
  return jour;
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Un séjour de `nuits` nuits : `{ debut, fin }`, à étaler dans une demande de logement. */
export function fenetreUnique(nuits = 4): { debut: string; fin: string } {
  const debut = suivant() + 8 * JOUR; // marge avant : un séjour voisin tient avant le début
  return { debut: iso(debut), fin: iso(debut + nuits * JOUR) };
}

/** Un instant de prise en charge, le jour étant jamais utilisé : pour une location ou un trajet. */
export function instantUnique(heure = "09:00"): string {
  return `${iso(suivant() + 8 * JOUR)}T${heure}`;
}
