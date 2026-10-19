import type { VideoLogement } from "@teranga/contracts";
import { Icone } from "@teranga/ui";
import type { Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * La visite filmée d'un logement.
 *
 * Plusieurs propriétaires n'ont envoyé qu'une vidéo WhatsApp. Les trames qu'on
 * en a tirées font des photos convenables, mais elles ne montrent ni le volume
 * des pièces ni leur enchaînement — la visite, elle, les montre. Elle est donc
 * posée sous la mosaïque, et non à la place : qui veut parcourir vite garde les
 * photos, qui hésite regarde la vidéo.
 *
 * Trois précautions :
 *
 * 1. **`preload="none"`.** Un fichier de plusieurs mégaoctets ne part pas sur
 *    la ligne de quelqu'un qui n'a pas demandé à le voir — et ici beaucoup de
 *    visiteurs paient leurs mégaoctets au pass. L'affiche suffit tant qu'on n'a
 *    pas appuyé.
 * 2. **Des commandes, pas de lecture automatique.** Ce n'est pas un décor
 *    comme la vidéo du hero transport : c'est un document qu'on consulte.
 * 3. **Sans bande son**, retirée du fichier : le propriétaire y parle, et sa
 *    voix porte volontiers un numéro ou une adresse que la fiche ne livre pas
 *    avant confirmation.
 */
export function VisiteFilmee({
  videos,
  langue,
  principale = false,
}: {
  videos: VideoLogement[];
  langue: Langue;
  /** La visite prend la place de la mosaïque : c'est le seul visuel du logement. */
  principale?: boolean;
}) {
  const t = traducteurPour(langue);

  return (
    <section aria-labelledby="visite-filmee">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="visite-filmee" className="text-titre-2 text-encre">
          {t("fiche.visiteTitre")}
        </h2>
        <p className="text-legende text-encre-douce">{t("fiche.visiteSansSon")}</p>
      </div>

      <ul
        className={
          "mt-4 grid gap-5 " +
          (principale
            ? videos.length > 1
              ? "sm:grid-cols-2 lg:grid-cols-3"
              : ""
            : videos.length > 1
              ? "sm:grid-cols-2"
              : "")
        }
      >
        {videos.map((video) => (
          <li key={video.url}>
            {/* Ces vidéos viennent d'un téléphone : elles sont presque toutes
                verticales. Les étirer sur toute la largeur les encadrerait de
                noir — mieux vaut une largeur tenue, centrée quand elle est seule. */}
            <figure
              className={
                principale && videos.length === 1
                  ? "mx-auto max-w-[520px]"
                  : "max-w-[460px]"
              }
            >
              <video
                src={video.url}
                poster={video.poster}
                controls
                playsInline
                preload="none"
                aria-label={video.legende}
                className={
                  "h-auto w-full rounded-card border border-contour bg-nuit object-contain " +
                  (principale ? "max-h-[70vh]" : "max-h-[620px]")
                }
              />
              <figcaption className="mt-2 max-w-[60ch] text-legende leading-relaxed text-encre-douce">
                <span className="inline-flex items-center gap-1.5">
                  <Icone nom="horloge" taille={16} />
                  {t("fiche.visiteDuree", { duree: formaterDuree(video.duree) })}
                </span>
                <span className="mt-0.5 block">{video.legende}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** « 2 min 24 ». Les secondes gardent leur zéro : une durée se lit comme une horloge. */
function formaterDuree(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  const reste = Math.round(secondes % 60);
  return `${minutes} min ${String(reste).padStart(2, "0")}`;
}
