import type { Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { BarreRechercheTransport } from "@/features/transport/barre-recherche-transport";

/**
 * Hero de la page Transport — maquette `transport/Dalal Transport Booking UI Mockup.png`,
 * dont la photo a laissé place à une vidéo.
 *
 * Trois précautions, dans l'ordre où elles comptent :
 *
 * 1. **Sans son et sans commande.** Une vidéo de décor qui parle, ou qu'il faut
 *    arrêter, est une nuisance : la piste audio a été retirée du fichier, pas
 *    seulement coupée à l'affichage.
 * 2. **Une affiche sous la vidéo.** `poster` occupe la place dès le premier
 *    rendu : pas de trou noir pendant le téléchargement, et c'est elle qu'on
 *    voit si la lecture échoue.
 * 3. **Elle disparaît pour qui refuse le mouvement** (§C.1). La vidéo est
 *    masquée et l'affiche prend le relais — même cadrage, même voile, même
 *    texte par-dessus.
 *
 * Le fichier d'origine a été raccourci de ses premières secondes : une plaque
 * d'immatriculation y était parfaitement lisible, ce que les fiches véhicule
 * s'interdisent déjà.
 */
export function HeroTransport({ langue }: { langue: Langue }) {
  const t = traducteurPour(langue);

  return (
    <section className="relative w-full pb-2">
      <div className="relative h-[min(560px,max(420px,36vw))] w-full overflow-hidden bg-nuit">
        <video
          src="/videos/hero-transport.mp4"
          poster="/images/hero-transport-video.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={t("transport.accueil.alt")}
          className="absolute inset-0 h-full w-full object-cover object-[center_40%] motion-reduce:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- l'affiche de la
            vidéo, servie telle quelle : la passer par l'optimiseur donnerait un
            fichier différent de celui que `poster` affiche déjà. */}
        <img
          src="/images/hero-transport-video.jpg"
          alt={t("transport.accueil.alt")}
          className="absolute inset-0 hidden h-full w-full object-cover object-[center_40%] motion-reduce:block"
        />

        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,29,53,0.78) 0%, rgba(0,29,53,0.58) 28%, rgba(0,29,53,0.28) 55%, rgba(0,29,53,0.08) 78%, rgba(0,29,53,0) 100%)",
          }}
        />

        <div className="relative mx-auto flex h-full w-[87.5%] max-w-[1260px] flex-col justify-center pb-[120px] pt-6">
          <h1 className="max-w-[640px] text-[clamp(32px,4vw,52px)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
            {t("transport.accueil.titre")}
          </h1>
          <p className="mt-4 max-w-[480px] text-[clamp(16px,1.4vw,19px)] leading-[1.45] text-white/90">
            {t("transport.accueil.sousTitre")}
          </p>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-[140px] w-[87.5%] max-w-[900px]">
        <BarreRechercheTransport />
      </div>
    </section>
  );
}
