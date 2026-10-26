/**
 * Modèle d'e-mail de confirmation d'une demande.
 *
 * Il part dès que la demande est enregistrée, et il porte deux choses :
 *
 *   la **référence**, seule prise du visiteur sur sa demande — il n'a rien payé,
 *   rien réservé, et sans elle il n'a que le souvenir d'un écran ;
 *
 *   ses **identifiants**, quand le compte vient d'être ouvert pour lui. Depuis
 *   que le code à six chiffres a disparu de l'envoi, une demande crée un compte
 *   sans que personne ait choisi de mot de passe : celui-ci est engendré et
 *   expédié ici, une seule fois, à l'adresse saisie. C'est aussi ce qui prouve
 *   l'adresse — s'en servir, c'est avoir relevé cette boîte.
 */

import type { MoyenAcompte } from "@teranga/contracts";

export interface IdentifiantsDemande {
  email: string;
  motDePasse: string;
}

export interface DetailsDemande {
  reference: string;
  /** Le logement, le véhicule ou le service demandé, tel qu'il s'affiche. */
  titre: string;
  /** « 1 nov. 2026 → 8 nov. 2026 », déjà composé par l'appelant. */
  sejour?: string;
  /** Total figé à l'envoi, déjà formaté avec sa monnaie. */
  total?: string;
  /** Adresse du site, pour le lien de connexion. */
  urlSite: string;
  /** Présents une seule fois : à la création du compte. */
  identifiants?: IdentifiantsDemande;
  /**
   * Présent quand cette demande donnera lieu à un acompte si elle est
   * acceptée : acompte ouvert, genre éligible, prix connu.
   *
   * Absent, l'e-mail garde l'ancienne promesse — rien avant la prestation —
   * parce qu'elle reste vraie : pour un taxi, un trajet, un service, ou tant
   * que l'acompte est fermé.
   */
  acompte?: AnnonceAcompte;
  /**
   * Lien personnel et à usage unique vers cette demande, sans mot de passe.
   * Absent quand il n'a pas pu être émis : l'e-mail ne promet alors rien.
   */
  lienAcces?: { url: string; validiteHeures: number };
  /**
   * La suite du séjour, en adresses complètes.
   *
   * Seulement pour un logement : c'est lui qui appelle un transfert. Les mêmes
   * adresses que l'écran de confirmation — un visiteur arrivé par l'e-mail doit
   * retrouver le trajet que l'écran lui annonçait.
   */
  suite?: { lieu: string; arrivee: string; depart: string; services: string };
}

export interface AnnonceAcompte {
  pourcentage: number;
  delaiHeures: number;
  /**
   * Les moyens réellement configurés. Absent = le virement seul, comme avant
   * Mobile Money : l'e-mail n'annonce jamais un moyen que l'instruction
   * d'après n'offrirait pas.
   */
  moyens?: readonly MoyenAcompte[];
}

const LIBELLE_MOYEN: Record<MoyenAcompte, string> = {
  virement: "virement bancaire",
  wave: "Wave",
  "orange-money": "Orange Money",
};

/** « par virement bancaire », « par Wave ou Orange Money »… */
function parMoyens(moyens: readonly MoyenAcompte[] | undefined): string {
  const libelles = (moyens && moyens.length > 0 ? moyens : (["virement"] as const)).map((m) => LIBELLE_MOYEN[m]);
  const liste = libelles.length === 1 ? libelles[0] : `${libelles.slice(0, -1).join(", ")} ou ${libelles.at(-1)}`;
  return `par ${liste}`;
}

export interface ContenuEmail {
  sujet: string;
  html: string;
  texte: string;
}

const ECHAPPEMENTS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Échappe ce qui vient du visiteur avant de l'écrire dans du HTML.
 *
 * Le titre d'une offre et le nom d'un service traversent cet e-mail. Les
 * écrire tels quels laisserait une apostrophe casser le document — et une
 * balise y entrer.
 */
