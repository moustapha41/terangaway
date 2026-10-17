"use client";

import { Carte, Icone } from "@teranga/ui";
import { LANGUES, NOMS_LANGUE } from "@/lib/i18n/langues";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { usePreferences, type Devise } from "@/features/preferences/use-preferences";
import { SelecteurLangue } from "@/components/layout/selecteur-langue";

/**
 * Paramètres — maquette de l'espace client, écran mobile 8.
 *
 * Tout ce qui est ici est **réellement appliqué** : la langue change l'URL, la
 * devise ajoute la conversion sous les prix (§C.4). Les notifications sont
 * enregistrées mais pas encore envoyées — l'écran le dit, plutôt que de laisser
 * croire à un abonnement qui n'existe pas.
 */
const DEVISES: Devise[] = ["aucune", "EUR", "USD"];

export function Reglages() {
  const t = useT();
  const langue = useLangue();
  const { preferences, modifier } = usePreferences();

  return (
    <div className="space-y-6">
      <Carte className="divide-y divide-contour">
        <Rangee icone="information" libelle={t("client.langue")}>
          <span className="flex items-center gap-3">
            <span className="text-petit text-encre-douce">{NOMS_LANGUE[langue]}</span>
            <SelecteurLangue />
          </span>
        </Rangee>

        <Rangee icone="prix" libelle={t("client.devise")}>
          <select
            value={preferences.devise}
            onChange={(e) => modifier({ devise: e.target.value as Devise })}
            className="min-h-[var(--size-touch)] rounded-control border border-contour-champ bg-surface px-3 text-[16px] text-encre"
          >
            {DEVISES.map((devise) => (
              <option key={devise} value={devise}>
                {devise === "aucune" ? t("client.deviseAucune") : `${devise} · FCFA`}
              </option>
            ))}
          </select>
        </Rangee>
      </Carte>
      <p className="-mt-3 text-legende text-encre-douce">{t("client.deviseTexte")}</p>

      <Carte className="divide-y divide-contour">
        <Rangee icone="alerte" libelle={t("client.notificationsPush")}>
          <Interrupteur
            actif={preferences.notificationsPush}
            libelle={t("client.notificationsPush")}
            onChange={(v) => modifier({ notificationsPush: v })}
          />
        </Rangee>
        <Rangee icone="information" libelle={t("client.notificationsEmail")}>
          <Interrupteur
            actif={preferences.notificationsEmail}
            libelle={t("client.notificationsEmail")}
            onChange={(v) => modifier({ notificationsEmail: v })}
          />
        </Rangee>
      </Carte>
      <p className="-mt-3 text-legende text-encre-douce">{t("client.notificationsTexte")}</p>

      <p className="flex items-center gap-2 text-legende text-encre-douce">
        <Icone nom="verification" taille={16} />
        {t("client.enregistreLocalement")} · {LANGUES.length} langues
      </p>
    </div>
  );
}

function Rangee({
  icone,
  libelle,
  children,
}: {
  icone: "information" | "prix" | "alerte";
  libelle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[var(--size-control)] flex-wrap items-center justify-between gap-3 px-5 py-3">
      <span className="flex items-center gap-3 text-petit text-encre">
        <Icone nom={icone} taille={20} className="text-encre-douce" />
        {libelle}
      </span>
      {children}
    </div>
  );
}

/**
 * Interrupteur bâti sur une case à cocher : l'état coché, le clavier et
 * l'annonce viennent du navigateur ; seule l'apparence est à nous.
 */
function Interrupteur({
  actif,
  libelle,
  onChange,
}: {
  actif: boolean;
  libelle: string;
  onChange: (actif: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center">
      <span className="sr-only">{libelle}</span>
      <input
        type="checkbox"
        role="switch"
        checked={actif}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={
          "relative h-7 w-12 rounded-pill transition-colors " +
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primaire " +
          (actif ? "bg-succes" : "bg-contour")
        }
      >
        <span
          className={
            "absolute top-1 h-5 w-5 rounded-pill bg-white transition-all " +
            (actif ? "left-6" : "left-1")
          }
        />
      </span>
    </label>
  );
}
