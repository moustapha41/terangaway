"use client";

import { useState } from "react";
import type { Vehicule } from "@teranga/contracts";
import { Bandeau, Carte, Icone, Onglets } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";

/**
 * Onglets de la fiche véhicule — maquette transport, écran 4.
 *
 * La maquette propose un onglet « Avis ». Aucun véhicule ne porte de note dans
 * le contrat, et le dossier reportait les avis après le MVP (§D.1) : plutôt que
 * d'inventer « 4,8 (120 avis) », l'onglet dit quand ils arriveront.
 *
 * « Ce qui est inclus » n'est pas une liste écrite à la main non plus : chaque
 * ligne est déduite d'un champ réel de l'offre. Une prestation qui ne porte pas
 * le champ ne voit pas la ligne apparaître.
 */
type Cle = "apercu" | "details" | "prestataire";

export function OngletsVehicule({ vehicule }: { vehicule: Vehicule }) {
  const t = useT();
  const [actif, setActif] = useState<Cle>("apercu");

  const inclus: string[] = [];
  if (vehicule.chauffeur) inclus.push(t("ficheVehicule.inclusChauffeur"));
  if (vehicule.climatisation) inclus.push(t("ficheVehicule.inclusClimatisation"));
  if (vehicule.carburantALaCharge === "partenaire")
    inclus.push(t("ficheVehicule.inclusCarburant"));
  if (vehicule.kilometrageInclus)
    inclus.push(t("ficheVehicule.inclusKilometrage", { nombre: vehicule.kilometrageInclus }));
  if (vehicule.chauffeur?.languesParlees.length)
    inclus.push(
      t("ficheVehicule.inclusLangues", { langues: vehicule.chauffeur.languesParlees.join(", ") }),
    );
  if (vehicule.lieuDeRemise)
    inclus.push(t("ficheVehicule.inclusRemise", { lieu: vehicule.lieuDeRemise }));

  return (
    <div>
      <Onglets
        onglets={[
          { cle: "apercu", libelle: t("ficheVehicule.ongletApercu") },
          { cle: "details", libelle: t("ficheVehicule.ongletDetails") },
          { cle: "prestataire", libelle: t("ficheVehicule.ongletPrestataire") },
        ]}
        actif={actif}
        onChange={setActif}
        etiquette={t("ficheVehicule.ongletApercu")}
      />

      <div className="mt-5">
        {actif === "apercu" && (
          <div className="space-y-5">
            <p className="text-corps leading-relaxed text-encre-douce">
              {t("ficheVehicule.apercuTexte")}
            </p>

            <div>
              <h3 className="text-titre-3 text-encre">{t("ficheVehicule.ceQuiEstInclus")}</h3>
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {inclus.map((ligne) => (
                  <li key={ligne} className="flex items-start gap-2.5 text-petit text-encre">
                    <Icone
                      nom="coche-cercle"
                      taille={20}
                      className="mt-0.5 shrink-0 text-succes"
                    />
                    {ligne}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-titre-3 text-encre">{t("ficheVehicule.inclusZones")}</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {vehicule.zonesCouvertes.map((zone) => (
                  <li
                    key={zone}
                    className="inline-flex items-center gap-1.5 rounded-pill bg-champ px-3 py-1.5 text-legende text-encre"
                  >
                    <Icone nom="repere" taille={16} />
                    {zone}
                  </li>
                ))}
              </ul>
            </div>

            <Bandeau variante="information">{t("ficheVehicule.avisBientot")}</Bandeau>
          </div>
        )}

        {actif === "details" && (
          <Carte>
            <dl className="divide-y divide-contour">
              <Ligne terme={t("ficheVehicule.detailCategorie")}>
                {t(`categorieVehicule.${vehicule.categorie}`)}
              </Ligne>
              <Ligne terme={t("ficheVehicule.detailAnnee")}>
                <span className="chiffres-tabulaires">{vehicule.annee}</span>
              </Ligne>
              <Ligne terme={t("ficheVehicule.detailPlaces")}>
                <span className="chiffres-tabulaires">{vehicule.placesPassagers}</span>
              </Ligne>
              <Ligne terme={t("ficheVehicule.detailBagages")}>
                <span className="chiffres-tabulaires">{vehicule.bagages}</span>
              </Ligne>
              <Ligne terme={t("ficheVehicule.detailPaiement")}>
                {vehicule.moyensDePaiement.map((m) => t(`moyenDePaiement.${m}`)).join(" · ")}
              </Ligne>
            </dl>
          </Carte>
        )}

        {actif === "prestataire" && (
          <Carte className="p-5">
            <div className="flex items-start gap-4">
              {/* Initiales, jamais de photo : §A.7, aucune personne reconnaissable. */}
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-teinte-bleu text-titre-3 font-semibold text-primaire">
                {vehicule.partenaire.nomAffiche.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-titre-3 text-encre">{vehicule.partenaire.nomAffiche}</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-petit text-succes">
                  <Icone nom="verification" taille={16} />
                  {t("ficheVehicule.partenaireVerifie")}
                </p>
                {vehicule.partenaire.membreDepuis && (
                  <p className="mt-1 text-petit text-encre-douce">
                    {t("ficheVehicule.membreDepuis", { annee: vehicule.partenaire.membreDepuis })}
                  </p>
                )}
                <p className="mt-3 text-legende text-encre-douce">
                  {t("fiche.verifiePar", {
                    date: vehicule.partenaire.verifieLe,
                    par: vehicule.partenaire.verifiePar,
                  })}
                </p>
              </div>
            </div>
          </Carte>
        )}
      </div>
    </div>
  );
}

function Ligne({ terme, children }: { terme: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <dt className="text-petit text-encre-douce">{terme}</dt>
      <dd className="text-petit text-encre">{children}</dd>
    </div>
  );
}
