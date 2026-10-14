"use client";

import { useState } from "react";
import type { Avis, Logement } from "@teranga/contracts";
import { Bandeau, Icone } from "@teranga/ui";
import { CarteTuiles } from "@/lib/carte/carte-tuiles";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { formaterDateComplete } from "@/lib/dates";

type Onglet = "description" | "equipements" | "regles" | "localisation" | "avis";

/**
 * Onglets de la fiche — maquette écran 03.
 *
 * De vrais onglets : `role="tablist"`, flèches gauche/droite, et un seul panneau
 * monté à la fois. Le contenu reste dans la page — pas de requête — pour que le
 * passage d'un onglet à l'autre soit instantané même en 3G.
 */
export function OngletsFiche({ logement, avis }: { logement: Logement; avis: Avis[] }) {
  const t = useT();
  const langue = useLangue();
  const [actif, setActif] = useState<Onglet>("description");

  const onglets: { cle: Onglet; libelle: string }[] = [
    { cle: "description", libelle: t("fiche.ongletDescription") },
    { cle: "equipements", libelle: t("fiche.ongletEquipements") },
    { cle: "regles", libelle: t("fiche.ongletRegles") },
    { cle: "localisation", libelle: t("fiche.ongletLocalisation") },
    { cle: "avis", libelle: t("fiche.ongletAvis", { nombre: logement.nombreAvis ?? 0 }) },
  ];

  const deplacer = (pas: number) => {
    const i = onglets.findIndex((o) => o.cle === actif);
    setActif(onglets[(i + pas + onglets.length) % onglets.length].cle);
  };

  return (
    <section>
      <div
        role="tablist"
        aria-label={t("fiche.ongletDescription")}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") deplacer(1);
          if (e.key === "ArrowLeft") deplacer(-1);
        }}
        className="flex gap-6 overflow-x-auto border-b border-contour [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {onglets.map((onglet) => {
          const selectionne = onglet.cle === actif;
          return (
            <button
              key={onglet.cle}
              role="tab"
              type="button"
              aria-selected={selectionne}
              tabIndex={selectionne ? 0 : -1}
              onClick={() => setActif(onglet.cle)}
              className={
                "relative shrink-0 pb-3 pt-1 text-corps transition-colors " +
                (selectionne ? "font-semibold text-encre" : "text-encre-douce hover:text-encre")
              }
            >
              {onglet.libelle}
              {selectionne && (
                <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-pill bg-primaire" />
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="pt-6">
        {actif === "description" && (
          <p className="max-w-[70ch] text-corps leading-relaxed text-encre-douce">
            {logement.description}
          </p>
        )}

        {actif === "equipements" && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {logement.equipements.map((equipement) => (
              <li key={equipement} className="flex items-center gap-2 text-corps text-encre">
                <Icone nom="coche-cercle" taille={20} className="shrink-0 text-succes" />
                {t(`equipement.${equipement}`)}
              </li>
            ))}
          </ul>
        )}

        {actif === "regles" && (
          <div className="space-y-5">
            <ul className="space-y-2">
              {(logement.regles ?? []).map((regle) => (
                <li key={regle} className="flex items-start gap-2 text-corps text-encre">
                  <Icone nom="information" taille={20} className="mt-0.5 shrink-0 text-encre-douce" />
                  {regle}
                </li>
              ))}
            </ul>
            <div>
              <h3 className="mb-1 text-titre-3 text-encre">{t("fiche.annulation")}</h3>
              <p className="text-corps text-encre-douce">{logement.conditionsAnnulation}</p>
            </div>
          </div>
        )}

        {actif === "localisation" && (
          <div className="space-y-4">
            <p className="text-corps text-encre-douce">{t("fiche.localisationTexte")}</p>
            {logement.position && (
              <CarteTuiles
                etiquette={t("fiche.ongletLocalisation")}
                className="h-[360px] w-full"
                reperes={[
                  {
                    id: logement.id,
                    latitude: logement.position.latitude,
                    longitude: logement.position.longitude,
                    libelle: logement.quartier,
                    actif: true,
                  },
                ]}
              />
            )}
          </div>
        )}

        {actif === "avis" &&
          (avis.length === 0 ? (
            <Bandeau variante="information">{t("fiche.aucunAvis")}</Bandeau>
          ) : (
            <ul className="space-y-5">
              {avis.map((a) => (
                <li key={a.id} className="border-b border-contour pb-5 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-titre-3 text-encre">{a.auteur}</p>
                    <p className="flex items-center gap-1 text-petit text-encre">
                      <Etoile />
                      <span className="font-semibold chiffres-tabulaires">{a.note}</span>
                      <span className="sr-only">{t("fiche.noteSur", { note: a.note })}</span>
                    </p>
                  </div>
                  <p className="mt-0.5 text-petit text-encre-douce chiffres-tabulaires">
                    {formaterDateComplete(new Date(a.date), langue)}
                  </p>
                  <p className="mt-2 text-corps text-encre-douce">{a.texte}</p>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}

function Etoile() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="#F4B942">
      <path d="m12 2 2.9 6.3 6.8.8-5 4.7 1.3 6.8L12 17.3 6 20.6l1.3-6.8-5-4.7 6.8-.8Z" />
    </svg>
  );
}
