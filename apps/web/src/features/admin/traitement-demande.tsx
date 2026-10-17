"use client";

import { useState, useTransition } from "react";
import { Bandeau, Bouton, Carte, Champ } from "@teranga/ui";
import type {
  ContactAdmin,
  DemandeAdmin,
  MiseAJourDemandeAdmin,
  StatutDemande,
} from "@teranga/contracts";
import { MOTIFS_REFUS, STATUTS_DEMANDE } from "@teranga/contracts";
import { traiterDemandeAction } from "./actions";
import { useT } from "@/lib/i18n/contexte";

/**
 * Ce que l'équipe fait d'une demande.
 *
 * Un seul envoi pour tout : statut, motif, prestataire, devis, note. Les
 * gestes vont ensemble — on refuse *et* on écrit pourquoi — et deux boutons
 * auraient laissé la moitié du travail enregistrée.
 *
 * Les champs partent **seulement s'ils ont changé** : réenvoyer une note
 * identique la réécrirait à chaque passage, et réenvoyer le statut courant
 * ferait refuser l'enregistrement par la table des transitions, qui n'autorise
 * pas un statut vers lui-même.
 */
export function TraitementDemande({
  demande,
  prestataires,
}: {
  demande: DemandeAdmin;
  /** Les partenaires connus, pour choisir sans retaper un identifiant. */
  prestataires: ContactAdmin[];
}) {
  const t = useT();
  const [statut, setStatut] = useState<StatutDemande | "">("");
  const [motif, setMotif] = useState<string>("");
  const [note, setNote] = useState(demande.noteInterne ?? "");
  const [prix, setPrix] = useState(
    demande.prixPropose !== undefined ? String(demande.prixPropose) : "",
  );
  const [prestataire, setPrestataire] = useState(demande.prestataire?.id ?? "");
  const [message, setMessage] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const prixInitial = demande.prixPropose !== undefined ? String(demande.prixPropose) : "";
  const prestataireInitial = demande.prestataire?.id ?? "";

  // Si le partenaire actuel n'est plus dans la liste (compte retiré), on le
  // garde visible le temps d'un détachement — sinon l'équipe croirait qu'il
  // n'y en a jamais eu.
  const options = [...prestataires];
  if (
    demande.prestataire &&
    !options.some((p) => p.id === demande.prestataire!.id)
  ) {
    options.unshift(demande.prestataire);
  }

  const enregistrer = () =>
    demarrer(async () => {
      const maj: MiseAJourDemandeAdmin = {};
      if (statut) maj.statut = statut;
      if (statut === "refusee" && motif) maj.motifRefus = motif as MiseAJourDemandeAdmin["motifRefus"];
      if (note !== (demande.noteInterne ?? "")) maj.noteInterne = note;
      if (prix !== prixInitial) maj.prixPropose = prix.trim() === "" ? null : Number(prix);
      if (prestataire !== prestataireInitial) {
        maj.prestataireId = prestataire.trim() === "" ? null : prestataire.trim();
      }

      if (Object.keys(maj).length === 0) {
        setMessage({ ton: "succes", texte: t("admin.enregistre") });
        return;
      }

      const resultat = await traiterDemandeAction(demande.id, maj);
      if (resultat.succes) {
        setStatut("");
        setMotif("");
        setMessage({ ton: "succes", texte: t("admin.enregistre") });
      } else {
        setMessage({ ton: "erreur", texte: resultat.message });
      }
    });

  return (
    <Carte className="p-5">
      <h2 className="text-titre-3 text-encre">{t("admin.traitement")}</h2>

      {message && (
        <div className="mt-3">
          <Bandeau variante={message.ton === "succes" ? "succes" : "erreur"}>
            {message.texte}
          </Bandeau>
        </div>
      )}

      <div className="mt-4 space-y-4">
        <label className="flex flex-col gap-1">
          <span className="text-petit text-encre">{t("admin.statut")}</span>
          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value as StatutDemande | "")}
            className="min-h-[var(--size-control)] rounded-control border border-contour bg-surface px-3 text-petit text-encre outline-none focus:border-primaire"
          >
            <option value="">{t("admin.statutInchange")}</option>
            {STATUTS_DEMANDE.filter((s) => s !== demande.statut).map((s) => (
              <option key={s} value={s}>
                {t(`statut.${s}`)}
              </option>
            ))}
          </select>
        </label>

        {statut === "refusee" && (
          <label className="flex flex-col gap-1">
            <span className="text-petit text-encre">{t("admin.motifRefus")}</span>
            <select
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="min-h-[var(--size-control)] rounded-control border border-contour bg-surface px-3 text-petit text-encre outline-none focus:border-primaire"
            >
              <option value="">—</option>
              {MOTIFS_REFUS.map((m) => (
                <option key={m} value={m}>
                  {t(`admin.motif.${m}`)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-petit text-encre">{t("admin.prestataireId")}</span>
          <select
            value={prestataire}
            onChange={(e) => setPrestataire(e.target.value)}
            className="min-h-[var(--size-control)] rounded-control border border-contour bg-surface px-3 text-petit text-encre outline-none focus:border-primaire"
          >
            <option value="">{t("admin.prestataireAucun")}</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {libellePrestataire(p)}
              </option>
            ))}
          </select>
          <span className="text-legende text-encre-douce">{t("admin.prestataireIdAide")}</span>
        </label>

        {/* Le devis ne concerne que les services : ailleurs, le prix est figé
            à l'envoi et l'équipe n'a pas à le rouvrir (§B.2). */}
        {demande.service && (
          <Champ
            libelle={t("admin.prixPropose")}
            aide={t("admin.prixProposeAide")}
            inputMode="numeric"
            tabulaire
            value={prix}
            onChange={(e) => setPrix(e.target.value.replace(/\D/g, ""))}
          />
        )}

        <label className="flex flex-col gap-1">
          <span className="text-petit text-encre">{t("admin.noteInterne")}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="rounded-control border border-contour bg-surface px-3 py-2 text-petit text-encre outline-none focus:border-primaire"
          />
          <span className="text-legende text-encre-douce">{t("admin.noteInterneAide")}</span>
        </label>

        <Bouton variante="principal" largeur="pleine" enCours={enCours} onClick={enregistrer}>
          {t("admin.enregistrer")}
        </Bouton>
      </div>
    </Carte>
  );
}

function libellePrestataire(p: ContactAdmin): string {
  const nom = p.nom?.trim();
  const email = p.email?.trim();
  if (nom && email) return `${nom} · ${email}`;
  return nom || email || p.id;
}
