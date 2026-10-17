"use client";

/**
 * Atelier — chaque composant de @teranga/ui dans tous ses états.
 *
 * Le dossier de conception est net (§C.3) : un composant est dessiné dans tous ses
 * états **avant** d'être utilisé dans un écran. Cette page est l'endroit où on le
 * vérifie. Elle ne fait pas partie du produit et n'est pas traduite.
 */

import { useState } from "react";
import { STATUTS, type Statut } from "@teranga/tokens";
import {
  Bandeau,
  ChampCode,
  FeuilleBasse,
  FriseStatut,
  SelecteurDates,
  SelecteurLieu,
  type Plage,
  BadgeStatut,
  BadgeVerifie,
  Bouton,
  Carte,
  Champ,
  Compteur,
  Lien,
  Onglets,
  PuceFiltre,
  Squelette,
  type VarianteBandeau,
} from "@teranga/ui";

const VARIANTES_BOUTON = ["principal", "secondaire", "confirmation", "danger"] as const;
const VARIANTES_BANDEAU: VarianteBandeau[] = [
  "information",
  "succes",
  "avertissement",
  "erreur",
  "hors-connexion",
];

export default function Atelier() {
  const [onglet, setOnglet] = useState<"logements" | "transports">("logements");
  const [voyageurs, setVoyageurs] = useState(2);
  const [filtres, setFiltres] = useState<string[]>(["Climatisation"]);
  const [code, setCode] = useState("12");
  const [feuille, setFeuille] = useState(false);
  const [lieu, setLieu] = useState("Aéroport AIBD");
  const [plage, setPlage] = useState<Plage>({});

  const basculer = (f: string) =>
    setFiltres((liste) => (liste.includes(f) ? liste.filter((x) => x !== f) : [...liste, f]));

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-12">
      <header className="mb-12">
        <p className="text-petit font-semibold uppercase tracking-widest text-encre-douce">
          Teranga Way
        </p>
        <h1 className="mt-1 text-titre-1 text-encre">Atelier des composants</h1>
        <p className="mt-2 max-w-[60ch] text-corps text-encre-douce">
          Les jetons viennent de <code>@teranga/tokens</code>. Chaque composant est montré
          dans tous les états que le dossier de conception lui donne.
        </p>
      </header>

      <Section titre="Bouton" rappel="Normal, appuyé, désactivé, en cours. La largeur n'est jamais fixe ; le libellé peut passer sur deux lignes.">
        {VARIANTES_BOUTON.map((variante) => (
          <div key={variante} className="flex flex-wrap items-start gap-3">
            <Etiquette>{variante}</Etiquette>
            <Bouton variante={variante} largeur="contenu">Demander ce logement</Bouton>
            <Bouton variante={variante} largeur="contenu" icone="recherche">Rechercher</Bouton>
            <Bouton variante={variante} largeur="contenu" disabled>Désactivé</Bouton>
            <Bouton variante={variante} largeur="contenu" enCours>Envoi en cours</Bouton>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Etiquette>lien</Etiquette>
          <Lien href="#">Modifier ma recherche</Lien>
        </div>
      </Section>

      <Section titre="Champ de texte" rappel="Vide, rempli, actif, erreur, désactivé. L'erreur est écrite sous le champ, pas seulement signalée en rouge.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Champ libelle="Destination" placeholder="Dakar" icone="repere" />
          <Champ libelle="Destination" defaultValue="Dakar, Almadies" icone="repere" />
          <Champ
            libelle="Dates"
            defaultValue="12 janv. – 26 janv. 2026"
            icone="calendrier"
            tabulaire
            aide="Deux semaines pendant les Jeux"
          />
          <Champ
            libelle="Téléphone"
            defaultValue="77 000 00"
            icone="telephone"
            erreur="Ce numéro compte 8 chiffres, il en faut 9."
          />
          <Champ libelle="Numéro de vol" placeholder="SN 1234" icone="avion" disabled />
        </div>
      </Section>

      <Section titre="Onglets" rappel="Une seule étape de recherche change entre logement et transport. Flèches gauche et droite au clavier.">
        <Onglets
          etiquette="Type de service"
          actif={onglet}
          onChange={setOnglet}
          onglets={[
            { cle: "logements", libelle: "Logements", icone: "logement" },
            { cle: "transports", libelle: "Transports", icone: "voiture" },
          ]}
        />
      </Section>

      <Section titre="Puce de filtre" rappel="Inactive ou active. Zone cliquable de 44 px, espacée de 8 px de sa voisine.">
        <div className="flex flex-wrap gap-2">
          {["Climatisation", "Wi-Fi", "Moins de 50 000 FCFA", "Proche d'un site"].map((f) => (
            <PuceFiltre key={f} libelle={f} active={filtres.includes(f)} onClick={() => basculer(f)} />
          ))}
        </div>
      </Section>

      <Section titre="Compteur" rappel="Minimum atteint, maximum atteint. La valeur est annoncée à chaque changement.">
        <div className="max-w-[320px] space-y-3">
          <Compteur libelle="Voyageurs" valeur={voyageurs} min={1} max={8} onChange={setVoyageurs} />
          <Compteur libelle="Minimum atteint" valeur={1} min={1} max={8} onChange={() => {}} />
          <Compteur libelle="Maximum atteint" valeur={8} min={1} max={8} onChange={() => {}} />
        </div>
      </Section>

      <Section titre="Sélecteur de lieu" rappel="Vide, suggestions, choisi. Bâti sur <datalist> : la liste, le filtrage et la saisie libre viennent du navigateur.">
        <div className="max-w-[360px]">
          <SelecteurLieu
            libelle="Départ"
            nom="depart-demo"
            valeur={lieu}
            onChange={setLieu}
            placeholder="Lieu, quartier ou site"
            lieux={[
              { valeur: "Aéroport AIBD", detail: "Aéroport international Blaise-Diagne" },
              { valeur: "Stade Abdoulaye-Wade", detail: "Diamniadio" },
              { valeur: "Plateau", detail: "Dakar" },
              { valeur: "Almadies", detail: "Dakar" },
            ]}
          />
        </div>
      </Section>

      <Section titre="Sélecteur de dates" rappel="Fermé, ouvert, plage choisie. Les dates indisponibles sont grisées et barrées : la couleur seule ne suffit pas.">
        <div className="max-w-[360px]">
          <SelecteurDates
            libelle="Dates du séjour"
            plage={plage}
            onChange={setPlage}
            indisponibles={["2026-10-28", "2026-10-29", "2026-10-30"]}
            etiquettes={{
              ouvrir: "Choisir les dates",
              titre: "Choisir les dates",
              fermer: "Fermer",
              moisPrecedent: "Mois précédent",
              moisSuivant: "Mois suivant",
              valider: "Valider",
              effacer: "Effacer",
              jours: ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"],
              nomMois: (annee, mois) =>
                new Intl.DateTimeFormat("fr", { month: "long", year: "numeric" }).format(new Date(annee, mois, 1)),
              dateComplete: (iso) =>
                new Intl.DateTimeFormat("fr", { dateStyle: "full" }).format(new Date(`${iso}T00:00:00`)),
              vide: "Choisir les dates",
              resume: (p) => [p.debut, p.fin].filter(Boolean).join(" – "),
              etapeDebut: "Choisissez d'abord la date de début",
              etapeFin: "Maintenant la date de fin",
              etapeComplete: "Votre période est choisie. Un nouveau clic la recommence.",
              debut: "Début",
              fin: "Fin",
              nuits: (nombre) => `${nombre} ${nombre > 1 ? "nuits" : "nuit"}`,
            }}
          />
        </div>
      </Section>

      <Section titre="Champ de code" rappel="Vide, erreur, expiré, vérification. Le collage des six chiffres est traité : c'est le geste naturel quand le code arrive par SMS.">
        <div className="flex flex-wrap gap-8">
          <ChampCode libelle="Code à six chiffres" valeur={code} onChange={setCode} />
          <ChampCode
            libelle="Erreur"
            valeur="1234"
            onChange={() => {}}
            etat="erreur"
            message="Ce code ne correspond pas. Vérifiez les six chiffres."
          />
          <ChampCode
            libelle="Expiré"
            valeur=""
            onChange={() => {}}
            etat="expire"
            message="Ce code a expiré. Demandez-en un nouveau."
          />
          <ChampCode libelle="Vérification" valeur="123456" onChange={() => {}} etat="verification" />
        </div>
      </Section>

      <Section titre="Feuille basse" rappel="Monte du bas, poignée, bouton de fermeture. Bâtie sur <dialog> : le piège au clavier et la fermeture par Échap viennent du navigateur.">
        <Bouton variante="secondaire" largeur="contenu" onClick={() => setFeuille(true)}>
          Ouvrir la feuille
        </Bouton>
        <FeuilleBasse
          ouverte={feuille}
          onFermer={() => setFeuille(false)}
          titre="Confirmez votre numéro"
          etiquetteFermer="Fermer"
        >
          <div className="space-y-5">
            <p className="text-corps text-encre-douce">
              Nous avons envoyé un code à six chiffres. Saisissez-le pour envoyer votre demande.
            </p>
            <ChampCode libelle="Code à six chiffres" valeur={code} onChange={setCode} />
            <Bouton variante="principal" largeur="pleine" onClick={() => setFeuille(false)}>
              Envoyer la demande
            </Bouton>
          </div>
        </FeuilleBasse>
      </Section>

      <Section titre="Badges" rappel="Le badge vérifié est bleu nuit, jamais vert : il parle de confiance, pas d'un statut. Chaque statut porte une icône et un mot.">
        <div className="flex flex-wrap items-center gap-3">
          <BadgeVerifie libelle="Vérifié" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(Object.keys(STATUTS) as Statut[]).map((s) => (
            <BadgeStatut key={s} statut={s} libelle={STATUTS[s].libelle} />
          ))}
        </div>
      </Section>

      <Section titre="Frise de statut" rappel="Étapes verticales horodatées, l'étape en cours mise en avant. Une demande refusée ne montre pas les étapes qui n'arriveront plus.">
        <div className="grid gap-10 sm:grid-cols-2">
          <FriseStatut
            etapes={[
              { statut: "envoyee", libelle: STATUTS.envoyee.libelle, horodatage: "10 oct. 2026 · 05:11", etat: "faite" },
              { statut: "acceptee", libelle: STATUTS.acceptee.libelle, horodatage: "10 oct. 2026 · 06:11", etat: "faite" },
              { statut: "confirmee", libelle: STATUTS.confirmee.libelle, horodatage: "10 oct. 2026 · 07:11", etat: "en-cours" },
              { statut: "terminee", libelle: STATUTS.terminee.libelle, etat: "a-venir" },
            ]}
          />
          <FriseStatut
            etapes={[
              { statut: "envoyee", libelle: STATUTS.envoyee.libelle, horodatage: "8 oct. 2026 · 14:02", etat: "faite" },
              { statut: "refusee", libelle: STATUTS.refusee.libelle, horodatage: "8 oct. 2026 · 15:40", etat: "en-cours" },
            ]}
          />
        </div>
      </Section>

      <Section titre="Bandeau" rappel="Cinq variantes. Hors connexion s'accompagne de la désactivation de l'envoi.">
        <div className="space-y-3">
          <Bandeau variante="information">
            Les coordonnées du partenaire apparaissent après votre confirmation.
          </Bandeau>
          <Bandeau variante="succes" action={<Lien href="#" className="shrink-0 text-petit">Voir ma demande</Lien>}>
            Votre demande est envoyée. Le partenaire répond en général en moins d'une heure.
          </Bandeau>
          <Bandeau variante="avertissement">
            Cette demande expire dans 2 heures si le partenaire ne répond pas.
          </Bandeau>
          <Bandeau variante="erreur" action={<Lien href="#" className="shrink-0 text-petit">Réessayer</Lien>}>
            Un problème est survenu de notre côté. Votre saisie est conservée.
          </Bandeau>
          <Bandeau variante="hors-connexion">
            Vous êtes hors connexion. L'envoi reprendra au retour du réseau.
          </Bandeau>
        </div>
        <p className="text-petit text-encre-douce">
          {VARIANTES_BANDEAU.length} variantes, conformes au §C.3.
        </p>
      </Section>

      <Section titre="Carte et squelette" rappel="La séparation se fait par la bordure et l'espace. Le squelette prend la forme de ce qu'il remplace.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Carte>
            <div className="aspect-[4/3] bg-champ" />
            <div className="space-y-2 p-4">
              <BadgeVerifie libelle="Vérifié" />
              <p className="text-titre-3 text-encre">Résidence des Almadies</p>
              <p className="text-petit text-encre-douce">Almadies · 4 personnes · 2 chambres</p>
              <p className="text-prix text-encre chiffres-tabulaires">
                75 000 FCFA <span className="text-petit font-normal text-encre-douce">/ nuit</span>
              </p>
            </div>
          </Carte>
          <Carte>
            <Squelette className="aspect-[4/3] rounded-none" />
            <div className="space-y-2 p-4">
              <Squelette className="h-5 w-20 rounded-pill" />
              <Squelette className="h-6 w-3/4" />
              <Squelette className="h-4 w-1/2" />
              <Squelette className="h-6 w-2/5" />
            </div>
          </Carte>
        </div>
      </Section>

      <Section titre="Typographie" rappel="Les huit styles du dossier, dans la police hébergée chez nous.">
        <div className="space-y-2">
          <p className="text-titre-1 text-encre">Titre 1 — 24 / 32 SemiBold</p>
          <p className="text-titre-2 text-encre">Titre 2 — 20 / 28 SemiBold</p>
          <p className="text-titre-3 text-encre">Titre 3 — 17 / 24 SemiBold</p>
          <p className="text-corps text-encre">Corps — 16 / 24 Regular, texte courant et champs</p>
          <p className="text-petit text-encre-douce">Petit — 14 / 20 Regular, détails de carte</p>
          <p className="text-legende text-encre-douce">Légende — 12 / 16, taille minimale de l'interface</p>
          <p className="text-prix text-encre chiffres-tabulaires">Prix — 300 000 FCFA pour 4 nuits</p>
        </div>
      </Section>
    </main>
  );
}

function Section({
  titre,
  rappel,
  children,
}: {
  titre: string;
  rappel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12 border-t border-contour pt-6">
      <h2 className="text-titre-2 text-encre">{titre}</h2>
      <p className="mt-1 mb-5 max-w-[70ch] text-petit text-encre-douce">{rappel}</p>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Etiquette({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-28 shrink-0 pt-3 text-legende uppercase tracking-wider text-encre-douce">
      {children}
    </span>
  );
}
