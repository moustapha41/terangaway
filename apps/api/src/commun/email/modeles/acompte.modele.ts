/**
 * Modèle d'e-mail des instructions de virement d'un acompte.
 *
 * Il part quand le propriétaire a accepté une demande de logement ou de
 * location, et il porte tout ce qu'il faut pour virer sans se tromper : le
 * montant, le compte, le motif, l'échéance.
 *
 * **Aucune coordonnée bancaire n'est écrite ici.** Elles arrivent en
 * paramètre, depuis la configuration de l'API — source unique, refusée
 * incomplète. Un IBAN dans ce fichier serait copié dans chaque e-mail le jour
 * où le compte change, et c'est exactement ce qu'un fraudeur espère.
 *
 * Il ne dit jamais qu'un paiement est reçu : rien ici ne voit la banque. Le
 * visiteur apprendra que son virement est arrivé par un autre e-mail, envoyé
 * quand une personne l'aura constaté sur le compte.
 */
import type { BeneficiaireAcompte, CompteMobileMoney } from "@teranga/contracts";

import type { ContenuEmail } from "./demande.modele";

export interface InstructionsAcompte {
  reference: string;
  /** Le logement ou le véhicule, tel qu'il s'affiche. */
  titre: string;
  /** Déjà formatés avec leur monnaie : « 620 000 FCFA ». */
  total: string;
  acompte: string;
  pourcentage: number;
  /** « 2 novembre à 08:00 », heure de Dakar, déjà composée par l'appelant. */
  echeance: string;
  /** Présent si le virement est un moyen accepté — et complètement configuré. */
  beneficiaire?: BeneficiaireAcompte;
  /** Les comptes Mobile Money acceptés, complets. */
  mobileMoney?: readonly CompteMobileMoney[];
  /** Consignes libres de l'équipe, déjà validées en longueur par la configuration. */
  instructions?: string;
}

const NOM_OPERATEUR: Record<CompteMobileMoney["operateur"], string> = {
  wave: "Wave",
  "orange-money": "Orange Money",
};

