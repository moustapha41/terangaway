import type { ContenuEmail } from "./demande.modele";

/**
 * La relance : des demandes attendent une réponse depuis trop longtemps.
 *
 * L'alerte d'arrivée peut se perdre — une notification manquée, un téléphone
 * en silencieux, une nuit. Celle-ci rattrape : elle part quand le délai de
 * relance du PRD §10 est dépassé et que la demande est toujours « envoyée »,
 * c'est-à-dire que personne ne l'a touchée.
 *
 * Une seule par demande, jamais deux. Une alerte qui se répète toutes les cinq
 * minutes finit dans un filtre, et le jour où elle compte, personne ne la lit.
 */

export interface LigneRelance {
  reference: string;
  genre: string;
  titre: string;
  /** « depuis 1 h 20 », déjà composé. */
  depuis: string;
  /** « expire aujourd'hui à 22 h 36 », ou le constat que c'est déjà passé. */
  echeance?: string;
  lien: string;
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

export function genererRelanceEquipe(lignes: readonly LigneRelance[]): ContenuEmail {
  const nombre = lignes.length;
  const sujet =
    nombre === 1
      ? `Sans réponse : ${lignes[0].reference} — ${lignes[0].titre}`
      : `${nombre} demandes attendent une réponse`;

  const texte = [
    nombre === 1
      ? "Une demande attend toujours une réponse :"
      : `${nombre} demandes attendent toujours une réponse :`,
    "",
    ...lignes.flatMap((ligne) => [
      `${ligne.reference} · ${ligne.genre} · ${ligne.titre}`,
      `  en attente ${ligne.depuis}${ligne.echeance ? ` · ${ligne.echeance}` : ""}`,
      `  ${ligne.lien}`,
      "",
    ]),
    "Passé le délai, la demande expire et le voyageur cherche ailleurs.",
    "",
  ].join("\n");

  const cartes = lignes
    .map(
      (ligne) => `
      <tr>
        <td class="cellule">
          <p class="reference">${echapper(ligne.reference)} · ${echapper(ligne.genre)}</p>
          <p class="titre">${echapper(ligne.titre)}</p>
          <p class="attente">En attente ${echapper(ligne.depuis)}${
            ligne.echeance ? ` · <strong>${echapper(ligne.echeance)}</strong>` : ""
          }</p>
          <p class="lien"><a href="${ligne.lien}">Ouvrir la demande</a></p>
        </td>
      </tr>`,
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
    }
    .wrapper {
      max-width: 560px;
      margin: 24px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .header { background-color: #b42318; padding: 20px 28px; }
    .header-titre { color: #ffffff; font-size: 17px; font-weight: 700; margin: 0; }
    .header-sous { color: #fecdca; font-size: 13px; margin: 4px 0 0; }
    .content { padding: 20px 28px 26px; }
    table { width: 100%; border-collapse: collapse; }
    .cellule { padding: 14px 0; border-bottom: 1px solid #f1f5f9; }
    .reference { font-size: 12px; color: #64748b; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.4px; }
    .titre { font-size: 15px; font-weight: 600; color: #0f172a; margin: 0 0 4px; }
    .attente { font-size: 13px; color: #b42318; margin: 0 0 6px; }
    .lien { margin: 0; font-size: 14px; }
    .lien a { color: #0f172a; font-weight: 600; }
    .pied { font-size: 13px; color: #64748b; margin: 18px 0 0; }
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
      <p class="header-titre">${
        nombre === 1 ? "Une demande sans réponse" : `${nombre} demandes sans réponse`
      }</p>
      <p class="header-sous">Le délai de prise en charge est dépassé.</p>
    </div>
    <div class="content">
      <table>${cartes}</table>
      <p class="pied">
        Passé le délai, la demande expire et le voyageur cherche ailleurs.
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0;">Teranga Way · relance automatique, une seule par demande.</p>
    </div>
  </div>
</body>
</html>`;

  return { sujet, html, texte };
}
