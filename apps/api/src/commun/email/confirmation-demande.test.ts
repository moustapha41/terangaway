import { describe, expect, it, vi } from "vitest";
import type { Resend } from "resend";

import { ServiceEmail } from "./email.service";

/**
 * L'écran de confirmation n'annonce un e-mail que si celui-ci est parti : le
 * service doit donc dire la vérité, y compris quand l'envoi échoue.
 */
const DETAILS = {
  reference: "TW-123456",
  titre: "Villa Almadies",
  lienAcces: { url: "https://exemple.sn/fr/acces-demande/twl_x", validiteHeures: 24 },
};

function avec(send: ReturnType<typeof vi.fn>) {
  return new ServiceEmail({ emails: { send } } as unknown as Resend);
}

describe("Confirmation de demande — envoi réel ou échec déclaré", () => {
  it("annonce l'envoi quand Resend accepte le message, lien compris", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "m1" }, error: null });
    const res = await avec(send).envoyerConfirmationDemande("Fatou@Exemple.sn", DETAILS);

    expect(res).toEqual({ envoye: true });
    const mail = send.mock.calls[0][0];
    expect(mail.to).toBe("fatou@exemple.sn");
    expect(mail.text).toContain(DETAILS.lienAcces.url);
  });

  it("déclare l'échec quand Resend refuse", async () => {
    const send = vi.fn().mockResolvedValue({ data: null, error: { message: "domaine non vérifié" } });
    expect(await avec(send).envoyerConfirmationDemande("a@b.sn", DETAILS)).toEqual({ envoye: false });
  });

  it("déclare l'échec quand l'envoi lève, sans faire tomber l'appelant", async () => {
    const send = vi.fn().mockRejectedValue(new Error("réseau coupé"));
    expect(await avec(send).envoyerConfirmationDemande("a@b.sn", DETAILS)).toEqual({ envoye: false });
  });

  it("déclare l'échec quand aucun service d'e-mail n'est configuré", async () => {
    const sans = new ServiceEmail(undefined as unknown as Resend);
    expect(await sans.envoyerConfirmationDemande("a@b.sn", DETAILS)).toEqual({ envoye: false });
  });
});
