"use client";

import { useSyncExternalStore } from "react";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { deviseDeLangue, formaterPrixConverti } from "@/lib/prix";

/**
 * Le bouton sous le prix : « Voir en euros » (ou « en dollars »).
 *
 * Les prix s'affichent en francs CFA : la plupart des visiteurs sont déjà au
 * Sénégal. Celui qui compte en euros ou en dollars le demande ici, et la
 * conversion s'affiche en texte secondaire, précédée de « environ » (§C.4).
 *
 * Le choix est partagé par tous les prix de la page, puis retenu d'une page à
 * l'autre : on ne le redemande pas à chaque annonce. Il vit dans le
 * `localStorage`, jamais dans une URL ni un cookie — c'est une préférence
 * d'affichage, rien que le serveur ait à savoir.
 */
const CLE = "teranga_devise_convertie";
const auditeurs = new Set<() => void>();

function lire(): boolean {
  try {
    return window.localStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}

function abonner(rappel: () => void) {
  auditeurs.add(rappel);
  window.addEventListener("storage", rappel);
  return () => {
    auditeurs.delete(rappel);
    window.removeEventListener("storage", rappel);
  };
}

let repli = false; // le navigateur refuse le stockage : on retient le choix en mémoire

function basculer() {
  const suivant = !lire() && !repli;
  try {
    window.localStorage.setItem(CLE, suivant ? "1" : "0");
  } catch {
    repli = suivant;
  }
  auditeurs.forEach((rappel) => rappel());
}

export function ConversionPrix({
  montant,
  unite,
  className = "",
}: {
  /** Le prix affiché au-dessus, en francs CFA. */
  montant: number;
  /** L'unité qui suit le prix (« / semaine »), déjà traduite. */
  unite?: string;
  className?: string;
}) {
  const t = useT();
  const langue = useLangue();
  const actif = useSyncExternalStore(abonner, () => lire() || repli, () => false);
  const dollars = deviseDeLangue(langue) === "USD";

  return (
    <div className={`mt-1 ${className}`}>
      {actif && (
        <p className="text-legende text-encre-douce chiffres-tabulaires">
          {t("commun.environ", { montant: formaterPrixConverti(montant, langue) })}
          {unite ? ` ${unite}` : ""}
        </p>
      )}
      <button
        type="button"
        onClick={basculer}
        aria-pressed={actif}
        className="mt-0.5 text-legende font-medium text-primaire underline underline-offset-2 hover:text-encre"
      >
        {actif
          ? t("commun.masquerConversion")
          : t(dollars ? "commun.voirEnDollars" : "commun.voirEnEuros")}
      </button>
    </div>
  );
}
