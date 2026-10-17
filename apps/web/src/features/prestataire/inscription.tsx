"use client";

import { useState } from "react";
import { CATEGORIES_VEHICULE, TYPES_LOGEMENT } from "@teranga/contracts";
import { Bandeau, Bouton, Carte, Champ, Icone } from "@teranga/ui";
import { IndicateurEtapes } from "@/features/demande/indicateur-etapes";
import { useT } from "@/lib/i18n/contexte";
import { useNaviguer } from "@/lib/i18n/naviguer";

type TypeCompte = "logement" | "transport" | "les-deux";

/**
 * Création de compte prestataire en cinq étapes — maquette du collage, écrans 2 à 4.
 *
 * L'étape 3 **ne téléverse rien**. La maquette y place quatre zones de dépôt
 * pour la pièce d'identité, le registre de commerce et le justificatif
 * d'adresse ; le cahier des charges l'interdit : ces pièces restent hors
 * plateforme, dans un espace réservé aux valideurs. L'étape existe donc, elle
 * annonce ce qui sera demandé et explique par quel canal — c'est la seule
 * lecture qui respecte les deux.
 *
 * Rien n'est perdu entre les étapes : revenir en arrière garde toute la saisie.
 */
// Le taxi a été retiré de la plateforme : un partenaire ne peut plus le
// déclarer, puisque plus aucun écran ne le propose au visiteur.
const PRESTATIONS_TRANSPORT = ["trajet", "location"] as const;

