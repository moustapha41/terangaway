import type { StatutDemande } from "@teranga/contracts";

/**
 * L'état d'une demande, en pastille.
 *
 * La couleur n'est pas une décoration : « envoyée » clignote en ambre parce
 * que c'est le seul statut qui réclame un geste de l'équipe, et le vert de
 * « confirmée » dit que l'affaire est close. Le libellé arrive traduit —
 * le composant ne connaît pas les langues, seulement les états.
 *
 * Partagé entre le tableau de bord et la liste des demandes : la même pastille
 * ne doit pas avoir deux palettes selon l'écran où on la regarde.
 */
export function BadgeStatut({ statut, libelle }: { statut: StatutDemande; libelle: string }) {
  let style = "bg-slate-100 text-slate-700 border-slate-200";
  let dot = "bg-slate-400";

  switch (statut) {
    case "envoyee":
      style = "bg-amber-50 text-amber-900 border-amber-200";
      dot = "bg-amber-500 animate-pulse";
      break;
    case "acceptee":
      style = "bg-blue-50 text-blue-900 border-blue-200";
      dot = "bg-blue-500";
      break;
    case "confirmee":
      style = "bg-emerald-50 text-emerald-900 border-emerald-200";
      dot = "bg-emerald-500";
      break;
    case "terminee":
      style = "bg-slate-100 text-slate-700 border-slate-200";
      dot = "bg-slate-400";
      break;
    case "refusee":
      style = "bg-rose-50 text-rose-900 border-rose-200";
      dot = "bg-rose-500";
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span>{libelle}</span>
    </span>
  );
}
