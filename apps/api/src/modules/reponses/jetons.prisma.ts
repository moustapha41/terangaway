import { Inject, Injectable } from "@nestjs/common";
import type { MotifRefus } from "@teranga/contracts";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { ErreurMetier, introuvable } from "../../commun/erreurs";
import { hacherJetonDirect } from "../../commun/securite/hachage";
import type { DepotJetons, EtatJeton, Jeton } from "./jetons.depot";

@Injectable()
export class DepotJetonsPrisma implements DepotJetons {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async parValeur(valeur: string): Promise<Jeton | null> {
    const tokenHash = hacherJetonDirect(valeur);

    // Recherche par empreinte cryptographique (voie sécurisée nominale)
    let record = await this.prisma.providerResponseToken.findUnique({
      where: { tokenHash },
    });

    // Fallback recherche directe par identifiant (fixtures de démonstration ou seed)
    if (!record) {
      record = await this.prisma.providerResponseToken.findUnique({
        where: { id: valeur },
      });
    }

    if (!record) return null;

    const perime = record.expiresAt.getTime() < Date.now();
    let etat: EtatJeton = "valide";
    if (record.consumedAt !== null) {
      etat = "repondu";
    } else if (perime) {
      etat = "expire";
    }

    return {
      jeton: valeur,
      demandeId: record.demandeId,
      etat,
      reponse: (record.reponse as any) ?? undefined,
      expireLe: record.expiresAt.toISOString(),
    };
  }

  async marquerRepondu(
    valeur: string,
    reponse: NonNullable<Jeton["reponse"]>,
    motif?: MotifRefus,
  ): Promise<Jeton> {
    const tokenHash = hacherJetonDirect(valeur);

    let record = await this.prisma.providerResponseToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      record = await this.prisma.providerResponseToken.findUnique({
        where: { id: valeur },
      });
    }

    if (!record) throw introuvable("Jeton");

    if (record.consumedAt !== null) {
      throw new ErreurMetier(
        "JETON_DEJA_UTILISE",
        "Ce lien a déjà été utilisé pour répondre.",
        410,
      );
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new ErreurMetier("JETON_EXPIRE", "Ce lien a expiré.", 410);
    }

    const updated = await this.prisma.providerResponseToken.update({
      where: { id: record.id },
      data: {
        consumedAt: new Date(),
        reponse,
        motifRefus: motif ?? null,
      },
    });

    return {
      jeton: valeur,
      demandeId: updated.demandeId,
      etat: "repondu",
      reponse,
      expireLe: updated.expiresAt.toISOString(),
    };
  }
}
