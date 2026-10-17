import { redirect } from "next/navigation";
import { Carte } from "@teranga/ui";
import { EnTeteSession } from "@/components/layout/en-tete-session";
import { FormulaireVerificationInscription } from "@/features/compte/formulaire-verification-inscription";
import {
  lireInscriptionEnAttente,
  masquerEmail,
} from "@/features/compte/inscription-en-attente";
import { visiteurConnecte } from "@/features/compte/session";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Vérification de l'adresse — page indépendante.
 *
 * Indépendante et non une feuille au-dessus du formulaire : on y revient après
 * avoir quitté l'onglet pour aller lire son e-mail, et l'URL doit rester
 * valable. L'adresse à vérifier vient du cookie d'attente, pas de l'URL : une
 * adresse e-mail n'a pas à circuler dans l'historique du navigateur ni dans les
 * journaux d'accès.
 *
 * Seule une forme masquée est affichée : assez pour reconnaître la sienne et
 * repérer une faute de frappe, pas assez pour être lue par-dessus l'épaule.
 */
export default async function VerificationInscription({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  // Déjà vérifié et connecté : cette page n'a plus d'objet.
  const visiteur = await visiteurConnecte();
  if (visiteur) redirect(`/${langue}/compte`);

  const enAttente = await lireInscriptionEnAttente();
  // Sans inscription en attente, il n'y a rien à vérifier : on renvoie vers
  // l'inscription plutôt que d'afficher un écran qui attend un code.
  if (!enAttente) redirect(`/${langue}/inscription`);

  return (
    <main className="bg-page pb-16">
      <EnTeteSession />

      <div className="mx-auto w-[87.5%] max-w-[480px] pt-10">
        <h1 className="text-titre-1 text-encre">{t("inscription.verificationTitre")}</h1>
        <p className="mt-2 text-corps text-encre-douce">
          {t("inscription.verificationTexte", { email: masquerEmail(enAttente.email) })}
        </p>

        <Carte className="mt-6 p-5">
          <FormulaireVerificationInscription />
        </Carte>

        <p className="mt-6 text-center text-petit text-encre-douce">
          <Lien
            href="/inscription"
            className="font-semibold text-primaire underline underline-offset-2"
          >
            {t("inscription.reprendre")}
          </Lien>
        </p>
      </div>
    </main>
  );
}
