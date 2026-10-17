import type { Langue } from "@/lib/i18n/langues";

/**
 * Une date et une heure, dans la langue de l'équipe.
 *
 * Le backoffice affiche l'heure partout : « reçue le 17 octobre » ne suffit
 * pas quand le délai de réponse d'un taxi est de trente minutes.
 */
export function formaterDateHeure(iso: string, langue: Langue): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(langue, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/** Une date seule, quand l'heure n'a pas de sens : une période de séjour. */
export function formaterJour(iso: string, langue: Langue): string {
  if (!iso) return "—";
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(langue, { dateStyle: "medium" }).format(date);
}