export function echapper(valeur: string): string {
  return valeur.replace(/[&<>"']/g, (caractere) => ECHAPPEMENTS[caractere]);
}

export function genererEmailDemande(details: DetailsDemande): ContenuEmail {
  const sujet = `Votre demande ${details.reference} — Teranga Way`;
  const connexion = `${details.urlSite.replace(/\/$/, "")}/fr/connexion`;

  const lignesTexte = [
    "Bonjour,",
    "",
    "Votre demande est bien arrivée. Le propriétaire a deux heures pour répondre ;",
    "vous serez prévenu dès qu'il le fait.",
    "",
    `Référence : ${details.reference}`,
    `Offre : ${details.titre}`,
    ...(details.sejour ? [`Séjour : ${details.sejour}`] : []),
    ...(details.total ? [`Total annoncé : ${details.total}`] : []),
    "",
    ...(details.lienAcces
      ? [
          "Retrouvez votre demande et son récapitulatif grâce à ce lien sécurisé :",
          details.lienAcces.url,
          `Il est personnel, ne fonctionne qu'une fois et expire sous ${details.lienAcces.validiteHeures} heures.`,
          "Ne le transférez à personne. Votre demande n'est pas une réservation confirmée tant que",
          "les conditions de confirmation ne sont pas remplies.",
          "",
        ]
      : []),
    ...(details.acompte
      ? [
          "Rien n'est payé pour l'instant. Si le propriétaire accepte, un acompte de",
          `${details.acompte.pourcentage} % du total vous sera demandé ${parMoyens(details.acompte.moyens)}, à régler sous`,
          `${details.acompte.delaiHeures} heures : les instructions vous arriveront par e-mail. Il se règle à`,
          "Teranga Way, uniquement avec les coordonnées de cet e-mail d'instructions. Votre acompte",
          "n'est considéré comme reçu qu'après vérification de notre compte par notre équipe.",
        ]
      : [
          "Rien n'est payé, rien n'est bloqué : le paiement se fait sur place, auprès du",
          "propriétaire, et jamais avant la prestation.",
        ]),
  ];

  if (details.suite) {
    lignesTexte.push(
      "",
      "— Complétez votre séjour —",
      "",
      "Facultatif : à ajouter dès maintenant, ou plus tard.",
      "",
      `Votre transfert depuis l'aéroport, de l'aéroport AIBD à ${details.suite.lieu} :`,
      details.suite.arrivee,
      "",
      "Pendant votre séjour — carte SIM, guides, restaurants :",
      details.suite.services,
      "",
      `Votre retour à l'aéroport, de ${details.suite.lieu} à l'aéroport AIBD :`,
      details.suite.depart,
    );
  }

  if (details.identifiants) {
    lignesTexte.push(
      "",
      "— Votre compte —",
      "",
      "Nous avons ouvert un compte à votre nom pour que vous puissiez suivre cette",
      "demande et les suivantes :",
      "",
      `Adresse : ${details.identifiants.email}`,
      `Mot de passe : ${details.identifiants.motDePasse}`,
      "",
      `Connexion : ${connexion}`,
      "",
      "Ce mot de passe a été engendré pour vous. Gardez-le, ou demandez un code de",
      "connexion à usage unique depuis l'écran de connexion : les deux fonctionnent.",
      "Ne le communiquez à personne — aucun membre de l'équipe ne vous le demandera.",
    );
  }

  lignesTexte.push(
    "",
    "L'équipe Teranga Way",
    "L'hospitalité sénégalaise en toute confiance",
    "",
  );

  const blocSuite = details.suite
    ? `
      <h3 class="sous-titre">Complétez votre séjour</h3>
      <p class="text">Facultatif : à ajouter dès maintenant, ou plus tard.</p>
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 8px;">
        ${[
          ["✈️", "Votre transfert depuis l'aéroport", `De l'aéroport AIBD à ${details.suite.lieu}`, details.suite.arrivee],
          ["🧭", "Pendant votre séjour", "Carte SIM, guides, restaurants", details.suite.services],
          ["🚗", "Votre retour à l'aéroport", `De ${details.suite.lieu} à l'aéroport AIBD`, details.suite.depart],
        ]
          .map(
            ([icone, titre, texte, lien]) => `<tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top; width: 34px; font-size: 20px;">${icone}</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
            <a href="${echapper(lien)}" style="color: #0f172a; font-weight: 600; font-size: 14px; text-decoration: none;">${echapper(titre)}</a>
            <div style="font-size: 13px; color: #64748b; margin-top: 2px;">${echapper(texte)}</div>
          </td>
        </tr>`,
          )
          .join("")}
      </table>`
    : "";

  const blocIdentifiants = details.identifiants
    ? `
      <h3 class="sous-titre">Votre compte</h3>
      <p class="text">
        Nous avons ouvert un compte à votre nom, pour que vous puissiez suivre cette
        demande et les suivantes :
      </p>
      <div class="identifiants">
        <p class="ligne"><span class="etiquette">Adresse</span><span class="valeur">${echapper(
          details.identifiants.email,
        )}</span></p>
        <p class="ligne"><span class="etiquette">Mot de passe</span><span class="motdepasse">${echapper(
          details.identifiants.motDePasse,
        )}</span></p>
      </div>
      <p style="text-align: center; margin: 0 0 24px;">
        <a class="bouton" href="${connexion}">Me connecter</a>
      </p>
      <p class="warning">
        🔒 Ce mot de passe a été engendré pour vous. Gardez-le, ou demandez un code de
        connexion à usage unique depuis l'écran de connexion&nbsp;: les deux fonctionnent.
        Ne le communiquez à personne&nbsp;— aucun membre de l'équipe Teranga Way ne vous
        le demandera.
      </p>`
    : "";

  const blocLien = details.lienAcces
    ? `
      <p style="text-align: center; margin: 24px 0 8px;">
        <a class="bouton" href="${echapper(details.lienAcces.url)}">Accéder à ma demande</a>
      </p>
      <p class="warning">
        🔒 Ce lien est personnel, ne fonctionne qu'une fois et expire sous
        ${details.lienAcces.validiteHeures}&nbsp;heures. Ne le transférez à personne.
        Votre demande n'est pas une réservation confirmée tant que les conditions de
        confirmation ne sont pas remplies.
      </p>`
    : "";

  // Jamais « payé » ni « reçu » ici : à l'envoi d'une demande, rien ne l'est,
  // et un virement ne le sera qu'une fois vu sur le compte par l'équipe.
  const blocPaiement = details.acompte
    ? `
          💳 <strong>Rien n'est payé pour l'instant.</strong> Si le propriétaire accepte, un
          acompte de ${details.acompte.pourcentage}&nbsp;% du total vous sera demandé
          ${parMoyens(details.acompte.moyens)}, à régler sous ${details.acompte.delaiHeures}&nbsp;heures&nbsp;: les
          instructions vous arriveront par e-mail. Il se règle à Teranga Way, uniquement avec les
          coordonnées de cet e-mail d'instructions. Votre acompte n'est considéré comme reçu qu'après
          vérification de notre compte par notre équipe.
        `
    : `
          💳 <strong>Aucun paiement :</strong> rien n'est bloqué ni prélevé. Le règlement
          se fait sur place, auprès du propriétaire, et jamais avant la prestation.
        `;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sujet}</title>
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
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #0f172a;
      padding: 28px 32px;
      text-align: center;
    }
    .brand-title {
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .brand-accent { color: #f59e0b; }
    .content { padding: 36px 32px; }
    .title {
      font-size: 20px;
      font-weight: 600;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .sous-titre {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin: 32px 0 12px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
    }
    .text {
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
      margin-bottom: 24px;
    }
    .recap {
      background-color: #f1f5f9;
      border-radius: 10px;
      padding: 18px 20px;
      margin: 0 0 24px;
    }
    .ligne {
      display: block;
      font-size: 14px;
      line-height: 1.7;
      color: #334155;
      margin: 0;
    }
    .etiquette { color: #64748b; display: inline-block; min-width: 110px; }
    .valeur { color: #0f172a; font-weight: 600; }
    .reference {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      user-select: all;
    }
    .identifiants {
      background-color: #f1f5f9;
      border: 2px dashed #cbd5e1;
      border-radius: 10px;
      padding: 18px 20px;
      margin: 0 0 20px;
    }
    .motdepasse {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #0f172a;
      user-select: all;
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
    .notice {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 14px 16px;
      border-radius: 4px;
      margin-bottom: 24px;
    }
    .notice-text { font-size: 13px; line-height: 1.5; color: #1e40af; margin: 0; }
    .warning {
      font-size: 13px;
      line-height: 1.5;
      color: #64748b;
      margin-top: 20px;
      margin-bottom: 0;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 32px;
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
      <h2 class="title">Votre demande est partie</h2>
      <p class="text">
        Elle est bien arrivée chez nous. Le propriétaire a deux heures pour répondre,
        et vous serez prévenu dès qu'il le fait.
      </p>
      <div class="recap">
        <p class="ligne"><span class="etiquette">Référence</span><span class="reference">${echapper(
          details.reference,
        )}</span></p>
        <p class="ligne"><span class="etiquette">Offre</span><span class="valeur">${echapper(
          details.titre,
        )}</span></p>
        ${
          details.sejour
            ? `<p class="ligne"><span class="etiquette">Séjour</span><span class="valeur">${echapper(
                details.sejour,
              )}</span></p>`
            : ""
        }
        ${
          details.total
            ? `<p class="ligne"><span class="etiquette">Total annoncé</span><span class="valeur">${echapper(
                details.total,
              )}</span></p>`
            : ""
        }
      </div>${blocLien}
      <div class="notice">
        <p class="notice-text">${blocPaiement}</p>
      </div>${blocSuite}${blocIdentifiants}
    </div>
    <div class="footer">
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} Teranga Way. L'hospitalité en toute confiance.</p>
    </div>
  </div>
</body>
</html>`;

  return { sujet, html, texte: lignesTexte.join("\n") };
}
