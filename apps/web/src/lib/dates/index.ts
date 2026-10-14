import type { Langue } from "@/lib/i18n/langues";

/**
 * Dates — dossier de conception §C.5 : « 30 oct. », « Oct 30 », « 30 oct ».
 * `Intl.DateTimeFormat` produit exactement ces trois formes ; rien à écrire à la main.
 *
 * Tout est calculé sur le fuseau de Dakar : un visiteur qui prépare son voyage
 * depuis Paris ou Bogota doit voir la date du séjour, pas celle de son téléphone.
 */
const FUSEAU = "Africa/Dakar";

/**
 * Uniformise les espaces produits par `Intl`.
 *
 * Node et le navigateur n'embarquent pas la même version d'ICU : pour une même
 * plage de dates, Node entoure le tiret d'espaces fines (U+2009) là où Chrome
 * met des espaces ordinaires. Le texte est identique à l'œil, mais React voit
 * deux chaînes différentes et l'hydratation échoue.
 *
 * On ramène donc toutes les espaces exotiques à l'espace ordinaire. Les prix,
 * eux, gardent volontairement leur espace insécable étroite : ils sont formatés
 * dans `lib/prix`, qui la pose lui-même et reste donc déterministe.
 */
function normaliser(texte: string): string {
  return texte.replace(/[\u2009\u202F\u00A0\u2060]/g, " ");
}

export function formaterDate(date: Date, langue: Langue): string {
  return normaliser(
    new Intl.DateTimeFormat(langue, {
      day: "numeric",
      month: "short",
      timeZone: FUSEAU,
    }).format(date),
  );
}

export function formaterDateComplete(date: Date, langue: Langue): string {
  return normaliser(
    new Intl.DateTimeFormat(langue, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: FUSEAU,
    }).format(date),
  );
}

export function formaterHeure(date: Date, langue: Langue): string {
  return normaliser(
    new Intl.DateTimeFormat(langue, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: FUSEAU,
    }).format(date),
  );
}

/**
 * Une plage de dates : « 12 – 26 janv. 2026 » si le mois est le même,
 * « 28 janv. – 3 févr. 2026 » sinon. `formatRange` choisit tout seul.
 */
export function formaterPlage(debut: Date, fin: Date, langue: Langue): string {
  return normaliser(
    new Intl.DateTimeFormat(langue, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: FUSEAU,
    }).formatRange(debut, fin),
  );
}

/** Nombre de nuits entre deux dates, pour le calcul du prix total. */
export function nombreDeNuits(debut: Date, fin: Date): number {
  const jour = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((fin.getTime() - debut.getTime()) / jour));
}

/**
 * Durée restante avant une échéance, en clair : « dans 1 h » plutôt qu'un
 * horodatage brut. `Intl.RelativeTimeFormat` choisit l'unité et accorde.
 */
export function dureeRestante(echeance: Date, langue: Langue, maintenant = new Date()): string {
  const format = new Intl.RelativeTimeFormat(langue, { numeric: "auto", style: "long" });
  const dire = (valeur: number, unite: Intl.RelativeTimeFormatUnit) =>
    normaliser(format.format(valeur, unite));
  const minutes = Math.round((echeance.getTime() - maintenant.getTime()) / 60000);

  if (Math.abs(minutes) < 60) return dire(minutes, "minute");
  const heures = Math.round(minutes / 60);
  if (Math.abs(heures) < 24) return dire(heures, "hour");
  return dire(Math.round(heures / 24), "day");
}
