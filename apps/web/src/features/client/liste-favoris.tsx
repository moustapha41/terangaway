"use client";

import Image from "next/image";
import type { Logement } from "@teranga/contracts";
import { Bouton, Carte, Icone } from "@teranga/ui";
import { useFavoris } from "@/features/favoris/use-favoris";
import { PrixConverti } from "@/features/preferences/prix-converti";
import { Lien } from "@/lib/i18n/lien";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { formaterPrix } from "@/lib/prix";

/**
 * Mes favoris — maquette de l'espace client, écran mobile 5.
 *
 * La liste est client : les favoris vivent dans le navigateur, pas sur un
 * serveur. Le catalogue complet est passé par le serveur, et on n'en garde que
 * ce qui est marqué — c'est le seul moyen d'afficher des titres et des prix
 * sans dupliquer les données côté client.
 */
export function ListeFavoris({ catalogue }: { catalogue: Logement[] }) {
  const t = useT();
  const langue = useLangue();
  const { favoris, basculer } = useFavoris();

  const retenus = catalogue.filter((l) => favoris.includes(l.id));

  if (retenus.length === 0) {
    return (
      <Carte className="px-6 py-12 text-center">
        <Coeur />
        <h2 className="mt-4 text-titre-2 text-encre">{t("client.favorisVide")}</h2>
        <p className="mx-auto mt-2 max-w-[42ch] text-corps text-encre-douce">
          {t("client.favorisVideTexte")}
        </p>
        <div className="mt-6 flex justify-center">
          <Lien href="/logements">
            <Bouton variante="principal" largeur="contenu">
              {t("client.favorisAction")}
            </Bouton>
          </Lien>
        </div>
      </Carte>
    );
  }

  return (
    <>
      <p className="mb-4 text-petit text-encre-douce">
        {t("client.favorisCompte", { nombre: retenus.length })}
      </p>

      <ul className="space-y-4">
        {retenus.map((logement) => (
          <li key={logement.id}>
            <Carte className="relative transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.18)]">
              <div className="flex gap-4 p-4">
                <span className="relative h-24 w-28 shrink-0 overflow-hidden rounded-control bg-champ">
                  <Image
                    src={logement.photos[0].url}
                    alt={logement.photos[0].alt}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-titre-3 text-encre">
                    <Lien
                      href={`/logements/${logement.slug}`}
                      className="after:absolute after:inset-0 after:content-['']"
                    >
                      {logement.titre}
                    </Lien>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-petit text-encre-douce">
                    <Icone nom="repere" taille={16} />
                    {logement.quartier}, {logement.ville}
                  </p>
                  <p className="mt-2 text-prix text-encre chiffres-tabulaires">
                    {formaterPrix(logement.prixParNuit, langue)}
                    <span className="ml-1 text-petit font-normal text-encre-douce">
                      {t("commun.parNuit")}
                    </span>
                  </p>
                  <PrixConverti montant={logement.prixParNuit} />
                </div>

                <button
                  type="button"
                  onClick={() => basculer(logement.id)}
                  aria-label={t("resultats.retirerFavori")}
                  className="relative z-10 flex h-[var(--size-touch)] w-[var(--size-touch)] shrink-0 items-center justify-center rounded-pill text-danger transition-colors hover:bg-teinte-rouge"
                >
                  <Coeur plein />
                </button>
              </div>
            </Carte>
          </li>
        ))}
      </ul>
    </>
  );
}

function Coeur({ plein }: { plein?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width={plein ? 22 : 32}
      height={plein ? 22 : 32}
      viewBox="0 0 24 24"
      fill={plein ? "#B42318" : "none"}
      stroke={plein ? "#B42318" : "#5B6676"}
      strokeWidth="1.7"
      className={plein ? "" : "mx-auto"}
    >
      <path d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13Z" />
    </svg>
  );
}
