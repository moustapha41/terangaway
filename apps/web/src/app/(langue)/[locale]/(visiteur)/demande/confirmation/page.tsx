import { Bouton } from "@teranga/ui";
import { EnTete } from "@/components/layout/en-tete";
import { IndicateurEtapes } from "@/features/demande/indicateur-etapes";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Écran 11 · Confirmation — dernière étape du tunnel.
 *
 * C'est l'état de succès du §B.7 : on dit ce qui s'est passé **et** la prochaine
 * étape attendue, plutôt qu'un simple « envoyé ».
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

  return (
    <main className="bg-page pb-16">
      <EnTete />

      <div className="mx-auto w-[92%] max-w-[560px] pt-8">
        <IndicateurEtapes
          etapes={[
            t("demande.etapeInformations"),
            t("demande.etapeDetails"),
            t("demande.etapeConfirmation"),
          ]}
          courante={3}
          resume={t("demande.etapeSur", { index: 3, total: 3 })}
        />

        <div className="mt-10 text-center">
          <Enveloppe />

          <h1 className="mt-6 text-titre-1 text-encre">{t("confirmation.titre")}</h1>

          {reference && (
            <p className="mt-2 text-petit text-encre-douce chiffres-tabulaires">
              {t("confirmation.reference", { reference })}
            </p>
          )}

          <p className="mx-auto mt-4 max-w-[44ch] text-corps text-encre-douce">
            {t("confirmation.prochaineEtape")}
          </p>

          <div className="mt-8 space-y-3">
            <Lien href="/mes-demandes" className="block">
              <Bouton variante="principal" largeur="pleine">
                {t("confirmation.voirMaDemande")}
              </Bouton>
            </Lien>
            <Lien
              href="/"
              className="inline-block text-petit font-semibold text-primaire underline underline-offset-4"
            >
              {t("confirmation.retourAccueil")}
            </Lien>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * L'enveloppe de la maquette, dessinée plutôt qu'importée : une illustration
 * en SVG pèse deux kilo-octets, suit la couleur du thème et reste nette à
 * n'importe quelle densité d'écran.
 */
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
        <rect x="128" y="14" width="7" height="7" rx="1.5" transform="rotate(24 128 14)" />
      </g>
      <g fill="#B42318" opacity=".75">
        <rect x="20" y="62" width="7" height="7" rx="1.5" transform="rotate(-18 20 62)" />
        <circle cx="134" cy="76" r="3.5" />
        <rect x="104" y="10" width="6" height="6" rx="1.5" transform="rotate(-30 104 10)" />
      </g>
      <g fill="#001D35" opacity=".5">
        <circle cx="38" cy="16" r="3" />
        <rect x="146" y="60" width="6" height="6" rx="1.5" transform="rotate(16 146 60)" />
      </g>

      {/* corps de l'enveloppe */}
      <path d="M34 54h88a6 6 0 0 1 6 6v54a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6V60a6 6 0 0 1 6-6Z" fill="#FBE3B4" />
      <path d="M28 60 78 96l50-36" stroke="#E8A33D" strokeWidth="3" fill="none" strokeLinejoin="round" />

      {/* pastille de succès */}
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