export function Inscription() {
  const t = useT();
  const naviguer = useNaviguer();

  const [etape, setEtape] = useState(1);
  const [type, setType] = useState<TypeCompte>("logement");
  const [etablissement, setEtablissement] = useState("");
  const [responsable, setResponsable] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [conditions, setConditions] = useState(false);
  const [logements, setLogements] = useState<string[]>([]);
  const [transports, setTransports] = useState<string[]>([]);
  const [ville, setVille] = useState("Dakar");
  const [erreurs, setErreurs] = useState<Record<string, boolean>>({});

  const etapes = [
    t("prestataire.etape1"),
    t("prestataire.etape2"),
    t("prestataire.etape3"),
    t("prestataire.etape4"),
    t("prestataire.etape5"),
  ];

  const faitLogement = type === "logement" || type === "les-deux";
  const faitTransport = type === "transport" || type === "les-deux";

  const basculer = (liste: string[], valeur: string, poser: (v: string[]) => void) =>
    poser(liste.includes(valeur) ? liste.filter((x) => x !== valeur) : [...liste, valeur]);

  function valider1() {
    const manques = {
      etablissement: etablissement.trim().length < 2,
      responsable: responsable.trim().length < 2,
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      telephone: telephone.replace(/\D/g, "").length < 6,
      conditions: !conditions,
    };
    setErreurs(manques);
    if (!Object.values(manques).some(Boolean)) setEtape(2);
  }

  function valider2() {
    const vide = faitLogement && logements.length === 0 && faitTransport && transports.length === 0;
    const manque =
      (faitLogement && !faitTransport && logements.length === 0) ||
      (faitTransport && !faitLogement && transports.length === 0) ||
      vide;
    setErreurs({ prestations: manque });
    if (!manque) setEtape(3);
  }

  return (
    <div className="space-y-7">
      <IndicateurEtapes
        etapes={etapes}
        courante={etape}
        resume={t("prestataire.etapeSur", { index: etape, total: 5 })}
      />

      {etape === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            valider1();
          }}
          className="space-y-6"
        >
          <div>
            <h2 className="text-titre-2 text-encre">{t("prestataire.etape1")}</h2>
            <p className="mt-1 text-corps text-encre-douce">{t("prestataire.etape1Texte")}</p>
          </div>

          <fieldset>
            <legend className="mb-2 text-petit text-encre">{t("prestataire.typeCompte")}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["logement", "transport", "les-deux"] as const).map((choix) => (
                <button
                  key={choix}
                  type="button"
                  aria-pressed={type === choix}
                  onClick={() => setType(choix)}
                  className={
                    "flex min-h-[var(--size-control)] items-center justify-center gap-2 rounded-control border px-3 text-petit font-semibold " +
                    (type === choix
                      ? "border-primaire bg-primaire text-white"
                      : "border-contour-champ bg-surface text-encre hover:border-primaire/40")
                  }
                >
                  <Icone
                    nom={choix === "transport" ? "voiture" : choix === "logement" ? "logement" : "tri"}
                    taille={20}
                  />
                  {t(
                    choix === "les-deux"
                      ? "prestataire.typeLesDeux"
                      : choix === "logement"
                        ? "prestataire.typeLogement"
                        : "prestataire.typeTransport",
                  )}
                </button>
              ))}
            </div>
          </fieldset>

          <Champ
            libelle={t("prestataire.champEtablissement")}
            aide={t("prestataire.champEtablissementAide")}
            value={etablissement}
            onChange={(e) => setEtablissement(e.target.value)}
            erreur={erreurs.etablissement ? t("prestataire.etablissementRequis") : undefined}
          />
          <Champ
            libelle={t("prestataire.champResponsable")}
            autoComplete="name"
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            erreur={erreurs.responsable ? t("prestataire.responsableRequis") : undefined}
          />
          <Champ
            libelle={t("prestataire.email")}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            erreur={erreurs.email ? t("compte.identifiantErreur") : undefined}
          />
          <Champ
            libelle={t("prestataire.telephone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            tabulaire
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            erreur={erreurs.telephone ? t("demande.telephoneRequis") : undefined}
          />

          <div>
            <label className="flex min-h-[var(--size-touch)] items-start gap-3 text-petit text-encre">
              <input
                type="checkbox"
                checked={conditions}
                onChange={(e) => setConditions(e.target.checked)}
                aria-invalid={erreurs.conditions || undefined}
                className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-primaire)]"
              />
              {t("prestataire.accepteConditions")}
            </label>
            {erreurs.conditions && (
              <p className="mt-1 text-petit text-danger">{t("prestataire.conditionsRequises")}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <Bouton type="submit" variante="principal" largeur="pleine">
              {t("prestataire.continuer")}
            </Bouton>
            <Bouton variante="secondaire" largeur="pleine" onClick={() => naviguer("/fr")}>
              {t("prestataire.annuler")}
            </Bouton>
          </div>
        </form>
      )}

      {etape === 2 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            valider2();
          }}
          className="space-y-6"
        >
          <div>
            <h2 className="text-titre-2 text-encre">{t("prestataire.etape2")}</h2>
            <p className="mt-1 text-corps text-encre-douce">{t("prestataire.etape2Texte")}</p>
          </div>

          {faitLogement && (
            <fieldset>
              <legend className="mb-2 text-petit text-encre">
                {t("prestataire.quelsLogements")}
              </legend>
              <div className="flex flex-wrap gap-2">
                {TYPES_LOGEMENT.map((type) => (
                  <Puce
                    key={type}
                    libelle={t(`typeLogement.${type}`)}
                    actif={logements.includes(type)}
                    onClick={() => basculer(logements, type, setLogements)}
                  />
                ))}
              </div>
            </fieldset>
          )}

          {faitTransport && (
            <fieldset>
              <legend className="mb-2 text-petit text-encre">
                {t("prestataire.quelsTransports")}
              </legend>
              <div className="flex flex-wrap gap-2">
                {PRESTATIONS_TRANSPORT.map((p) => (
                  <Puce
                    key={p}
                    libelle={t(`transport.${p}Titre`)}
                    actif={transports.includes(p)}
                    onClick={() => basculer(transports, p, setTransports)}
                  />
                ))}
                {CATEGORIES_VEHICULE.map((c) => (
                  <Puce
                    key={c}
                    libelle={t(`categorieVehicule.${c}`)}
                    actif={transports.includes(c)}
                    onClick={() => basculer(transports, c, setTransports)}
                  />
                ))}
              </div>
            </fieldset>
          )}

          {erreurs.prestations && (
            <p className="text-petit text-danger">{t("prestataire.choisirAuMoinsUn")}</p>
          )}

          <Champ
            libelle={t("prestataire.villeActivite")}
            icone="repere"
            value={ville}
            onChange={(e) => setVille(e.target.value)}
          />

          <Navigation
            t={t}
            onPrecedent={() => setEtape(1)}
            suivant={<Bouton type="submit" variante="principal" largeur="pleine">{t("prestataire.continuer")}</Bouton>}
          />
        </form>
      )}

      {etape === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-titre-2 text-encre">{t("prestataire.etape3")}</h2>
            <p className="mt-1 text-corps text-encre-douce">{t("prestataire.etape3Texte")}</p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {["docIdentite", "docRegistre", "docAdresse", "docPhotos"].map((doc) => (
              <li key={doc}>
                <Carte className="h-full p-4">
                  <p className="flex items-start gap-2 text-petit font-semibold text-encre">
                    <Icone nom="verification" taille={20} className="mt-0.5 shrink-0 text-encre-douce" />
                    {t(`prestataire.${doc}`)}
                  </p>
                  <p className="mt-1 pl-7 text-legende text-encre-douce">
                    {t(`prestataire.${doc}Texte`)}
                  </p>
                </Carte>
              </li>
            ))}
          </ul>

          <Carte className="p-5">
            <h3 className="text-titre-3 text-encre">{t("prestataire.docHorsPlateforme")}</h3>
            <p className="mt-2 text-corps text-encre-douce">
              {t("prestataire.docHorsPlateformeTexte")}
            </p>
          </Carte>

          <Bandeau variante="information">{t("prestataire.docCommentTransmettre")}</Bandeau>

          <Navigation
            t={t}
            onPrecedent={() => setEtape(2)}
            suivant={
              <Bouton variante="principal" largeur="pleine" onClick={() => setEtape(4)}>
                {t("prestataire.continuer")}
              </Bouton>
            }
          />
        </div>
      )}

      {etape === 4 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-titre-2 text-encre">{t("prestataire.etape4")}</h2>
            <p className="mt-1 text-corps text-encre-douce">{t("prestataire.etape4Texte")}</p>
          </div>

          <Carte>
            <dl className="divide-y divide-contour">
              <Ligne terme={t("prestataire.recapType")}>
                {t(
                  type === "les-deux"
                    ? "prestataire.typeLesDeux"
                    : type === "logement"
                      ? "prestataire.typeLogement"
                      : "prestataire.typeTransport",
                )}
              </Ligne>
              <Ligne terme={t("prestataire.recapEtablissement")}>{etablissement}</Ligne>
              <Ligne terme={t("prestataire.recapResponsable")}>{responsable}</Ligne>
              <Ligne terme={t("prestataire.recapContact")}>
                {email} · <span className="chiffres-tabulaires">{telephone}</span>
              </Ligne>
              <Ligne terme={t("prestataire.recapPrestations")}>
                {[...logements.map((l) => t(`typeLogement.${l}`)), ...transports].join(", ") || "—"}
              </Ligne>
              <Ligne terme={t("prestataire.recapVille")}>{ville}</Ligne>
            </dl>
          </Carte>

          <Bandeau variante="avertissement">{t("prestataire.rappelAcompte")}</Bandeau>

          <Navigation
            t={t}
            onPrecedent={() => setEtape(3)}
            suivant={
              <Bouton variante="principal" largeur="pleine" onClick={() => setEtape(5)}>
                {t("prestataire.envoyerCandidature")}
              </Bouton>
            }
          />
        </div>
      )}

      {etape === 5 && <Confirmation t={t} />}
    </div>
  );
}

