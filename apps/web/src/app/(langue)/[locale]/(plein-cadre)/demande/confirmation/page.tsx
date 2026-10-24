import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { RetourAccueil } from "@/components/layout/retour-accueil";
import { SelecteurLangue } from "@/components/layout/selecteur-langue";
import { IndicateurEtapes } from "@/features/demande/indicateur-etapes";
import { visiteurConnecte } from "@/features/compte/session";
import { lireRecapitulatif, type Recapitulatif } from "@/features/demande/recapitulatif";
import { formaterDateComplete } from "@/lib/dates";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Écran 11 · Confirmation — dernière étape du tunnel de demande.
 *
 * Harmonisé avec la direction artistique premium de Teranga Way :
 * plein cadre, arrière-plan illustré, carte centrale raffinée et indicateur d'étapes.
 */
export default async function Confirmation({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reference?: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const { reference } = await searchParams;
  const t = traducteurPour(langue);

  /**
   * « Voir ma demande » n'a de sens que pour qui a un compte.
   *
   * Une demande s'envoie désormais sans code et donc sans session : proposer le
   * suivi à tout le monde enverrait la plupart des visiteurs sur un écran de
   * connexion juste après avoir abouti. Il leur reste la référence, qu'ils ont
   * sous les yeux, et la réponse qui arrive par courriel.
   */
  const visiteur = await visiteurConnecte();

  // Le récapitulatif vient de la réponse de l'API, relue dans un cookie posé à
  // l'envoi. Absent (page rouverte plus tard, autre appareil), on ne montre que
  // la référence : rien ne se reconstitue à partir de l'URL.
  const recap = await lireRecapitulatif();
  const referenceAffichee = recap?.reference ?? reference;
  const emailPart = recap?.emailEnvoye === true;
  // Sans acompte annoncé, aucune instruction de paiement n'est à attendre.
  const paiementAnnonce = recap?.acompteAnnonce === true;
  const cibleDemande = recap ? `/mes-demandes/${encodeURIComponent(recap.id)}` : "/mes-demandes";

  return (
    <main className="relative flex min-h-screen flex-col overflow-x-hidden bg-primaire">
      {/* Fond propre au parcours de demande, fixé pour un défilement naturel et fluide */}
      <div className="fixed inset-0 pointer-events-none">
        <Image
          src="/images/fond-demande.jpg"
          alt={t("demande.illustrationAlt")}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-primaire/35 via-primaire/15 to-primaire/75"
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col justify-between px-3.5 py-3.5 sm:px-8 sm:py-5">
        {/* Boutons de navigation flottants en haut de page, identiques à la connexion */}
        <header className="flex items-center justify-between gap-3">
          <RetourAccueil langue={langue} />
          <SelecteurLangue className="rounded-pill bg-surface/95 px-4 py-1.5 shadow-[0_8px_24px_-12px_rgb(2_20_38/0.45)] backdrop-blur-sm" />
        </header>

        {/* Carte centrale ivoire / blanc cassé translucide */}
        <div className="flex flex-1 items-center justify-center py-4 sm:py-6">
          <section className="w-full max-w-[490px] sm:max-w-[510px] rounded-[22px] sm:rounded-[26px] bg-surface/78 p-4 sm:p-6 origin-center sm:scale-[0.92] lg:scale-[0.80] shadow-[0_28px_70px_-24px_rgb(2_20_38/0.55)] backdrop-blur-xl">
            {/* Logo Teranga Way centré en haut de la carte */}
            <Lien
              href="/"
              className="mx-auto block w-[165px] sm:w-[185px] transition-opacity hover:opacity-90"
              aria-label={t("commun.nomApplication")}
            >
              <Image
                src="/images/logo-complet.png"
                alt="Teranga Way"
                width={775}
                height={205}
                priority
                className="h-auto w-full"
              />
            </Lien>

            <div className="mt-4">
              <IndicateurEtapes
                etapes={[
                  t("demande.etapeInformations"),
                  t("demande.etapeDetails"),
                  t("demande.etapeConfirmation"),
                ]}
                courante={3}
                resume={t("demande.etapeSur", { index: 3, total: 3 })}
              />
            </div>

            <div className="mt-6 text-center sm:mt-7">
              <Enveloppe />

              <h1 className="mt-5 text-[21px] sm:text-[25px] font-bold tracking-[-0.02em] text-encre">
                {t("confirmation.titre")}
              </h1>

              {referenceAffichee && (
                <p className="mt-1.5 text-[13.5px] font-semibold text-primaire chiffres-tabulaires">
                  {t("confirmation.reference", { reference: referenceAffichee })}
                </p>
              )}

              {/* On ne dit « un e-mail vous sera envoyé » que si le service
                  d'envoi l'a accepté ; sinon le visiteur sait qu'il doit
                  passer par la connexion. */}
              <p
                role={emailPart ? undefined : "status"}
                className="mx-auto mt-3 max-w-[44ch] text-[14px] sm:text-[14.5px] leading-relaxed text-encre-douce"
              >
                {emailPart ? t("confirmation.message") : t("confirmation.messageSansEmail")}
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-contour bg-surface p-4 text-left">
              <h2 className="text-[14px] font-bold text-encre">{t("confirmation.etapesTitre")}</h2>
              <ol className="mt-2.5 space-y-2.5">
                {(emailPart
                  ? [
                      "confirmation.etape1",
                      "confirmation.etape2",
                      paiementAnnonce ? "confirmation.etape3" : "confirmation.etape3SansPaiement",
                    ]
                  : [
                      "confirmation.etapeSans1",
                      "confirmation.etapeSans2",
                      paiementAnnonce ? "confirmation.etapeSans3" : "confirmation.etape3SansPaiement",
                    ]
                ).map((cle, index) => (
                  <li key={cle} className="flex gap-3 text-[13.5px] leading-snug text-encre-douce">
                    <span
                      aria-hidden="true"
                      className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primaire text-[11.5px] font-bold text-white"
                    >
                      {index + 1}
                    </span>
                    <span>{t(cle)}</span>
                  </li>
                ))}
              </ol>
            </div>

            {recap && <Resume recap={recap} langue={langue} t={t} />}

            <p
              role="note"
              className="mt-4 rounded-xl border border-[#E8A33D]/60 bg-[#FBE3B4]/50 px-3.5 py-2.5 text-left text-[12.5px] leading-relaxed text-encre"
            >
              {t("confirmation.avertissement")}
            </p>

            <div className="mt-5 text-center">
              <div className="space-y-2.5 sm:mx-auto sm:max-w-[320px]">
                <Lien
                  href={visiteur ? cibleDemande : `/connexion?suite=${encodeURIComponent(cibleDemande)}`}
                  className="block"
                >
                  <span
                    className={
                      "group relative flex h-[48px] sm:h-[50px] w-full items-center justify-center gap-2.5 rounded-pill " +
                      "border border-transparent bg-primaire text-[15.5px] sm:text-[16px] font-semibold text-white " +
                      "shadow-[0_4px_16px_-4px_rgb(0_29_53/0.4)] transition-all duration-200 " +
                      "hover:border-jaune-vif hover:bg-[#072c4e] hover:shadow-[0_6px_24px_-4px_rgba(244,185,66,0.35)] " +
                      "hover:ring-2 hover:ring-jaune-vif/50 focus-visible:outline-2 focus-visible:outline-offset-2 " +
                      "focus-visible:outline-primaire active:scale-[0.99]"
                    }
                  >
                    <span>{t("confirmation.voirMaDemande")}</span>
                    <ArrowRight
                      strokeWidth={2.2}
                      className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1"
                    />
                  </span>
                </Lien>

                <Lien
                  href="/"
                  className="flex h-[44px] sm:h-[46px] w-full items-center justify-center rounded-pill border border-contour bg-surface text-[14px] font-semibold text-encre transition-colors hover:bg-champ"
                >
                  {t("confirmation.retourAccueil")}
                </Lien>
              </div>
            </div>
          </section>
        </div>

        {/* Signature Dakar */}
        <div className="flex items-center justify-end pb-2 pt-2 text-white/80">
          <div className="flex flex-col items-center">
            <Image
              src="/images/signature-dakar.png"
              alt="Dakar"
              width={420}
              height={168}
              className="h-auto w-[110px] sm:w-[130px]"
            />
            <span className="mt-1 text-[10px] sm:text-[11px] uppercase tracking-[0.38em] text-white/85">
              {t("connexion.vousAttend")}
            </span>
            <span className="mt-1.5 block h-[2.5px] w-[50px] rounded-pill bg-jaune-vif" />
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Le récapitulatif de ce qui a été enregistré, et seulement cela : une ligne
 * absente de la demande (heure d'arrivée, montant) n'est pas affichée.
 */
function Resume({
  recap,
  langue,
  t,
}: {
  recap: Recapitulatif;
  langue: Langue;
  t: ReturnType<typeof traducteurPour>;
}) {
  const lignes: Array<[string, string]> = [
    [t("confirmation.logement"), recap.titre],
    [t("confirmation.arrivee"), formaterDateComplete(new Date(recap.debut), langue)],
    [t("confirmation.depart"), formaterDateComplete(new Date(recap.fin), langue)],
    [t("confirmation.voyageurs"), String(recap.personnes)],
  ];
  if (recap.heureArrivee) lignes.push([t("confirmation.heureArrivee"), recap.heureArrivee]);
  if (recap.total !== undefined) {
    const montant = new Intl.NumberFormat(langue).format(recap.total).replace(/[\u202f\u00a0]/g, " ");
    lignes.push([t("confirmation.total"), `${montant} ${t("confirmation.devise")}`]);
  }

  return (
    <div className="mt-4 rounded-2xl border border-contour bg-surface p-4 text-left">
      <h2 className="text-[14px] font-bold text-encre">{t("confirmation.recapTitre")}</h2>
      <dl className="mt-2.5 space-y-1.5">
        {lignes.map(([etiquette, valeur]) => (
          <div key={etiquette} className="flex justify-between gap-4 text-[13.5px]">
            <dt className="text-encre-douce">{etiquette}</dt>
            <dd className="text-right font-semibold text-encre chiffres-tabulaires">{valeur}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Enveloppe() {
  return (
    <svg
      aria-hidden="true"
      width="156"
      height="130"
      viewBox="0 0 156 130"
      fill="none"
      className="mx-auto"
    >
      <g fill="#F4B942" opacity=".85">
        <circle cx="16" cy="30" r="4" />
        <circle cx="140" cy="44" r="3.5" />
        <rect
          x="128"
          y="14"
          width="7"
          height="7"
          rx="1.5"
          transform="rotate(24 128 14)"
        />
      </g>
      <g fill="#B42318" opacity=".75">
        <rect
          x="20"
          y="62"
          width="7"
          height="7"
          rx="1.5"
          transform="rotate(-18 20 62)"
        />
        <circle cx="134" cy="76" r="3.5" />
        <rect
          x="104"
          y="10"
          width="6"
          height="6"
          rx="1.5"
          transform="rotate(-30 104 10)"
        />
      </g>
      <g fill="#001D35" opacity=".5">
        <circle cx="38" cy="16" r="3" />
        <rect
          x="146"
          y="60"
          width="6"
          height="6"
          rx="1.5"
          transform="rotate(16 146 60)"
        />
      </g>

      <path
        d="M34 54h88a6 6 0 0 1 6 6v54a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6V60a6 6 0 0 1 6-6Z"
        fill="#FBE3B4"
      />
      <path
        d="M28 60 78 96l50-36"
        stroke="#E8A33D"
        strokeWidth="3"
        fill="none"
        strokeLinejoin="round"
      />

      <circle cx="78" cy="62" r="30" fill="#087443" />
      <path
        d="m64 62 10 10 19-20"
        stroke="#fff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
