import type { CoordonneesPaiementAcompte, MoyenAcompte } from "@teranga/contracts";

import type { ConfigAcompte } from "../../config/configuration";

/**
 * Ce que la configuration permet réellement de proposer à un visiteur.
 *
 * Un moyen n'est proposé que s'il est **à la fois** accepté (`moyens`) et
 * complètement configuré : un virement sans IBAN, un numéro Wave sans titulaire
 * n'apparaissent jamais dans un e-mail. `undefined` = rien à proposer, donc
 * rien à réclamer.
 *
 * Absent `moyens`, la configuration est celle d'avant Mobile Money : le
 * virement seul.
 */
export function coordonneesPaiement(config: ConfigAcompte): CoordonneesPaiementAcompte | undefined {
  const acceptes: readonly MoyenAcompte[] = config.moyens ?? ["virement"];

  const virement = acceptes.includes("virement") ? config.beneficiaire : undefined;
  const mobileMoney = (config.mobileMoney ?? []).filter((compte) => acceptes.includes(compte.operateur));

  const moyens = acceptes.filter((moyen) =>
    moyen === "virement" ? virement !== undefined : mobileMoney.some((c) => c.operateur === moyen),
  );
  if (moyens.length === 0) return undefined;

  return { moyens, virement, mobileMoney, instructions: config.instructions };
}
