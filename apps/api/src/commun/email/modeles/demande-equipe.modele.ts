import type { ContenuEmail } from "./demande.modele";

/**
 * L'alerte interne : une demande vient d'arriver.
 *
 * Elle existe parce que rien ne prévenait personne. Une demande se rangeait en
 * base et attendait que quelqu'un ouvre le backoffice ; passé deux heures, elle
 * expirait en silence. Pendant les Jeux, avec un hôte qui a deux heures pour
 * répondre, c'était le maillon le plus coûteux de la chaîne.
 *
 * D'où la forme : tout ce qu'il faut pour décider est **dans le corps du
 * message**, lisible sur un téléphone sans ouvrir quoi que ce soit — qui,
 * quoi, combien, et jusqu'à quand. Le lien vers le backoffice vient après,
 * pour agir. Une alerte qui oblige à se connecter avant de comprendre arrive
 * toujours trop tard.
 */

export interface AlerteDemande {
  reference: string;
  /** « logement », « trajet », « taxi », « restauration »… tel qu'affiché. */
  genre: string;
  titre: string;
  sejour?: string;
  /**
   * Le détail de ce que le visiteur a choisi, ligne par ligne : durée, lieu,
   * décomposition du prix pour un logement ; trajet, heure de prise en charge,
   * bagages, vol pour un transport ; saisie champ par champ pour un service.
   * Quand il est là, il remplace « Séjour », trop court pour décider.
   */
  detail?: Array<[libelle: string, valeur: string]>;
  personnes?: number;
  /** Total figé, déjà formaté avec sa monnaie. */
  total?: string;
  /** Le message laissé par le visiteur, s'il en a laissé un. */
  message?: string;
  /** Heure limite de réponse, déjà composée : « aujourd'hui à 22 h 36 ». */
  repondreAvant?: string;
  contact: { nom?: string; email?: string; telephone?: string };
  /** Lien direct vers la demande dans le backoffice. */
  lien: string;
  /**
   * Lien de réponse immédiate — accepter ou refuser sans se connecter.
   *
   * Il n'est là que lorsque le propriétaire de l'annonce est l'équipe
   * elle-même, ce qui est le cas des vingt-quatre annonces collectées : le
   * jeton va alors à qui doit s'en servir. Quand un propriétaire a sa propre
   * adresse, c'est à lui qu'il part, et ce champ reste vide.
   */
  lienReponse?: string;
}

const ECHAPPEMENTS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Ce qui vient du visiteur traverse cet e-mail : son message, son nom. */
function echapper(valeur: string): string {
  return valeur.replace(/[&<>"']/g, (caractere) => ECHAPPEMENTS[caractere]);
}

export function genererAlerteDemande(alerte: AlerteDemande): ContenuEmail {
  const qui = alerte.contact.nom || alerte.contact.email || "visiteur";
  const sujet = `Nouvelle demande ${alerte.reference} — ${alerte.titre}`;

  const lignes: Array<[string, string | undefined]> = [
    ["Référence", alerte.reference],
    ["Type", alerte.genre],
    ["Offre", alerte.titre],
    ...(alerte.detail && alerte.detail.length > 0
      ? alerte.detail
      : ([
          ["Séjour", alerte.sejour],
          ["Voyageurs", alerte.personnes ? String(alerte.personnes) : undefined],
        ] as Array<[string, string | undefined]>)),
    ["Total", alerte.total],
    ["Nom", alerte.contact.nom],
    ["E-mail", alerte.contact.email],
    ["Téléphone", alerte.contact.telephone],
  ];

  const texte = [
    `${qui} vient d'envoyer une demande.`,
    "",
    ...lignes.filter(([, v]) => v).map(([etiquette, v]) => `${etiquette} : ${v}`),
    ...(alerte.message ? ["", `Message : ${alerte.message}`] : []),
    ...(alerte.repondreAvant ? ["", `À répondre avant ${alerte.repondreAvant}.`] : []),
    "",
    `Traiter la demande : ${alerte.lien}`,
    ...(alerte.lienReponse
      ? ["", `Répondre tout de suite, sans se connecter : ${alerte.lienReponse}`]
      : []),
    "",
  ].join("\n");

  const tableau = lignes
    .filter(([, valeur]) => valeur)
    .map(
      ([etiquette, valeur]) =>
        `<tr><td class="etiquette">${echapper(etiquette)}</td><td class="valeur">${echapper(
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
      margin: 24px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .header { background-color: #0f172a; padding: 20px 28px; }
    .header-titre { color: #ffffff; font-size: 17px; font-weight: 700; margin: 0; }
    .header-sous { color: #94a3b8; font-size: 13px; margin: 4px 0 0; }
    .content { padding: 24px 28px; }
    .delai {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 12px 14px;
      border-radius: 4px;
      font-size: 14px;
      color: #92400e;
      margin: 0 0 20px;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    td { padding: 7px 0; font-size: 14px; vertical-align: top; border-bottom: 1px solid #f1f5f9; }
    .etiquette { color: #64748b; width: 110px; }
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
    .bouton {
      display: inline-block;
      background-color: #0f172a;
      color: #ffffff;
      text-decoration: none;
      font-size: 15px;
      font-weight: 600;
      padding: 12px 28px;
      border-radius: 999px;
    }
    .reponse {
      font-size: 13px;
      line-height: 1.6;
      color: #64748b;
      margin: 16px 0 0;
    }
    .footer {
      background-color: #f8fafc;
      padding: 14px 28px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <p class="header-titre">Nouvelle demande · ${echapper(alerte.reference)}</p>
      <p class="header-sous">${echapper(qui)} vient d'envoyer une demande.</p>
    </div>
    <div class="content">
      ${
        alerte.repondreAvant
          ? `<p class="delai">⏳ À répondre avant <strong>${echapper(
              alerte.repondreAvant,
            )}</strong>.</p>`
          : ""
      }
      <table>${tableau}</table>
      ${alerte.message ? `<p class="message">${echapper(alerte.message)}</p>` : ""}
      <p style="margin: 0;">
        <a class="bouton" href="${alerte.lien}">Traiter la demande</a>
      </p>
      ${
        alerte.lienReponse
          ? `<p class="reponse">
        Ou répondre tout de suite, sans se connecter :
        <a href="${alerte.lienReponse}">accepter ou refuser</a>.
        Ce lien vaut décision et ne sert qu'une fois&nbsp;: il ne se transfère à personne.
      </p>`
          : ""
      }
    </div>
    <div class="footer">
      <p style="margin: 0;">Teranga Way · alerte interne, ne pas transférer au visiteur.</p>
    </div>
  </div>
</body>
</html>`;

  return { sujet, html, texte };
}
