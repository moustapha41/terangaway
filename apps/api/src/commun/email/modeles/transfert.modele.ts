import { echapper, type ContenuEmail } from "./demande.modele";

/**
 * Le transfert depuis l'aéroport : ce que le visiteur reçoit, ce que l'équipe
 * reçoit.
 *
 * Une fois sa demande de logement partie, le visiteur répond « oui » à « voulez-
 * vous qu'on vienne vous chercher à l'aéroport ? ». Deux messages en découlent,
 * et ils disent des choses différentes :
 *
 *   à lui, la **confirmation de sa demande** : ce que nous avons noté, ce qui se
 *   passe ensuite, et ce qui ne lui coûte rien pour l'instant. Elle ne promet
 *   ni véhicule ni prix — ce n'est pas encore décidé, et le dire serait inventer ;
 *
 *   à l'équipe, **ce qu'il y a à faire** : qui, quand, où, et les trois choses
 *   qu'il manque encore — le véhicule, l'heure, le prix.
 *
 * Le numéro de vol est la donnée qui manque le plus. L'e-mail l'invite à
 * l'envoyer par WhatsApp, sur un message déjà écrit qui porte la référence :
 * l'équipe retrouve la demande sans la chercher.
 */

export interface DetailsTransfert {
  /** La référence de la demande de logement, celle que le visiteur connaît. */
  reference: string;
  /** Le logement, tel qu'il s'affiche. */
  titre: string;
  /** Le lieu où l'on dépose : « Almadies, Dakar ». */
  lieu: string;
  /** Le jour d'arrivée, déjà composé : « 1 novembre 2026 ». */
  jour: string;
  personnes: number;
}

export interface TransfertVisiteur extends DetailsTransfert {
  /** Le lien WhatsApp, message déjà écrit : la référence y figure. */
  lienWhatsapp: string;
  /** La recherche de véhicule, déjà remplie : pour qui préfère choisir lui-même. */
  lienVehicules: string;
}

export interface TransfertEquipe extends DetailsTransfert {
  contact: { nom?: string; email?: string; telephone?: string };
  /** Lien direct vers la demande dans le backoffice. */
  lien: string;
}

const STYLE = `
    body { margin: 0; padding: 0; background-color: #f8fafc; color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 28px auto; background: #ffffff; border-radius: 12px;
      overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #0f172a; padding: 24px 30px; text-align: center; }
    .brand { color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; }
    .accent { color: #f59e0b; }
    .content { padding: 30px; }
    .title { font-size: 20px; font-weight: 600; margin: 0 0 12px; }
    .text { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 18px; }
    .recap { background: #f1f5f9; border-radius: 10px; padding: 16px 20px; margin: 0 0 22px; }
    .ligne { margin: 0; font-size: 14px; line-height: 1.8; color: #334155; }
    .etiquette { display: inline-block; min-width: 100px; color: #64748b; }
    .valeur { color: #0f172a; font-weight: 600; }
    .etape { font-size: 14.5px; line-height: 1.55; color: #334155; margin: 0 0 10px; }
    .bouton { display: inline-block; background: #087443; color: #ffffff; text-decoration: none;
      font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 999px; }
    .petit { font-size: 13px; line-height: 1.55; color: #64748b; margin: 18px 0 0; }
    .petit a { color: #0f172a; }
    .footer { background: #f8fafc; padding: 16px 30px; border-top: 1px solid #e2e8f0; text-align: center;
      font-size: 12px; color: #94a3b8; }
`;

function ligne(etiquette: string, valeur: string | undefined): string {
  return valeur
    ? `<p class="ligne"><span class="etiquette">${echapper(etiquette)}</span><span class="valeur">${echapper(valeur)}</span></p>`
    : "";
}

