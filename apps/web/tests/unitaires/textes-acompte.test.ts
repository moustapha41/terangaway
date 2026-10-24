import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Les textes publics ne doivent plus présenter l'interdiction des acomptes
 * comme une règle : Teranga Way peut en demander après acceptation, selon le
 * service, et les partenaires n'en demandent jamais eux-mêmes.
 *
 * Le test cherche des formulations précises, pas le mot « acompte » : les
 * textes d'administration et les consignes aux partenaires l'emploient à bon
 * escient.
 */
const RACINE = join(__dirname, "../..");
const messages = Object.fromEntries(
  ["fr", "en", "es"].map((l) => [l, JSON.parse(readFileSync(join(RACINE, `src/messages/${l}.json`), "utf8"))]),
);

function valeurs(o: unknown, chemin = ""): Array<[string, string]> {
  if (typeof o === "string") return [[chemin, o]];
  if (o && typeof o === "object") {
    return Object.entries(o).flatMap(([k, v]) => valeurs(v, chemin ? `${chemin}.${k}` : k));
  }
  return [];
}

const INTERDICTIONS: Record<string, RegExp[]> = {
  fr: [
    /aucun acompte/i,
    /sans acompte/i,
    // « n'encaissez jamais d'acompte vous-même » vise la procédure, pas l'acompte.
    /jamais d['’]acompte(?! vous-même)/i,
    /acompte[^.]{0,40}jamais/i,
    /ne percevons aucun paiement/i,
    /aucun paiement ne transite/i,
  ],
  en: [/no deposit/i, /never ask(s)? (the visitor )?for a deposit/i, /deposit ever asked/i, /take no payment/i, /no payment goes through/i],
  es: [/ningún anticipo/i, /nunca (pida )?un anticipo/i, /no percibimos ningún pago/i, /ningún pago pasa por/i],
};

describe("Textes publics — l'acompte n'est plus présenté comme interdit", () => {
  for (const langue of ["fr", "en", "es"]) {
    it(`${langue} : aucune formulation d'interdiction générale`, () => {
      // L'espace équipe (`admin.*`) décrit l'état d'un dossier (« aucun acompte
      // n'est ouvert ») : ce n'est pas une règle commerciale.
      const fautifs = valeurs(messages[langue])
        .filter(([chemin]) => !chemin.startsWith("admin."))
        .filter(([, texte]) => INTERDICTIONS[langue].some((motif) => motif.test(texte)));
      expect(fautifs).toEqual([]);
    });
  }

  it("la page de réponse du partenaire interdit de demander l'acompte soi-même, pas tout acompte", () => {
    const source = readFileSync(join(RACINE, "src/app/(hors-langue)/reponse/[jeton]/page.tsx"), "utf8");
    expect(source).not.toMatch(/Ne demandez jamais d['’]acompte/);
    expect(source).toMatch(/n['’]encaissez jamais d['’]acompte vous-même/);
    expect(source).toMatch(/Teranga Way\s+le demande au visiteur/);
  });

  it.each(["fr", "en", "es"])("%s : la règle partenaire vise la procédure, pas tous les acomptes", (langue) => {
    const p = messages[langue].prestataire;
    expect(p.rappelAcompte).toMatch(/Teranga Way/);
    expect(p.aideCharteTexte).toMatch(/Teranga Way/);
  });

  it.each(["fr", "en", "es"])("%s : la FAQ de paiement dit que seul le statut confirme la réservation", (langue) => {
    const r: string = messages[langue].aide.q.paiementR;
    expect(r).toMatch(/Teranga Way/);
    // Un acompte payé ne confirme pas : la FAQ renvoie au statut de la demande.
    expect(r).toMatch(/statut|status|estado/i);
  });

  it.each(["fr", "en", "es"])("%s : les mentions légales ne nient plus que Teranga Way encaisse", (langue) => {
    const t: string = messages[langue].public.legalRoleTexte;
    expect(t).toMatch(/Teranga Way/);
    expect(t).toMatch(/acompte|deposit|anticipo/i);
  });
});
