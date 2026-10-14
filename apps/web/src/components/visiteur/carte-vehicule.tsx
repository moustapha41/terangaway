import Image from "next/image";
import type { Vehicule } from "@teranga/contracts";
import { BadgeVerifie, Carte, Icone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Langue } from "@/lib/i18n/langues";
import { formaterPrix } from "@/lib/prix";

/**
 * Carte véhicule — §C.3 : photo 4:3, badge vérifié, modèle, catégorie, places,
 * bagages, **prix avec son unité**.
 *
 * L'unité change selon le besoin : « / trajet » pour un trajet, « / jour » pour
 * une location. Afficher le même montant sans son unité serait un prix faux.
 */
export function CarteVehicule({
  vehicule,
  langue,
  besoin,
}: {
  vehicule: Vehicule;
  langue: Langue;
  besoin: "trajet" | "location";
}) {
  const t = traducteurPour(langue);
  const photo = vehicule.photos[0];
  const prix = besoin === "trajet" ? vehicule.prixParTrajet : vehicule.prixParJour;
  const unite = besoin === "trajet" ? t("transport.parTrajet") : t("transport.parJour");

  return (
    <Carte className="transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.22)]">
      <Lien href={`/transports/${vehicule.slug}?besoin=${besoin}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden bg-champ">
          <Image
            src={photo.url}
            alt={photo.alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span className="absolute bottom-3 left-3">
            <BadgeVerifie libelle={t("commun.verifie")} />
          </span>
        </div>

        <div className="p-4">
          <p className="text-legende uppercase tracking-wider text-encre-douce">
            {t(`categorieVehicule.${vehicule.categorie}`)}
          </p>
          <h3 className="mt-1 text-titre-3 text-encre">
            {vehicule.marque} {vehicule.modele}
          </h3>

          <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-petit text-encre-douce">
            <li className="inline-flex items-center gap-1">
              <Icone nom="personnes" taille={16} />
              {t("transport.places", { nombre: vehicule.placesPassagers })}
            </li>
            <li className="inline-flex items-center gap-1">
              <Icone nom="bagage" taille={16} />
              {t("transport.bagagesNombre", { nombre: vehicule.bagages })}
            </li>
            {vehicule.climatisation && (
              <li className="inline-flex items-center gap-1">
                <Icone nom="climatisation" taille={16} />
                {t("transport.climatisation")}
              </li>
            )}
          </ul>

          {prix !== undefined && (
            <p className="mt-4 text-prix text-encre chiffres-tabulaires">
              {formaterPrix(prix, langue)}
              <span className="ml-1 text-petit font-normal text-encre-douce">{unite}</span>
            </p>
          )}
        </div>
      </Lien>
    </Carte>
  );
}
