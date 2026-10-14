/** Concatène des classes en ignorant false, null et undefined. Pas de dépendance. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
