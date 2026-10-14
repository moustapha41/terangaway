"use client";

import { useState, type ReactNode } from "react";
import { Bandeau, Bouton, Icone } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";
import { ASSISTANCE } from "@/lib/assistance";

type Onglet = "details" | "messages" | "prestataire" | "aide";

/** Onglets du détail d'une réservation — maquette de l'espace client, écran 3. */
export function OngletsReservation({
  detail,
  prestataire,
}: {
  detail: ReactNode;
  prestataire: ReactNode;
}) {
  const t = useT();
  const [actif, setActif] = useState<Onglet>("details");

  const onglets: { cle: Onglet; libelle: string }[] = [
    { cle: "details", libelle: t("client.ongletDetails") },
    { cle: "messages", libelle: t("client.ongletMessages") },
    { cle: "prestataire", libelle: t("client.ongletPrestataire") },
    { cle: "aide", libelle: t("client.ongletAide") },
  ];

  const deplacer = (pas: number) => {
    const i = onglets.findIndex((o) => o.cle === actif);
    setActif(onglets[(i + pas + onglets.length) % onglets.length].cle);
  };

  return (
    <section>
      <div
        role="tablist"
        aria-label={t("client.ongletDetails")}
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
        {actif === "details" && detail}
        {actif === "prestataire" && prestataire}

        {/* La messagerie n'est pas dans la V1 : on le dit plutôt que d'ouvrir un
            fil vide, et on renvoie vers le canal qui existe vraiment. */}
        {actif === "messages" && (
          <Bandeau variante="information">{t("client.messagesBientot")}</Bandeau>
        )}

        {actif === "aide" && (
          <div className="space-y-4">
            <p className="text-corps text-encre-douce">{t("client.besoinAideTexte")}</p>
            <a href={`tel:${ASSISTANCE.telephone.replace(/\s/g, "")}`} className="inline-block">
              <Bouton variante="principal" largeur="contenu" icone="telephone">
                {t("client.nousContacter")}
              </Bouton>
            </a>
            <p className="flex items-center gap-2 text-petit text-encre-douce">
              <Icone nom="horloge" taille={16} />
              {t("aide.horaires")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
