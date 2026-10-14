import type { Langue } from "./langues";

/**
 * Le traducteur, sans aucun catalogue : ce fichier part dans le navigateur, donc
 * il ne doit importer aucun JSON de langue. Le catalogue actif lui est passé par
 * le serveur — sinon les trois langues voyageraient à chaque chargement.
 */
export type Valeurs = Record<string, string | number>;

export type Catalogue = Record<string, unknown>;

export interface Traducteur {
  (cle: string, valeurs?: Valeurs): string;
}

function descendre(catalogue: Catalogue, chemin: string): unknown {
  return chemin.split(".").reduce<unknown>((noeud, segment) => {
    if (noeud && typeof noeud === "object" && segment in noeud) {
      return (noeud as Record<string, unknown>)[segment];
    }
    return undefined;
  }, catalogue);
}

function interpoler(gabarit: string, valeurs?: Valeurs): string {
  if (!valeurs) return gabarit;
  return gabarit.replace(/\{(\w+)\}/g, (brut, nom: string) =>
    nom in valeurs ? String(valeurs[nom]) : brut,
  );
}

/**
 * Une clé absente renvoie la clé elle-même : un écran ne se casse jamais pour une
 * traduction manquante, et le texte brut rend l'oubli visible à l'œil nu.
 * La parité des trois catalogues est vérifiée par `pnpm -F @teranga/web i18n:verifier`.
 */
export function creerTraducteur(catalogue: Catalogue, langue: Langue): Traducteur {
  const pluriels = new Intl.PluralRules(langue);

  return (cle, valeurs) => {
    const noeud = descendre(catalogue, cle);

    if (typeof noeud === "string") return interpoler(noeud, valeurs);

    if (noeud && typeof noeud === "object") {
      const nombre = valeurs?.nombre;
      if (typeof nombre === "number") {
        const formes = noeud as Record<string, string>;
        const forme = formes[pluriels.select(nombre)] ?? formes.other;
        if (typeof forme === "string") return interpoler(forme, valeurs);
      }
    }

    return cle;
  };
}
