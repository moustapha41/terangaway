import { PrismaClient } from "@prisma/client";
import { DEMANDES, JETONS, PARTENAIRES } from "@teranga/fixtures";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

function sha256(valeur: string): string {
  return createHash("sha256").update(valeur).digest("hex");
}

async function main() {
  console.log("🌱 Début de l'initialisation des fixtures de développement Teranga...");

  // 1. Comptes de démonstration
  const visiteurDemo = await prisma.account.upsert({
    where: { id: "visiteur-demo" },
    update: {},
    create: {
      id: "visiteur-demo",
      telephone: "770000000",
      email: "visiteur@demo.teranga.sn",
      nom: "Awa Diop",
      role: "VISITEUR",
      typeCompte: "VISITEUR",
      estVerifie: true,
      verifieLe: new Date(),
    },
  });

  const prestataireDemo = await prisma.account.upsert({
    where: { id: "prestataire-demo" },
    update: {},
    create: {
      id: "prestataire-demo",
      telephone: "771234567",
      email: "prestataire@demo.teranga.sn",
      nom: "Moussa Ndiaye",
      role: "PRESTATAIRE",
      typeCompte: "LES_DEUX",
      estVerifie: true,
      verifieLe: new Date(),
    },
  });

  const comptePartenaireCollecte = await prisma.account.upsert({
    where: { id: PARTENAIRES.terangaWay.id },
    update: {},
    create: {
      id: PARTENAIRES.terangaWay.id,
      telephone: "778889900",
      email: "partenaire@teranga.sn",
      nom: PARTENAIRES.terangaWay.nomAffiche,
      role: "PRESTATAIRE",
      typeCompte: "LES_DEUX",
      estVerifie: true,
      verifieLe: new Date(PARTENAIRES.terangaWay.verifieLe),
    },
  });

  // Comptes d'équipe : les adresses de `ADMIN_EMAILS`, et rien d'autre.
  //
  // Le backoffice ne se déverrouille pas tout seul : sans cette variable,
  // aucun compte administrateur n'existe, et la porte reste fermée. Un compte
  // déjà présent est promu plutôt que recréé — une personne peut très bien
  // avoir d'abord été visiteuse.
  const adresses = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);

  // Retirer les droits de quiconque n'est plus dans la liste. Sans cela,
  // enlever une adresse de `ADMIN_EMAILS` ne fermait aucune porte : le compte
  // restait administrateur en base, et personne ne s'en apercevait. La liste
  // décide des deux sens, sinon elle ne décide de rien.
  const retires = await prisma.account.updateMany({
    where: { role: "ADMINISTRATEUR", email: { notIn: adresses } },
    data: { role: "VISITEUR" },
  });
  if (retires.count > 0) {
    console.log(`✓ ${retires.count} compte(s) ne figurant plus dans ADMIN_EMAILS repassé(s) visiteur`);
  }

  for (const email of adresses) {
    await prisma.account.upsert({
      where: { email },
      update: { role: "ADMINISTRATEUR", estVerifie: true, verifieLe: new Date() },
      create: {
        email,
        nom: "Équipe Teranga",
        role: "ADMINISTRATEUR",
        typeCompte: "VISITEUR",
        estVerifie: true,
        verifieLe: new Date(),
      },
    });
  }

  console.log(
    adresses.length > 0
      ? `✓ Comptes créés : visiteur-demo, prestataire-demo, terangaWay, ${adresses.length} administrateur(s)`
      : "✓ Comptes créés : visiteur-demo, prestataire-demo, terangaWay (aucun administrateur : ADMIN_EMAILS est vide)",
  );

  // 2. Demandes initiales
  for (const d of DEMANDES) {
    const genre = d.offre.genre === "logement" ? "logement" : (d.offre.genre === "service" ? "service" : "location");
    const offreId = d.offre.genre === "logement" ? d.offre.logementId : (d.offre.genre === "vehicule" ? d.offre.vehiculeId : null);
    const prixUnitaire = "prixParNuit" in d.prix ? d.prix.prixParNuit : d.prix.total;
    const nuits = "nuits" in d.prix ? d.prix.nuits : 1;
    const fraisFixes = "fraisFixes" in d.prix ? d.prix.fraisFixes : [];

    await prisma.demand.upsert({
      where: { id: d.id },
      update: {
        statut: d.statut,
        coordonnees: d.coordonnees ? (d.coordonnees as any) : undefined,
      },
      create: {
        id: d.id,
        reference: d.reference,
        visiteurId: visiteurDemo.id,
        prestataireId: prestataireDemo.id,
        genre: genre as any,
        statut: d.statut as any,
        offreId,
        offreTitre: d.offre.titre,
        offreVignette: d.offre.vignette,
        dateDebut: d.dates.debut,
        dateFin: d.dates.fin,
        personnes: d.personnes,
        heureArrivee: d.heureArrivee,
        prixUnitaire,
        nuits,
        fraisFixes: fraisFixes as any,
        prixTotal: d.prix.total,
        coordonnees: d.coordonnees ? (d.coordonnees as any) : undefined,
        frise: d.frise as any,
        expireLe: d.expireLe ? new Date(d.expireLe) : null,
        motifRefus: d.motifRefus,
      },
    });
  }
  console.log(`✓ ${DEMANDES.length} demandes créées dans la base PostgreSQL`);

  // 3. Jetons de réponse partenaire (SMS)
  for (const j of JETONS) {
    const tokenHash = sha256(j.jeton);
    await prisma.providerResponseToken.upsert({
      where: { tokenHash },
      update: {
        reponse: j.reponse ?? null,
        consumedAt: j.etat === "repondu" ? new Date() : null,
      },
      create: {
        id: j.jeton,
        demandeId: j.demandeId,
        prestataireId: prestataireDemo.id,
        tokenHash,
        expiresAt: new Date(j.expireLe),
        consumedAt: j.etat === "repondu" ? new Date() : null,
        reponse: j.reponse ?? null,
      },
    });
  }
  console.log(`✓ ${JETONS.length} jetons partenaires créés avec empreinte SHA-256`);

  console.log("🚀 Initialisation réussie.");
}

main()
  .catch((e) => {
    console.error("❌ Erreur lors de l'initialisation du seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
