import { Carte, Icone } from "@teranga/ui";
import type { Traducteur } from "@/lib/i18n/traducteur";
import { ASSISTANCE } from "@/lib/assistance";

/**
 * Encadré « Besoin d'aide ? » — présent sur plusieurs écrans de l'espace client.
 *
 * Il vit dans son propre fichier parce qu'un fichier de route Next ne peut
 * exporter que ses conventions : en exporter un composant casse la compilation.
 */
export function CarteAide({ t }: { t: Traducteur }) {
  return (
    <Carte className="p-5">
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-teinte-bleu text-primaire">
          <Icone nom="assistance" taille={20} />
        </span>
        <div>
          <p className="text-titre-3 text-encre">{t("client.besoinAide")}</p>
          <p className="mt-1 text-petit text-encre-douce">{t("client.besoinAideTexte")}</p>
        </div>
      </div>
      <a href={`tel:${ASSISTANCE.telephone.replace(/\s/g, "")}`} className="mt-4 block">
        <span className="flex min-h-[var(--size-control)] items-center justify-center rounded-control bg-primaire px-4 text-petit font-semibold text-white">
          {t("client.nousContacter")}
        </span>
      </a>
    </Carte>
  );
}
