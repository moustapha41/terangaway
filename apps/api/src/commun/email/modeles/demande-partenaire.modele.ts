import type { ContenuEmail } from "./demande.modele";

/**
 * La demande telle qu'elle arrive chez le propriétaire.
 *
 * Deux heures pour répondre, et il n'a pas de compte : l'e-mail porte donc le
 * lien qui décide. Accepter ou refuser se fait depuis le message, sans mot de
 * passe et sans application — c'est la seule forme qui tienne pour quelqu'un
 * qui reçoit cela sur son téléphone, au marché ou au volant.
 *
 * Ce qui n'y figure pas est aussi important : **aucune coordonnée du
 * visiteur**. Le nom, l'adresse et le numéro ne sont révélés qu'après
 * confirmation (§D.4). Tant que la demande n'est pas acceptée, le propriétaire
 * décide sur le séjour, pas sur la personne.
 */

export interface DemandePartenaire {
  reference: string;
  titre: string;
  sejour?: string;
  personnes?: number;
  /** Le montant qui lui revient, déjà formaté. */
  total?: string;
  /** Ce que le visiteur a écrit, s'il a écrit quelque chose. */
  message?: string;
  /** « aujourd'hui à 22 h 36 » — au-delà, la demande expire. */
  repondreAvant?: string;
  /** Le lien qui accepte ou refuse, porteur du jeton. */
  lienReponse: string;
}

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

export function genererEmailPartenaire(demande: DemandePartenaire): ContenuEmail {
  const sujet = `Demande à confirmer — ${demande.titre} (${demande.reference})`;

  const lignes: Array<[string, string | undefined]> = [
    ["Référence", demande.reference],
    ["Logement", demande.titre],
    ["Séjour", demande.sejour],
    ["Voyageurs", demande.personnes ? String(demande.personnes) : undefined],
    ["Montant", demande.total],
  ];

  const texte = [
    "Bonjour,",
    "",
    "Un voyageur souhaite réserver chez vous.",
    "",
    ...lignes.filter(([, v]) => v).map(([etiquette, v]) => `${etiquette} : ${v}`),
    ...(demande.message ? ["", `Son message : ${demande.message}`] : []),
    "",
    ...(demande.repondreAvant
      ? [`Merci de répondre avant ${demande.repondreAvant}, sans quoi la demande expire.`, ""]
      : []),
    "Accepter ou refuser, en un clic et sans mot de passe :",
    demande.lienReponse,
    "",
    "Ce lien ne sert qu'une fois et n'est valable que deux heures. Ne le",
    "transmettez à personne : il vaut votre décision.",
    "",
    "L'équipe Teranga Way",
    "",
  ].join("\n");

  const tableau = lignes
    .filter(([, valeur]) => valeur)
    .map(
      ([etiquette, valeur]) =>
        `<tr><td class="etiquette">${etiquette}</td><td class="valeur">${echapper(
          String(valeur),
        )}</td></tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${echapper(sujet)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 560px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .header { background-color: #0f172a; padding: 26px 30px; text-align: center; }
    .brand-title { color: #ffffff; font-size: 23px; font-weight: 700; margin: 0; }
    .brand-accent { color: #f59e0b; }
    .content { padding: 30px; }
    .title { font-size: 19px; font-weight: 600; margin: 0 0 14px; }
    .text { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    td { padding: 8px 0; font-size: 14px; vertical-align: top; border-bottom: 1px solid #f1f5f9; }
    .etiquette { color: #64748b; width: 105px; }
    .valeur { color: #0f172a; font-weight: 600; }
    .message {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      margin: 0 0 20px;
      white-space: pre-wrap;
    }
    .delai {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 12px 14px;
      border-radius: 4px;
      font-size: 14px;
      color: #92400e;
      margin: 0 0 22px;
    }
    .bouton {
      display: inline-block;
      background-color: #087443;
      color: #ffffff;
      text-decoration: none;
      font-size: 16px;
      font-weight: 600;
      padding: 14px 34px;
      border-radius: 999px;
    }
    .warning { font-size: 13px; line-height: 1.5; color: #64748b; margin: 22px 0 0; }
    .footer {
      background-color: #f8fafc;
      padding: 18px 30px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1 class="brand-title">Teranga <span class="brand-accent">Way</span></h1>
    </div>
    <div class="content">
      <h2 class="title">Un voyageur souhaite réserver chez vous</h2>
      <p class="text">Voici sa demande. À vous de l'accepter ou de la refuser.</p>
      <table>${tableau}</table>
      ${demande.message ? `<p class="message">${echapper(demande.message)}</p>` : ""}
      ${
        demande.repondreAvant
          ? `<p class="delai">⏳ Merci de répondre avant <strong>${echapper(
              demande.repondreAvant,
            )}</strong>, sans quoi la demande expire.</p>`
          : ""
      }
      <p style="text-align: center; margin: 0;">
        <a class="bouton" href="${demande.lienReponse}">Accepter ou refuser</a>
      </p>
      <p class="warning">
        🔒 Ce lien ne sert qu'une fois et n'est valable que deux heures. Ne le transmettez
        à personne&nbsp;: il vaut votre décision. Les coordonnées du voyageur vous seront
        communiquées une fois la demande confirmée.
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} Teranga Way.</p>
    </div>
  </div>
</body>
</html>`;

  return { sujet, html, texte };
}
