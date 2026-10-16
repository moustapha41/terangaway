import { ArrowRight } from "lucide-react";
import { CarteVehicule } from "@/components/visiteur/carte-vehicule";
import { Lien } from "@/lib/i18n/lien";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Langue } from "@/lib/i18n/langues";
import { chercherVehicules } from "@/mocks/api";

/**
 * Le parc, montré tel quel sur l'écran transport.
 *
 * Avant, les véhicules n'existaient qu'au bout d'un formulaire : sur
 * `/transports/location`, le bouton « Voir les véhicules disponibles » reste
 * grisé tant qu'aucune date n'est choisie. Un visiteur qui veut simplement
 * savoir ce qu'on propose n'avait rien à regarder — alors que les logements,
 * eux, ont leur catalogue ouvert.
 *
 * Le prix est affiché **par trajet** : c'est le besoin le plus courant à
 * l'arrivée (un transfert depuis l'aéroport), et la carte porte son unité.
 */
export async function ParcVehicules({ langue }: { langue: Langue }) {
  const t = traducteurPour(langue);

  // Cette bande complète l'écran transport ; elle n'en est pas le sujet — les
  // quatre formulaires de recherche le sont. Si le catalogue ne répond pas,
  // la section disparaît et le reste de la page continue de servir.
  let vehicules: Awaited<ReturnType<typeof chercherVehicules>> = [];
  try {
    vehicules = await chercherVehicules("trajet", {});
  } catch (erreur) {
    console.error("[transports] parc indisponible", erreur);
    return null;
  }

  if (vehicules.length === 0) return null;

  return (
    <section className="bg-white">
      <div className="mx-auto w-[87.5%] max-w-[1260px] py-14 md:py-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
              {t("transport.parc.surtitre")}
            </p>
            <h2 className="mt-3 text-[clamp(26px,2.6vw,34px)] font-bold tracking-[-0.02em] text-nuit">
              {t("transport.parc.titre", { nombre: vehicules.length })}
            </h2>
            <span className="mt-2 block h-[3px] w-[48px] rounded-full bg-jaune-vif" />
          </div>

          <Lien
            href="/transports/trajet"
            className="inline-flex items-center gap-2 text-[15px] font-semibold text-nuit underline decoration-nuit/30 underline-offset-4 transition-colors hover:decoration-nuit"
          >
            {t("transport.parc.reserver")}
            <ArrowRight strokeWidth={2} className="h-4 w-4" />
          </Lien>
        </div>

        <p className="mt-3 max-w-[640px] text-[15px] leading-relaxed text-gris">
          {t("transport.parc.sousTitre")}
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:mt-10 lg:grid-cols-4">
          {vehicules.map((vehicule) => (
            <CarteVehicule
              key={vehicule.id}
              vehicule={vehicule}
              langue={langue}
              besoin="trajet"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
