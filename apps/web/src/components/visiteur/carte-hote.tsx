import type { Partenaire } from "@teranga/contracts";
import { Bouton, Carte, Icone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Langue } from "@/lib/i18n/langues";

/**
 * Carte « À propos de l'hôte » — maquette écran 03.
 *
 * L'avatar est fait d'initiales, pas d'une photo : le dossier interdit toute
 * personne reconnaissable sans accord écrit (§A.7), et une photo d'hôte en
 * mocks serait une personne inventée ou volée.
 *
 * « Contacter l'hôte » mène à la demande, dont le champ message est le seul
 * canal avant confirmation. Révéler un numéro ici casserait la règle qui
 * protège autant le partenaire que le visiteur.
 */
export function CarteHote({
  partenaire,
  logementId,
  langue,
}: {
  partenaire: Partenaire;
  logementId: string;
  langue: Langue;
}) {
  const t = traducteurPour(langue);
  const initiales = partenaire.nomAffiche
    .split(" ")
    .map((mot) => mot[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Carte className="p-5">
      <h2 className="text-titre-3 text-encre">{t("fiche.aProposHote")}</h2>

      <div className="mt-4 flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-pill bg-teinte-bleu text-titre-3 font-semibold text-primaire"
        >
          {initiales}
        </span>
        <div className="min-w-0">
          <p className="text-titre-3 text-encre">{partenaire.nomAffiche}</p>
          {partenaire.professionnel && (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-pill bg-teinte-bleu px-2.5 py-0.5 text-legende font-semibold text-primaire">
              <Icone nom="verification" taille={16} />
              {t("fiche.hoteProfessionnel")}
            </p>
          )}
          {partenaire.membreDepuis && (
            <p className="mt-1 text-petit text-encre-douce">
              {t("fiche.membreDepuis", { annee: partenaire.membreDepuis })}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <Lien href={`/demande/${logementId}`}>
          <Bouton variante="secondaire" largeur="pleine">
            {t("fiche.contacterHote")}
          </Bouton>
        </Lien>
      </div>
      <p className="mt-2 text-legende text-encre-douce">{t("fiche.contacterTexte")}</p>
    </Carte>
  );
}
