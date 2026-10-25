import type { Metadata } from "next";
import { Bandeau, Bouton, Carte, Icone } from "@teranga/ui";
import { repondre } from "@/features/partenaire/actions";
import { dureeRestante, formaterPlage } from "@/lib/dates";
import { formaterPrix } from "@/lib/prix";
import { ouvrirJeton, type DemandePourPartenaire } from "@/mocks/api";
import { ASSISTANCE } from "@/lib/assistance";

/**
 * Page de réponse du partenaire (PAR-11/12), ouverte depuis un SMS.
 *
 * Trois choses la gouvernent :
 *   aucun compte, aucun mot de passe — le jeton est le seul sésame ;
 *   aucune donnée du visiteur — nom, téléphone et message n'arrivent qu'après
 *     la confirmation (§B.4, étape 4) ;
 *   aucune dépendance au JavaScript — le partenaire répond depuis le téléphone
 *     qu'il a, parfois en 2G.
 *
 * Elle est en français : les partenaires sont sénégalais, et la langue du
 * visiteur n'a rien à voir avec la leur. À confirmer si des partenaires
 * anglophones rejoignent la plateforme.
 */
const LANGUE = "fr" as const;

export const metadata: Metadata = {
  title: "Teranga Way — Répondre à une demande",
  // Un lien de SMS ne doit pas finir dans un moteur de recherche.
  robots: { index: false, follow: false },
};

const MOTIFS = [
  { valeur: "dates-impossibles", libelle: "Les dates ne sont pas possibles" },
  { valeur: "capacite", libelle: "Trop de personnes pour ce bien" },
  { valeur: "autre", libelle: "Autre raison" },
] as const;

