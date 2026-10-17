"use client";

import Image from "next/image";
import { Bouton, Carte, Icone } from "@teranga/ui";
import { SERVICES, type Service } from "./catalogue";
import { Lien } from "@/lib/i18n/lien";
import { useT } from "@/lib/i18n/contexte";

/**
 * Grille des services.
 *
 * Tous mènent quelque part : trois vers un espace à parcourir — les deux
 * catalogues et la carte —, les autres vers un formulaire de demande. C'est
 * la V2 — avant, les derniers ouvraient une feuille « bientôt disponible »,
 * qui disait non poliment.
 *
 * Les services sans catalogue portent une mention « sur demande » : le
 * visiteur doit savoir qu'il décrira son besoin au lieu de choisir une offre.
 */
export function GrilleServices() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {SERVICES.map((service) => (
        <li key={service.cle}>
          <CarteService service={service} />
        </li>
      ))}
    </ul>
  );
}

function CarteService({ service }: { service: Service }) {
  const t = useT();
  const titre = t(`services.${service.cle}Titre`);

  return (
    <Carte className="relative h-full overflow-hidden transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.2)]">
      {/* Visuel : photo pour un catalogue, aplat et icône pour une demande —
          on ne met pas en scène une offre qu'on n'a pas encore. */}
      <div className="relative aspect-[16/9] bg-champ">
        {service.image ? (
          <Image
            src={service.image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-teinte-bleu text-primaire/70">
            <Icone nom={service.icone} taille={32} />
          </div>
        )}

        {!service.parcourir && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-pill bg-surface/95 px-2.5 py-1 text-legende font-semibold text-primaire">
            <Icone nom="information" taille={16} />
            {t("services.surDemande")}
          </span>
        )}
      </div>

      <div className="p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-control bg-primaire text-white">
          <Icone nom={service.icone} taille={20} />
        </span>

        <h3 className="mt-3 text-titre-3 text-encre">{titre}</h3>
        <p className="mt-1 text-petit text-encre-douce">{t(`services.${service.cle}Texte`)}</p>

        <div className="mt-4">
          <Lien href={service.href}>
            <Bouton variante={service.parcourir ? "principal" : "secondaire"} largeur="contenu">
              <span className="inline-flex items-center gap-2">
                {t(service.parcourir ? `services.${service.cle}Action` : "services.faireUneDemande")}
                <Icone nom="chevron-droite" taille={16} />
              </span>
            </Bouton>
          </Lien>
        </div>
      </div>
    </Carte>
  );
}
