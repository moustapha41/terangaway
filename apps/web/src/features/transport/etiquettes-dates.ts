import type { EtiquettesDates, Plage } from "@teranga/ui";
import type { Langue } from "@/lib/i18n/langues";
import type { Traducteur } from "@/lib/i18n/traducteur";
import { formaterDateComplete, formaterPlage } from "@/lib/dates";

/**
 * Les libellés du calendrier, traduits et mis en forme ici.
 *
 * `SelecteurDates` ne connaît aucune langue : il affiche ce qu'on lui donne.
 * C'est donc l'application qui nomme les mois et les jours, avec `Intl`, pour
 * que le calendrier soit juste en français, en anglais et en espagnol sans que
 * `@teranga/ui` embarque la moindre traduction.
 */
export function etiquettesDates(t: Traducteur, langue: Langue): EtiquettesDates {
  const nomMois = new Intl.DateTimeFormat(langue, { month: "long", year: "numeric" });
  // Une semaine de référence commençant un lundi, pour les en-têtes de colonnes.
  const nomJour = new Intl.DateTimeFormat(langue, { weekday: "short" });

  return {
    ouvrir: t("recherche.choisirDates"),
    titre: t("recherche.dates"),
    fermer: t("demande.fermer"),
    moisPrecedent: t("recherche.moisPrecedent"),
    moisSuivant: t("recherche.moisSuivant"),
    valider: t("recherche.valider"),
    effacer: t("recherche.effacer"),
    jours: Array.from({ length: 7 }, (_, i) => nomJour.format(new Date(2024, 0, 1 + i))),
    nomMois: (annee, mois) => nomMois.format(new Date(annee, mois, 1)),
    dateComplete: (iso) => formaterDateComplete(new Date(`${iso}T00:00:00`), langue),
    vide: t("recherche.choisirDates"),
    etapeDebut: t("recherche.etapeDebut"),
    etapeFin: t("recherche.etapeFin"),
    etapeComplete: t("recherche.etapeComplete"),
    debut: t("fiche.debut"),
    fin: t("fiche.fin"),
    nuits: (nombre: number) => t("fiche.nuits", { nombre }),
    resume: (plage: Plage) =>
      plage.debut && plage.fin
        ? formaterPlage(new Date(`${plage.debut}T00:00:00`), new Date(`${plage.fin}T00:00:00`), langue)
        : plage.debut
          ? formaterDateComplete(new Date(`${plage.debut}T00:00:00`), langue)
          : "",
  };
}