const ECHAPPEMENTS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function echapper(valeur: string): string {
  return valeur.replace(/[&<>"']/g, (caractere) => ECHAPPEMENTS[caractere]);
}

/** L'IBAN par groupes de quatre : il se recopie à la main, et se relit. */
function grouperIban(iban: string): string {
  return iban.replace(/(.{4})(?=.)/g, "$1 ");
}

export function genererEmailInstructionsAcompte(details: InstructionsAcompte): ContenuEmail {
  const sujet = `Acompte à régler pour ${details.reference} — Teranga Way`;
  const { beneficiaire } = details;
  const comptesMobiles = details.mobileMoney ?? [];
  const iban = beneficiaire ? grouperIban(beneficiaire.iban) : "";
  const moyen = beneficiaire && comptesMobiles.length === 0 ? "par virement bancaire" : "";

  const texteVirement = beneficiaire
    ? [
        "— Le virement —",
        "",
        `Titulaire : ${beneficiaire.titulaire}`,
        `Banque : ${beneficiaire.banque}`,
        `IBAN : ${iban}`,
        `BIC : ${beneficiaire.bic}`,
        `Motif à inscrire : ${details.reference}`,
        "",
      ]
    : [];
  const texteMobile = comptesMobiles.flatMap((compte) => [
    `— ${NOM_OPERATEUR[compte.operateur]} —`,
    "",
    `Numéro : ${compte.numero}`,
    `Bénéficiaire : ${compte.titulaire}`,
    `Message ou motif à indiquer : ${details.reference}`,
    "",
  ]);

  const texte = [
    "Bonjour,",
    "",
    "Le propriétaire a accepté votre demande, sous réserve du règlement d'un acompte de",
    `${details.pourcentage} %${moyen ? ` ${moyen}` : ""} à régler avant le ${details.echeance} (heure de Dakar).`,
    "",
    `Référence : ${details.reference}`,
    `Offre : ${details.titre}`,
    `Total de la réservation : ${details.total}`,
    `Acompte à régler : ${details.acompte}`,
    "",
    ...texteVirement,
    ...texteMobile,
    ...(details.instructions ? [details.instructions, ""] : []),
    "Le motif est indispensable : sans lui, nous ne pouvons pas rattacher votre",
    "paiement à votre réservation.",
    "",
    "— Ce qu'il faut savoir —",
    "",
    "Votre acompte n'est considéré comme reçu qu'après vérification de notre compte",
    "par notre équipe. Vous recevrez alors un e-mail de confirmation. Jusque-là,",
    "aucun paiement n'est enregistré, même si votre banque ou votre opérateur a exécuté le transfert.",
    "",
    "Vous avez déjà payé, ou vous rencontrez une difficulté ? Répondez à cet e-mail",
    "en indiquant votre référence : nous vérifions et revenons vers vous.",
    "",
    "Ces coordonnées ne changent jamais par e-mail. Si quelqu'un vous en communique",
    "d'autres, ne payez rien et prévenez-nous.",
    "",
    "L'équipe Teranga Way",
    "L'hospitalité sénégalaise en toute confiance",
    "",
  ].join("\n");

  const ligne = (etiquette: string, valeur: string, classe = "valeur") =>
    `<p class="ligne"><span class="etiquette">${etiquette}</span><span class="${classe}">${echapper(
      valeur,
    )}</span></p>`;

  const blocVirement = beneficiaire
    ? `<h3 class="sous-titre">Le virement</h3>
      <div class="recap">
        ${ligne("Titulaire", beneficiaire.titulaire)}
        ${ligne("Banque", beneficiaire.banque)}
        ${ligne("IBAN", iban, "code")}
        ${ligne("BIC", beneficiaire.bic, "code")}
        ${ligne("Motif à inscrire", details.reference, "code")}
      </div>`
    : "";
  const blocsMobiles = comptesMobiles
    .map(
      (compte) => `<h3 class="sous-titre">${echapper(NOM_OPERATEUR[compte.operateur])}</h3>
      <div class="recap">
        ${ligne("Numéro", compte.numero, "code")}
        ${ligne("Bénéficiaire", compte.titulaire)}
        ${ligne("Message ou motif", details.reference, "code")}
      </div>`,
    )
    .join("\n      ");
  const blocInstructions = details.instructions
    ? `<p class="text">${echapper(details.instructions)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${echapper(sujet)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; }
    .wrapper { max-width: 560px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background-color: #0f172a; padding: 28px 32px; text-align: center; }
    .brand-title { color: #ffffff; font-size: 24px; font-weight: 700; margin: 0; }
    .brand-accent { color: #f59e0b; }
    .content { padding: 36px 32px; }
    .title { font-size: 20px; font-weight: 600; margin: 0 0 16px; }
    .sous-titre { font-size: 16px; font-weight: 600; margin: 28px 0 12px; }
    .text { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px; }
    .recap { background-color: #f1f5f9; border-radius: 10px; padding: 18px 20px; margin: 0 0 20px; }
    .ligne { display: block; font-size: 14px; line-height: 1.7; color: #334155; margin: 0; }
    .etiquette { color: #64748b; display: inline-block; min-width: 140px; }
    .valeur { color: #0f172a; font-weight: 600; }
    .code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-weight: 700; color: #0f172a; user-select: all; }
    .notice { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 4px; margin: 0 0 16px; }
    .notice-text { font-size: 13px; line-height: 1.5; color: #1e40af; margin: 0; }
    .alerte { background-color: #fff7ed; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 4px; margin: 0 0 16px; }
    .alerte-text { font-size: 13px; line-height: 1.5; color: #9a3412; margin: 0; }
    .footer { background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1 class="brand-title">Teranga <span class="brand-accent">Way</span></h1>
    </div>
    <div class="content">
      <h2 class="title">Votre demande est acceptée, sous réserve de paiement</h2>
      <p class="text">
        Un acompte de ${details.pourcentage}&nbsp;% est à régler${
          moyen ? " par virement bancaire" : ""
        } avant le <strong>${echapper(details.echeance)}</strong> (heure de Dakar).
      </p>
      <div class="recap">
        ${ligne("Référence", details.reference, "code")}
        ${ligne("Offre", details.titre)}
        ${ligne("Total", details.total)}
        ${ligne("Acompte à régler", details.acompte)}
      </div>
      ${blocVirement}${blocsMobiles}${blocInstructions}
      <p class="text">
        Le motif est indispensable&nbsp;: sans lui, nous ne pouvons pas rattacher votre
        paiement à votre réservation.
      </p>
      <div class="notice">
        <p class="notice-text">
          Votre acompte n'est considéré comme reçu qu'après vérification de notre compte par
          notre équipe. Vous recevrez alors un e-mail de confirmation. Jusque-là, aucun
          paiement n'est enregistré, même si votre banque ou votre opérateur a exécuté le transfert.
        </p>
      </div>
      <p class="text">
        Vous avez déjà payé, ou vous rencontrez une difficulté&nbsp;? Répondez à cet e-mail en
        indiquant votre référence&nbsp;: nous vérifions et revenons vers vous.
      </p>
      <div class="alerte">
        <p class="alerte-text">
          Ces coordonnées ne changent jamais par e-mail. Si quelqu'un vous en communique
          d'autres, ne payez rien et prévenez-nous.
        </p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} Teranga Way. L'hospitalité en toute confiance.</p>
    </div>
  </div>
</body>
</html>`;

  return { sujet, html, texte };
}


export interface ReceptionAcompteEmail {
  reference: string;
  titre: string;
  /** Le versement qui vient d'être constaté — pas le cumul. */
  montantRecu: string;
  /** Le cumul constaté depuis l'ouverture du dossier. */
  cumulRecu: string;
  acompteAttendu: string;
  /** Ce qui manque encore sur l'acompte ; absent quand il est complet. */
  resteAcompte?: string;
  /** Le surplus par rapport à l'acompte ; absent sinon. */
  surplus?: string;
  /** Le solde du séjour hors acompte : total − acompte attendu. */
  soldeSejour: string;
  /** « 2 novembre à 08:00 », heure de Dakar. */
  dateValidation: string;
  /** Le statut **réel** de la réservation, déjà en clair. */
  statutReservation: string;
  /** La réservation est-elle déjà confirmée ? Sinon l'e-mail le dit. */
  reservationConfirmee: boolean;
}

/**
 * L'e-mail « acompte reçu et vérifié ».
 *
 * Il ne part qu'après la constatation d'une personne, et ne parle que de ce
 * qu'elle a constaté. Il ne dit jamais que la réservation est confirmée à moins
 * qu'elle le soit : recevoir l'acompte n'est pas, à lui seul, la confirmer.
 */
export function genererEmailReceptionAcompte(details: ReceptionAcompteEmail): ContenuEmail {
  const complet = details.resteAcompte === undefined;
  const sujet = complet
    ? `Acompte reçu pour ${details.reference} — Teranga Way`
    : `Versement reçu pour ${details.reference} — Teranga Way`;
  const titre = complet ? "Votre acompte est reçu et vérifié" : "Un versement a été reçu et vérifié";

  const lignes: Array<[string, string]> = [
    ["Référence", details.reference],
    ["Offre", details.titre],
    ["Montant reçu", details.montantRecu],
    ["Validé le", details.dateValidation],
    ["Total reçu à ce jour", details.cumulRecu],
    ["Acompte attendu", details.acompteAttendu],
    ...(details.resteAcompte ? ([["Reste à régler sur l'acompte", details.resteAcompte]] as Array<[string, string]>) : []),
    ...(details.surplus ? ([["Montant supérieur à l'acompte", details.surplus]] as Array<[string, string]>) : []),
    ["Solde du séjour hors acompte", details.soldeSejour],
    ["Statut de la réservation", details.statutReservation],
  ];

  const mentions = [
    ...(complet
      ? []
      : [
          "L'acompte n'est pas encore complet : le reste est à régler avec les mêmes coordonnées",
          "et la même référence. Ce versement est bien enregistré, vous n'avez pas à le renvoyer.",
        ]),
    ...(details.surplus
      ? [
          "Le montant reçu dépasse l'acompte attendu. Notre équipe vous contactera au sujet de",
          "la différence ; aucun remboursement n'a été effectué automatiquement.",
        ]
      : []),
    ...(details.reservationConfirmee
      ? []
      : [
          "La réception de l'acompte ne vaut pas, à elle seule, confirmation de la réservation :",
          "le statut ci-dessus est celui de votre réservation à cette date.",
        ]),
  ];

  const texte = [
    "Bonjour,",
    "",
    `${titre} par notre équipe, après vérification de notre compte.`,
    "",
    ...lignes.map(([etiquette, valeur]) => `${etiquette} : ${valeur}`),
    "",
    ...(mentions.length > 0 ? [...mentions, ""] : []),
    "Une question ? Répondez à cet e-mail en indiquant votre référence.",
    "",
    "L'équipe Teranga Way",
    "L'hospitalité sénégalaise en toute confiance",
    "",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${echapper(sujet)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; }
    .wrapper { max-width: 560px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background-color: #0f172a; padding: 28px 32px; text-align: center; }
    .brand-title { color: #ffffff; font-size: 24px; font-weight: 700; margin: 0; }
    .brand-accent { color: #f59e0b; }
    .content { padding: 36px 32px; }
    .title { font-size: 20px; font-weight: 600; margin: 0 0 16px; }
    .text { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px; }
    .recap { background-color: #f1f5f9; border-radius: 10px; padding: 18px 20px; margin: 0 0 20px; }
    .ligne { display: block; font-size: 14px; line-height: 1.7; color: #334155; margin: 0; }
    .etiquette { color: #64748b; display: inline-block; min-width: 200px; }
    .valeur { color: #0f172a; font-weight: 600; }
    .notice { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 4px; margin: 0 0 16px; }
    .notice-text { font-size: 13px; line-height: 1.5; color: #1e40af; margin: 0; }
    .footer { background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1 class="brand-title">Teranga <span class="brand-accent">Way</span></h1>
    </div>
    <div class="content">
      <h2 class="title">${echapper(titre)}</h2>
      <p class="text">Notre équipe a vérifié la réception sur notre compte.</p>
      <div class="recap">
        ${lignes
          .map(
            ([etiquette, valeur]) =>
              `<p class="ligne"><span class="etiquette">${echapper(etiquette)}</span><span class="valeur">${echapper(valeur)}</span></p>`,
          )
          .join("\n        ")}
      </div>
      ${mentions.length > 0 ? `<div class="notice"><p class="notice-text">${echapper(mentions.join(" "))}</p></div>` : ""}
      <p class="text">Une question&nbsp;? Répondez à cet e-mail en indiquant votre référence.</p>
    </div>
    <div class="footer">
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} Teranga Way. L'hospitalité en toute confiance.</p>
    </div>
  </div>
</body>
</html>`;

  return { sujet, html, texte };
}
