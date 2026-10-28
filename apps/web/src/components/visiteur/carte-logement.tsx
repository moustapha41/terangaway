import Image from "next/image";
import type { Logement } from "@teranga/contracts";
import { BadgeVerifie, Carte, Icone, Squelette } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Langue } from "@/lib/i18n/langues";
import { formaterPrixVisiteur, prixAffiche } from "@/lib/prix";
import { ConversionPrix } from "@/components/visiteur/conversion-prix";
import { situation } from "@/lib/lieu";
import { titreLogement } from "@/lib/i18n/titre-logement";

/**
 * Carte logement — dossier de conception §C.3 : photo 4:3, badge vérifié, titre,
 * quartier, capacité, prix par nuit.
 *
 * Elle vit dans l'application et non dans `@teranga/ui` parce qu'elle a besoin des
 * traductions, du format des prix et du routeur. `@teranga/ui` reste présentatif.
 */
export function CarteLogement({
  logement,
  langue,
  parametres,
}: {
  logement: Logement;
  langue: Langue;
  /** Dates et voyageurs de la recherche, pour que la fiche affiche le bon total. */
  parametres?: string;
}) {
  const t = traducteurPour(langue);
  const photo = logement.photos.find((p) => p.principale) ?? logement.photos[0];

  return (
    <Carte className="transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.22)]">
      <Lien
        href={`/logements/${logement.slug}${parametres ? `?${parametres}` : ""}`}
        className="group block"
      >
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
          {/* Le propriétaire n'a envoyé qu'une vidéo : autant le dire avant le
              clic, la fiche montrera autre chose qu'une série de photos. */}
          {logement.videos && logement.videos.length > 0 && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-pill bg-surface/95 px-2.5 py-1 text-legende font-semibold text-primaire">
              <Icone nom="visite" taille={16} />
              {t("commun.visiteFilmee")}
            </span>
          )}
        </div>

        <div className="p-4">
          <p className="text-legende uppercase tracking-wider text-encre-douce">
            {t(`typeLogement.${logement.type}`)}
          </p>
          <h3 className="mt-1 text-titre-3 text-encre">{titreLogement(logement, t)}</h3>

          <p className="mt-2 flex items-center gap-1.5 text-petit text-encre-douce">
            <Icone nom="repere" taille={16} className="shrink-0" />
            {situation(logement, t)}
          </p>

          {logement.note !== undefined ? (
            <p className="mt-2 flex items-center gap-1.5 text-petit text-encre">
              <Etoile />
              <span className="font-semibold chiffres-tabulaires">
                {logement.note.toFixed(1).replace(".", langue === "en" ? "." : ",")}
              </span>
              <span className="text-encre-douce">({logement.nombreAvis ?? 0})</span>
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-petit text-encre-douce">
              <li className="inline-flex items-center gap-1">
                <Icone nom="personnes" taille={16} />
                {t("carte.personnes", { nombre: logement.capacite })}
              </li>
              <li className="inline-flex items-center gap-1">
                <Icone nom="lit" taille={16} />
                {t("carte.chambres", { nombre: logement.chambres })}
              </li>
            </ul>
          )}

          {/* « Un prix n'apparaît jamais sans son unité » (§C.4). */}
          <p className="mt-4 text-prix text-encre chiffres-tabulaires">
            {formaterPrixVisiteur(prixAffiche(logement).montant, langue)}
            <span className="ml-1 text-petit font-normal text-encre-douce">
              {t(prixAffiche(logement).cleUnite)}
            </span>
          </p>
          <p className="mt-0.5 text-legende text-encre-douce chiffres-tabulaires">
            {formaterPrixVisiteur(logement.prixParNuit, langue)} {t("commun.parNuit")}
          </p>
        </div>
      </Lien>
      <div className="-mt-2 px-4 pb-4">
        <ConversionPrix
          montant={prixAffiche(logement).montant}
          unite={t(prixAffiche(logement).cleUnite)}
        />
      </div>
    </Carte>
  );
}

/** L'état de chargement prend la forme de la carte, pas celle d'un tourniquet (§B.7). */
export function CarteLogementSquelette() {
  return (
    <Carte>
      <Squelette className="aspect-[4/3] rounded-none" />
      <div className="space-y-2 p-4">
        <Squelette className="h-3 w-16" />
        <Squelette className="h-6 w-3/4" />
        <Squelette className="h-4 w-1/2" />
        <Squelette className="h-4 w-2/3" />
        <Squelette className="mt-3 h-6 w-2/5" />
      </div>
    </Carte>
  );
}

function Etoile() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="#F4B942">
      <path d="m12 2 2.9 6.3 6.8.8-5 4.7 1.3 6.8L12 17.3 6 20.6l1.3-6.8-5-4.7 6.8-.8Z" />
    </svg>
  );
}
