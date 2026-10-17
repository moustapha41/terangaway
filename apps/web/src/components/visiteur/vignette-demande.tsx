import Image from "next/image";
import type { Demande } from "@teranga/contracts";
import { Icone, type NomIcone } from "@teranga/ui";

/**
 * L'image d'une demande, dans une liste ou un récapitulatif.
 *
 * Un logement et un véhicule ont une photo. Un **service à la demande** n'en a
 * pas : il n'y a pas de catalogue derrière, donc rien à montrer. Plutôt
 * qu'emprunter une image qui ne correspondrait à rien, on pose l'icône du
 * service sur un aplat — le même traitement que sur la page Services.
 */
const ICONE_SERVICE: Record<string, NomIcone> = {
  guides: "guide",
  restauration: "restauration",
  assistance: "assistance",
  decouverte: "globe",
  internet: "wifi",
};

export function VignetteDemande({
  offre,
  alt,
  sizes,
  className,
}: {
  offre: Demande["offre"];
  alt: string;
  sizes: string;
  className?: string;
}) {
  if (offre.vignette) {
    return (
      <Image src={offre.vignette} alt={alt} fill sizes={sizes} className={className} />
    );
  }

  return (
    <span className="flex h-full w-full items-center justify-center bg-teinte-bleu text-primaire">
      <Icone
        nom={offre.genre === "service" ? (ICONE_SERVICE[offre.service] ?? "etoile") : "etoile"}
        taille={28}
      />
    </span>
  );
}
