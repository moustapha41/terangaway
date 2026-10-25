"use client";

import { usePathname } from "next/navigation";
import { Icone } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";
import { lienWhatsapp } from "@/lib/assistance";

/**
 * Le bouton WhatsApp, présent sur toutes les pages du visiteur.
 *
 * Le numéro n'apparaissait que sur la page Aide : zéro bouton à l'accueil,
 * dans les résultats, sur les fiches. Or c'est le canal où ce public écrit, et
 * celui où une demande a le plus de chances d'aboutir — une conversation
 * convertit bien mieux qu'un formulaire pour une maison que l'on n'a jamais vue.
 *
 * Il s'efface sur la fiche d'un logement : celle-ci porte déjà sa barre
 * d'action fixée en bas d'écran, et son propre bouton, qui ouvre la
 * conversation sur **ce** logement et **ces** dates. Deux boutons superposés au
 * même endroit auraient caché le plus important des deux.
 */
export function WhatsappFlottant() {
  const t = useT();
  const chemin = usePathname();

  // `/fr/logements/<slug>` : quatre segments vides compris, la fiche seule.
  const segments = chemin.split("/").filter(Boolean);
  const surFicheLogement = segments[1] === "logements" && segments.length === 3;
  if (surFicheLogement) return null;

  return (
    <a
      href={lienWhatsapp(t("whatsapp.general"))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsapp.flottant")}
      data-umami-event="whatsapp-flottant"
      className={
        "fixed bottom-4 right-4 z-40 flex h-14 items-center justify-center gap-2 rounded-pill " +
        "bg-succes px-4 text-[15px] font-semibold text-white " +
        "shadow-[0_10px_28px_-8px_rgb(2_20_38/0.55)] transition-transform hover:scale-[1.04] " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-succes " +
        "active:scale-[0.98] sm:bottom-6 sm:right-6"
      }
    >
      <Icone nom="whatsapp" taille={28} />
      <span className="hidden sm:inline">{t("whatsapp.libelleFlottant")}</span>
    </a>
  );
}