function Confirmation({ t }: { t: (cle: string) => string }) {
  return (
    <div className="text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-pill bg-teinte-vert text-succes">
        <Icone nom="coche-cercle" taille={32} />
      </span>

      <h2 className="mt-5 text-titre-1 text-encre">{t("prestataire.envoyeeTitre")}</h2>
      <p className="mx-auto mt-3 max-w-[46ch] text-corps text-encre-douce">
        {t("prestataire.envoyeeTexte")}
      </p>

      <div className="mx-auto mt-6 max-w-[460px] text-left">
        <Bandeau variante="information">
          <strong className="block font-semibold">{t("prestataire.delaiTraitement")}</strong>
          {t("prestataire.delaiTraitementTexte")}
        </Bandeau>
      </div>

      <div className="mx-auto mt-8 max-w-[300px]">
        <a href="/">
          <Bouton variante="secondaire" largeur="pleine">
            {t("prestataire.retourAccueil")}
          </Bouton>
        </a>
      </div>
    </div>
  );
}

function Navigation({
  t,
  onPrecedent,
  suivant,
}: {
  t: (cle: string) => string;
  onPrecedent: () => void;
  suivant: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row-reverse">
      {suivant}
      <Bouton variante="secondaire" largeur="pleine" onClick={onPrecedent}>
        {t("prestataire.precedent")}
      </Bouton>
    </div>
  );
}

function Puce({
  libelle,
  actif,
  onClick,
}: {
  libelle: string;
  actif: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={
        "inline-flex min-h-[var(--size-touch)] items-center rounded-pill border px-4 text-petit font-semibold " +
        (actif
          ? "border-primaire bg-primaire text-white"
          : "border-contour-champ bg-surface text-encre hover:border-primaire/40")
      }
    >
      {libelle}
    </button>
  );
}

function Ligne({ terme, children }: { terme: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <dt className="text-petit text-encre-douce">{terme}</dt>
      <dd className="text-petit text-encre">{children}</dd>
    </div>
  );
}