/** L'accusé de réception du transfert, pour le visiteur. */
export function genererEmailTransfert(d: TransfertVisiteur): ContenuEmail {
  const sujet = `Votre transfert depuis l'aéroport — ${d.reference}`;
  const trajet = `Aéroport AIBD → ${d.lieu}`;

  const texte = [
    "Bonjour,",
    "",
    "Vous avez demandé qu'on vienne vous chercher à l'aéroport. Voici ce que nous avons noté :",
    "",
    `Référence : ${d.reference}`,
    `Logement : ${d.titre}`,
    `Trajet : ${trajet}`,
    `Jour d'arrivée : ${d.jour}`,
    `Voyageurs : ${d.personnes}`,
    "",
    "Et maintenant ?",
    "1. Nous vous écrivons pour confirmer le véhicule, l'heure de prise en charge et le prix.",
    "2. Pour aller plus vite, envoyez-nous votre numéro de vol et votre heure d'arrivée sur WhatsApp :",
    `   ${d.lienWhatsapp}`,
    "3. Rien n'est payé maintenant.",
    "",
    `Vous préférez choisir votre véhicule vous-même ? ${d.lienVehicules}`,
    "",
    "L'équipe Teranga Way",
    "",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${echapper(sujet)}</title>
  <style>${STYLE}</style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><p class="brand">Teranga <span class="accent">Way</span></p></div>
    <div class="content">
      <h1 class="title">Votre transfert est demandé</h1>
      <p class="text">Vous avez demandé qu'on vienne vous chercher à l'aéroport. Voici ce que nous avons noté&nbsp;:</p>
      <div class="recap">
        ${ligne("Référence", d.reference)}
        ${ligne("Logement", d.titre)}
        ${ligne("Trajet", trajet)}
        ${ligne("Jour d'arrivée", d.jour)}
        ${ligne("Voyageurs", String(d.personnes))}
      </div>

      <h2 class="title" style="font-size: 16px;">Et maintenant&nbsp;?</h2>
      <p class="etape"><strong>1.</strong> Nous vous écrivons pour confirmer <strong>le véhicule, l'heure de prise en charge et le prix</strong>.</p>
      <p class="etape"><strong>2.</strong> Pour aller plus vite, envoyez-nous votre <strong>numéro de vol</strong> et votre heure d'arrivée sur WhatsApp.</p>
      <p class="etape" style="margin-bottom: 22px;"><strong>3.</strong> <strong>Rien n'est payé maintenant.</strong></p>

      <p style="text-align: center; margin: 0 0 6px;">
        <a class="bouton" href="${echapper(d.lienWhatsapp)}">Envoyer mon numéro de vol</a>
      </p>

      <p class="petit">
        Vous préférez choisir votre véhicule vous-même&nbsp;?
        <a href="${echapper(d.lienVehicules)}">Voir les véhicules disponibles</a>.
      </p>
    </div>
    <div class="footer">&copy; ${new Date().getFullYear()} Teranga Way. L'hospitalité en toute confiance.</div>
  </div>
</body>
</html>`;

  return { sujet, html, texte };
}

/** L'alerte pour l'équipe : un transfert à organiser. */
export function genererAlerteTransfert(d: TransfertEquipe): ContenuEmail {
  const qui = d.contact.nom || d.contact.email || "Un visiteur";
  const sujet = `Transfert aéroport demandé — ${d.reference} — ${d.lieu}`;
  const trajet = `Aéroport AIBD → ${d.lieu}`;

  const texte = [
    `${qui} demande qu'on vienne le chercher à l'aéroport.`,
    "",
    `Référence : ${d.reference}`,
    `Logement : ${d.titre}`,
    `Trajet : ${trajet}`,
    `Jour d'arrivée : ${d.jour}`,
    `Voyageurs : ${d.personnes}`,
    ...(d.contact.nom ? [`Nom : ${d.contact.nom}`] : []),
    ...(d.contact.email ? [`E-mail : ${d.contact.email}`] : []),
    ...(d.contact.telephone ? [`Téléphone : ${d.contact.telephone}`] : []),
    "",
    "À faire : confirmer le véhicule, l'heure de prise en charge et le prix ; demander le numéro de vol.",
    "Le visiteur a reçu un e-mail qui lui annonce que nous le recontactons.",
    "",
    `Ouvrir la demande : ${d.lien}`,
    "",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${echapper(sujet)}</title>
  <style>${STYLE}</style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><p class="brand">Transfert aéroport · ${echapper(d.reference)}</p></div>
    <div class="content">
      <p class="text"><strong>${echapper(qui)}</strong> demande qu'on vienne le chercher à l'aéroport.</p>
      <div class="recap">
        ${ligne("Référence", d.reference)}
        ${ligne("Logement", d.titre)}
        ${ligne("Trajet", trajet)}
        ${ligne("Jour d'arrivée", d.jour)}
        ${ligne("Voyageurs", String(d.personnes))}
        ${ligne("Nom", d.contact.nom)}
        ${ligne("E-mail", d.contact.email)}
        ${ligne("Téléphone", d.contact.telephone)}
      </div>
      <p class="text"><strong>À faire&nbsp;:</strong> confirmer le véhicule, l'heure de prise en charge et le prix&nbsp;; demander le numéro de vol. Le visiteur a reçu un e-mail qui lui annonce que nous le recontactons.</p>
      <p style="margin: 0;"><a class="bouton" style="background: #0f172a;" href="${echapper(d.lien)}">Ouvrir la demande</a></p>
    </div>
    <div class="footer">Teranga Way · alerte interne.</div>
  </div>
</body>
</html>`;

  return { sujet, html, texte };
}
