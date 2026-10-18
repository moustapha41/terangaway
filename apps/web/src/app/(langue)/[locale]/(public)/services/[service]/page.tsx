import { notFound } from "next/navigation";
import { SERVICES_A_LA_DEMANDE, type ServiceALaDemande } from "@teranga/contracts";
import { Icone } from "@teranga/ui";
import { FormulaireDemandeService } from "@/features/services/formulaire-demande-service";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Demande d'un service sans catalogue (V2).
 *
 * Une page par service, parce que les champs diffèrent. Elles sont générées
 * depuis `SERVICES_A_LA_DEMANDE` : ajouter un service au contrat suffit à
 * ouvrir sa page, il n'y a pas de liste à tenir à jour en parallèle.
 */
/** Les services qui ont leur propre page : la route statique l'emporte ici. */
const PAGES_DEDIEES = new Set(["guides", "restauration", "assistance", "internet"]);

/**
 * Pré-générer un service qui a sa page produirait une page morte : Next sert
 * toujours la route statique, jamais celle-ci.
 */
export function generateStaticParams() {
  return SERVICES_A_LA_DEMANDE.filter((service) => !PAGES_DEDIEES.has(service)).map((service) => ({
    service,
  }));
}

export default async function DemanderService({
  params,
}: {
  params: Promise<{ locale: string; service: string }>;
}) {
  const { locale, service } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  if (!SERVICES_A_LA_DEMANDE.includes(service as ServiceALaDemande)) notFound();
  const cle = service as ServiceALaDemande;

  return (
    <main className="bg-page pb-16">
      <div className="mx-auto w-[92%] max-w-[680px] pt-6">
        <nav className="flex flex-wrap items-center gap-2 text-petit text-encre-douce">
          <Lien href="/" className="hover:text-primaire">
            {t("navigation.accueil")}
          </Lien>
          <Icone nom="chevron-droite" taille={16} />
          <Lien href="/services" className="hover:text-primaire">
            {t("services.nosServices")}
          </Lien>
          <Icone nom="chevron-droite" taille={16} />
          <span className="text-encre">{t(`services.${cle}Titre`)}</span>
        </nav>

        <h1 className="mt-4 text-titre-1 text-encre">
          {t("demandeService.titre", { service: t(`services.${cle}Titre`) })}
        </h1>
        <p className="mt-2 max-w-[60ch] text-corps leading-relaxed text-encre-douce">
          {t("demandeService.intro")}
        </p>

        <div className="mt-7">
          <FormulaireDemandeService service={cle} />
        </div>
      </div>
    </main>
  );
}
