import { ASSISTANCE, emailUrl, telUrl } from "@/lib/assistance";
import { Lien } from "@/lib/i18n/lien";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Langue } from "@/lib/i18n/langues";
import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Youtube,
} from "lucide-react";
import { Logo } from "./logo";

/**
 * Les liens pointent vers ce qui existe. « Sites des Jeux » a disparu : le
 * dossier reporte ce service hors MVP (§D.2), et une entrée de pied de page qui
 * ne mène nulle part use la confiance plus vite qu'une absence.
 */
const COLONNES = [
  {
    cle: "decouvrir",
    liens: [
      { cle: "accueil", href: "/" },
      { cle: "logements", href: "/logements" },
      { cle: "transports", href: "/transports" },
      { cle: "aPropos", href: "/a-propos" },
    ],
  },
  {
    cle: "services",
    liens: [
      { cle: "hotelsResidences", href: "/logements?type=hotel" },
      { cle: "appartements", href: "/logements?type=appartement" },
      { cle: "villas", href: "/logements?type=villa" },
      { cle: "trajetChauffeur", href: "/transports?type=trajet" },
      { cle: "locationChauffeur", href: "/transports?type=location" },
    ],
  },
  {
    cle: "assistance",
    liens: [
      { cle: "centreAide", href: "/aide" },
      { cle: "commentCaMarche", href: "/aide/faq#reservation" },
      { cle: "annulations", href: "/aide/faq#annulation" },
      { cle: "devenirPartenaire", href: "/prestataire/devenir" },
      { cle: "nousContacter", href: "/aide" },
    ],
  },
] as const;

// Les noms de réseaux ne se traduisent pas.
const RESEAUX = [
  { libelle: "Facebook", href: "#", icone: Facebook },
  { libelle: "Instagram", href: "#", icone: Instagram },
  { libelle: "LinkedIn", href: "#", icone: Linkedin },
  { libelle: "YouTube", href: "#", icone: Youtube },
] as const;

const LEGALES = [
  { cle: "mentionsLegales", href: "/legal#editeur" },
  { cle: "confidentialite", href: "/legal#donnees" },
  { cle: "cgu", href: "/legal#role" },
  { cle: "cookies", href: "/legal#cookies" },
] as const;

export function PiedDePage({ langue }: { langue: Langue }) {
  const t = traducteurPour(langue);

  return (
    <footer className="bg-black text-white">
      {/* bandeau newsletter */}
      <div className="border-b border-white/10">
        <div className="mx-auto flex w-[87.5%] max-w-[1260px] flex-col gap-6 py-12 md:flex-row md:items-end md:justify-between md:py-14">
          <div className="max-w-[480px]">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-jaune-vif">
              {t("pied.newsletter")}
            </p>
            <h2 className="mt-3 text-[clamp(24px,2.4vw,32px)] font-bold tracking-[-0.02em]">
              {t("pied.resterInforme")}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/65">
              {t("pied.newsletterTexte")}
            </p>
          </div>

          <form className="flex w-full max-w-[460px] flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="newsletter-email">
              {t("pied.adresseEmail")}
            </label>
            <input
              id="newsletter-email"
              type="email"
              name="email"
              required
              placeholder={t("pied.votreAdresseEmail")}
              className="h-12 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 text-[15px] text-white outline-none placeholder:text-white/40 focus:border-jaune-vif"
            />
            <button
              type="submit"
              className="h-12 shrink-0 rounded-xl bg-jaune px-6 text-[15px] font-semibold text-nuit transition-colors hover:bg-jaune-vif"
            >
              {t("pied.sInscrire")}
            </button>
          </form>
        </div>
      </div>

      {/* colonnes principales */}
      <div className="mx-auto w-[87.5%] max-w-[1260px] py-14 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr_1fr_1fr_1.15fr] lg:gap-8">
          {/* marque */}
          <div className="max-w-[320px]">
            <Lien
              href="/"
              className="inline-block"
              aria-label={t("commun.nomApplication")}
            >
              <Logo variante="clair" forme="complet" hauteur={58} />
            </Lien>
            <p className="mt-3 text-[12px] text-white/55">{t("pied.baseline")}</p>

            <p className="mt-5 text-[14.5px] leading-relaxed text-white/65">
              {t("pied.marqueTexte")}
            </p>

            <div className="mt-6 flex items-center gap-2.5">
              {RESEAUX.map((reseau) => {
                const Icone = reseau.icone;
                return (
                  <Lien
                    key={reseau.libelle}
                    href={reseau.href}
                    aria-label={reseau.libelle}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors hover:border-jaune-vif hover:text-jaune-vif"
                  >
                    <Icone strokeWidth={1.7} className="h-[18px] w-[18px]" />
                  </Lien>
                );
              })}
            </div>
          </div>

          {COLONNES.map((colonne) => (
            <div key={colonne.cle}>
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-jaune-vif">
                {t(`pied.${colonne.cle}`)}
              </p>
              <ul className="mt-5 space-y-3">
                {colonne.liens.map((lien) => (
                  <li key={lien.cle}>
                    <Lien
                      href={lien.href}
                      className="text-[14.5px] text-white/70 transition-colors hover:text-white"
                    >
                      {t(`pied.${lien.cle}`)}
                    </Lien>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* contact */}
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-jaune-vif">
              {t("pied.contact")}
            </p>
            <ul className="mt-5 space-y-4 text-[14.5px] text-white/70">
              <li className="flex gap-3">
                <MapPin
                  strokeWidth={1.7}
                  className="mt-0.5 h-[18px] w-[18px] shrink-0 text-jaune-vif"
                />
                <span>
                  {t("pied.adresse")}
                  <br />
                  {t("pied.pays")}
                </span>
              </li>
              <li>
                <a
                  href={telUrl}
                  className="flex items-center gap-3 transition-colors hover:text-white"
                >
                  <Phone
                    strokeWidth={1.7}
                    className="h-[18px] w-[18px] shrink-0 text-jaune-vif"
                  />
                  {ASSISTANCE.telephone}
                </a>
              </li>
              <li>
                <a
                  href={emailUrl}
                  className="flex items-center gap-3 transition-colors hover:text-white"
                >
                  <Mail
                    strokeWidth={1.7}
                    className="h-[18px] w-[18px] shrink-0 text-jaune-vif"
                  />
                  {ASSISTANCE.email}
                </a>
              </li>
            </ul>

            <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] leading-relaxed text-white/60">
              {t("pied.assistanceTexte", { disponibilite: t("pied.disponibilite") })}
            </p>
          </div>
        </div>
      </div>

      {/* bas de page */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-[87.5%] max-w-[1260px] flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <p className="text-[13px] text-white/45">
            {t("pied.copyright", { annee: new Date().getFullYear() })}
          </p>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGALES.map((lien) => (
              <Lien
                key={lien.cle}
                href={lien.href}
                className="text-[13px] text-white/45 transition-colors hover:text-white"
              >
                {t(`pied.${lien.cle}`)}
              </Lien>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
