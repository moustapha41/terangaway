import Image from "next/image";
import { Carte, Icone, type NomIcone } from "@teranga/ui";
import { CarteReservation } from "@/components/client/carte-reservation";
import { CarteAide } from "@/components/client/carte-aide";
import { visiteurConnecte } from "@/features/compte/session";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { formaterPlage, nombreDeNuits } from "@/lib/dates";
import { listerDemandes } from "@/mocks/api";
import { VignetteDemande } from "@/components/visiteur/vignette-demande";

/**
 * Tableau de bord du client — maquette de l'espace client, écran 1.
 *
 * Il répond à « où en est mon séjour ? » : le prochain séjour, les réservations
 * récentes, et les raccourcis vers ce qu'on fait le plus souvent.
 */
const RACCOURCIS: { cle: string; href: string; icone: NomIcone }[] = [
  { cle: "nouvelleReservation", href: "/logements", icone: "logement" },
  { cle: "voirMesDemandes", href: "/compte/demandes", icone: "information" },
  { cle: "mesFavoris", href: "/compte/favoris", icone: "verification" },
  { cle: "mesMessages", href: "/compte/messages", icone: "whatsapp" },
  { cle: "modifierProfil", href: "/compte/profil", icone: "personnes" },
];

const TUILES: { cle: string; href: string; icone: NomIcone; teinte: string }[] = [
  { cle: "tuileLogements", href: "/logements", icone: "logement", teinte: "bg-teinte-bleu text-primaire" },
  { cle: "tuileTransports", href: "/transports", icone: "voiture", teinte: "bg-teinte-jaune text-alerte" },
  { cle: "tuileServices", href: "/services", icone: "tri", teinte: "bg-teinte-vert text-succes" },
];