export default async function Reponse({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const vue = await ouvrirJeton(jeton);

  if (!vue || vue.etat !== "valide" || !vue.demande) {
    return <Close reponse={vue?.reponse} />;
  }

  return (
    <main className="mx-auto w-[92%] max-w-[560px] py-8">
      <Entete />

      <p className="mt-6 text-petit text-encre-douce chiffres-tabulaires">
        Demande {vue.demande.reference}
      </p>
      <h1 className="mt-1 text-titre-1 text-encre">Une demande vous attend</h1>

      <Delai expireLe={vue.demande.expireLe} />

      <Details demande={vue.demande} />

      <Bandeau variante="information" className="mt-5">
        Ne demandez et n'encaissez jamais d'acompte vous-même. Si un acompte est dû, Teranga Way
        le demande au visiteur avec ses propres coordonnées et en vérifie la réception : c'est
        l'un des engagements de la charte.
      </Bandeau>

      <div className="mt-8 space-y-3">
        <form action={repondre}>
          <input type="hidden" name="jeton" value={jeton} />
          <input type="hidden" name="reponse" value="acceptee" />
          <Bouton type="submit" variante="confirmation" largeur="pleine">
            Accepter cette demande
          </Bouton>
        </form>

        <form action={repondre}>
          <input type="hidden" name="jeton" value={jeton} />
          <input type="hidden" name="reponse" value="indisponible" />
          <Bouton type="submit" variante="secondaire" largeur="pleine">
            Ce bien n'est plus disponible
          </Bouton>
        </form>

        {/* `<details>` plutôt qu'une feuille basse : le motif doit pouvoir se
            choisir sans JavaScript. */}
        <details className="rounded-control border border-contour bg-surface">
          <summary className="flex min-h-[var(--size-control)] cursor-pointer list-none items-center justify-between px-4 text-bouton text-danger">
            Refuser cette demande
            <Icone nom="chevron" taille={20} />
          </summary>

          <form action={repondre} className="space-y-4 border-t border-contour p-4">
            <input type="hidden" name="jeton" value={jeton} />
            <input type="hidden" name="reponse" value="refusee" />

            <fieldset>
              <legend className="mb-2 text-petit text-encre">Pourquoi refusez-vous ?</legend>
              {MOTIFS.map((motif, i) => (
                <label
                  key={motif.valeur}
                  className="flex min-h-[var(--size-touch)] items-center gap-3 text-corps text-encre"
                >
                  <input
                    type="radio"
                    name="motif"
                    value={motif.valeur}
                    defaultChecked={i === 0}
                    className="h-5 w-5 accent-[var(--color-primaire)]"
                  />
                  {motif.libelle}
                </label>
              ))}
            </fieldset>

            <Bouton type="submit" variante="danger" largeur="pleine">
              Envoyer mon refus
            </Bouton>
          </form>
        </details>
      </div>

      <Aide />
    </main>
  );
}

function Entete() {
  return (
    <p className="text-petit font-semibold uppercase tracking-widest text-encre-douce">
      Teranga Way
    </p>
  );
}

/** Le délai est l'information la plus urgente : il passe avant le détail. */
function Delai({ expireLe }: { expireLe: string }) {
  const echeance = new Date(expireLe);
  const minutes = Math.round((echeance.getTime() - Date.now()) / 60000);
  const presse = minutes <= 30;

  return (
    <div className="mt-4">
      <Bandeau variante={presse ? "avertissement" : "information"}>
        Merci de répondre {dureeRestante(echeance, LANGUE)}. Passé ce délai, la
        demande est proposée à un autre partenaire.
      </Bandeau>
    </div>
  );
}

function Details({ demande }: { demande: DemandePourPartenaire }) {
  return (
    <Carte className="mt-5 p-5">
      <p className="text-titre-3 text-encre">{demande.titre}</p>

      <dl className="mt-4 space-y-2 border-t border-contour pt-4">
        <Ligne terme="Dates">
          {formaterPlage(new Date(demande.dates.debut), new Date(demande.dates.fin), LANGUE)}
        </Ligne>
        <Ligne terme="Personnes">{demande.personnes}</Ligne>
        {demande.heureArrivee && <Ligne terme="Arrivée prévue">{demande.heureArrivee}</Ligne>}
      </dl>

      <p className="mt-4 flex items-baseline justify-between border-t border-contour pt-4 text-prix text-encre chiffres-tabulaires">
        <span className="text-corps font-normal text-encre-douce">Montant du séjour</span>
        {formaterPrix(demande.total, LANGUE)}
      </p>

      <p className="mt-3 text-legende text-encre-douce">
        Vous recevrez le nom, le numéro et l'heure d'arrivée du visiteur dès qu'il
        aura confirmé.
      </p>
    </Carte>
  );
}

/** Lien déjà utilisé ou expiré : la demande est close, et on donne le numéro (§B.8). */
function Close({ reponse }: { reponse?: "acceptee" | "refusee" | "indisponible" }) {
  const dit =
    reponse === "acceptee"
      ? "Vous avez accepté cette demande."
      : reponse === "indisponible"
        ? "Vous avez signalé que ce bien n'était plus disponible."
        : reponse === "refusee"
          ? "Vous avez refusé cette demande."
          : null;

  return (
    <main className="mx-auto w-[92%] max-w-[560px] py-16 text-center">
      <Entete />

      <span className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-pill bg-champ text-encre-douce">
        <Icone nom="horloge" taille={32} />
      </span>

      <h1 className="mt-5 text-titre-1 text-encre">Cette demande est close</h1>

      <p className="mx-auto mt-3 max-w-[42ch] text-corps text-encre-douce">
        {dit ?? "Ce lien a expiré ou a déjà servi."} Il n'y a plus rien à faire ici.
      </p>

      <Aide />
    </main>
  );
}

function Aide() {
  return (
    <p className="mt-8 text-center text-petit text-encre-douce">
      Une question ? Appelez l'équipe au{" "}
      <a
        href={`tel:${ASSISTANCE.telephone.replace(/\s/g, "")}`}
        className="font-semibold text-primaire underline underline-offset-2"
      >
        {ASSISTANCE.telephone}
      </a>
      .
    </p>
  );
}

function Ligne({ terme, children }: { terme: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-petit text-encre-douce">{terme}</dt>
      <dd className="text-petit text-encre chiffres-tabulaires">{children}</dd>
    </div>
  );
}