export default async function TableauDeBord({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const visiteur = await visiteurConnecte();
  const prenom = (visiteur?.identifiant ?? "").split(/[@._-]/)[0] || "";
  const demandes = await listerDemandes();

  const recentes = demandes.slice(0, 2);
  const aVenir = demandes
    .filter((d) => ["acceptee", "confirmee"].includes(d.statut))
    .sort((a, b) => a.dates.debut.localeCompare(b.dates.debut))[0];

  return (
    <div className="space-y-8">
      {/* bandeau de bienvenue */}
      <section className="relative">
        <div className="relative h-[220px] w-full overflow-hidden rounded-card">
          <Image
            src="/images/banner-dakar.png"
            alt={t("client.bienvenueAlt")}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 70vw"
            className="object-cover object-[center_40%]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,29,53,0.82) 0%, rgba(0,29,53,0.6) 40%, rgba(0,29,53,0.25) 72%, rgba(0,29,53,0.1) 100%)",
            }}
          />
          <div className="relative flex h-full flex-col justify-center px-6 pb-12">
            <h1 className="text-titre-1 text-white">
              {t("client.bienvenue", { prenom: prenom.charAt(0).toUpperCase() + prenom.slice(1) })}
            </h1>
            <p className="mt-1 text-corps text-white/90">{t("client.bienvenueTexte")}</p>
          </div>
        </div>

        {/* `relative` est nécessaire : le bandeau est positionné, donc il se peint
            au-dessus de tout élément de flux normal qui le suit. */}
        <div className="relative z-10 mx-4 -mt-9 grid gap-px overflow-hidden rounded-card border border-contour bg-contour sm:grid-cols-3">
          <Raccourci href="/logements" icone="recherche">{t("client.chercherLogement")}</Raccourci>
          <Raccourci href="/transports" icone="voiture">{t("client.reserverTransport")}</Raccourci>
          <Raccourci href="/services" icone="tri">{t("client.decouvrirServices")}</Raccourci>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.6fr_1fr] xl:items-start">
        <div className="space-y-8">
          {/* tuiles de service */}
          <ul className="grid gap-4 sm:grid-cols-3">
            {TUILES.map((tuile) => (
              <li key={tuile.cle}>
                <Carte className="h-full transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.18)]">
                  <Lien href={tuile.href} className="flex h-full flex-col items-center gap-2 p-5 text-center">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-control ${tuile.teinte}`}>
                      <Icone nom={tuile.icone} taille={24} />
                    </span>
                    <span className="mt-1 text-titre-3 text-encre">{t(`client.${tuile.cle}`)}</span>
                    <span className="flex-1 text-petit text-encre-douce">
                      {t(`client.${tuile.cle}Texte`)}
                    </span>
                    <Icone nom="chevron-droite" taille={20} className="text-encre-douce" />
                  </Lien>
                </Carte>
              </li>
            ))}
          </ul>

          {/* réservations récentes */}
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 className="text-titre-2 text-encre">{t("client.reservationsRecentes")}</h2>
              <Lien
                href="/compte/reservations"
                className="text-petit font-semibold text-primaire underline underline-offset-4"
              >
                {t("client.voirToutes")}
              </Lien>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {recentes.map((demande) => (
                <li key={demande.id}>
                  <CarteReservation demande={demande} langue={langue} compacte />
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* colonne de droite */}
        <div className="space-y-6">
          <Carte className="p-5">
            <h2 className="text-titre-3 text-encre">{t("client.prochainSejour")}</h2>
            {aVenir ? (
              <>
                <p className="mt-3 flex items-center gap-2 text-corps text-encre chiffres-tabulaires">
                  <Icone nom="calendrier" taille={20} className="text-encre-douce" />
                  {formaterPlage(new Date(aVenir.dates.debut), new Date(aVenir.dates.fin), langue)}
                </p>
                <p className="mt-1 text-petit text-encre-douce">
                  {t("client.dureeSejour", {
                    jours: t("client.jours", {
                      nombre:
                        nombreDeNuits(new Date(aVenir.dates.debut), new Date(aVenir.dates.fin)) || 1,
                    }),
                    voyageurs: t("resultats.voyageurs", { nombre: aVenir.personnes }),
                  })}
                </p>
                <span className="relative mt-4 block aspect-[16/9] overflow-hidden rounded-control bg-champ">
                  <VignetteDemande
            offre={aVenir.offre}
            alt=""
            sizes="320px"
            className="object-cover"
          />
                </span>
              </>
            ) : (
              <p className="mt-2 text-petit text-encre-douce">{t("client.aucunSejour")}</p>
            )}
          </Carte>

          <section>
            <h2 className="mb-3 text-titre-3 text-encre">{t("client.actionsRapides")}</h2>
            <ul className="overflow-hidden rounded-card border border-contour bg-surface">
              {RACCOURCIS.map((raccourci) => (
                <li key={raccourci.cle} className="border-b border-contour last:border-0">
                  <Lien
                    href={raccourci.href}
                    className="flex min-h-[var(--size-control)] items-center gap-3 px-4 text-petit text-encre transition-colors hover:bg-champ"
                  >
                    <Icone nom={raccourci.icone} taille={20} className="text-encre-douce" />
                    <span className="flex-1">{t(`client.${raccourci.cle}`)}</span>
                    <Icone nom="chevron-droite" taille={20} className="text-encre-douce" />
                  </Lien>
                </li>
              ))}
            </ul>
          </section>

          <CarteAide t={t} />
        </div>
      </div>
    </div>
  );
}


function Raccourci({
  href,
  icone,
  children,
}: {
  href: string;
  icone: NomIcone;
  children: React.ReactNode;
}) {
  return (
    <Lien
      href={href}
      className="flex min-h-[64px] items-center justify-center gap-3 bg-surface px-4 text-petit font-semibold text-encre transition-colors hover:bg-champ"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-champ text-primaire">
        <Icone nom={icone} taille={20} />
      </span>
      {children}
    </Lien>
  );
}
