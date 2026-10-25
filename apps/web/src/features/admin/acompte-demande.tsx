"use client";

import { useState, useTransition } from "react";
import { Bandeau } from "@teranga/ui";
import { AlertTriangle, Banknote, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import type { VueAcompteAdmin } from "@teranga/contracts";
import { useLangue, useT } from "@/lib/i18n/contexte";
import {
  constaterRemboursementAction,
  deciderPaiementTardifAction,
  deciderRemboursementAction,
  preparerAcompteAction,
  renvoyerConfirmationAction,
  renvoyerInstructionsAction,
  saisirReceptionAction,
  type ResultatAcompte,
} from "./actions";
import { analyserSaisie, cleErreurAcompte, cleEtatEnvoi, formaterFrancs, saisiePrete } from "./acompte-admin";
import { formaterDateHeure } from "./format";

/**
 * L'acompte d'une demande : montants, coordonnées envoyées, constat d'une
 * réception, journal.
 *
 * Rien n'est calculé ici. Les montants, le reste dû et les actions possibles
 * viennent de l'API ; l'écran n'envoie que ce que la personne a lu sur le
 * compte. « Reçu » ne s'affiche que d'après le statut enregistré, jamais
 * d'après une déclaration.
 */
export function AcompteDemande({
  demandeId,
  initiale,
  erreurChargement,
}: {
  demandeId: string;
  initiale?: VueAcompteAdmin;
  erreurChargement?: { code: string };
}) {
  const t = useT();
  const langue = useLangue();
  const [vue, setVue] = useState<VueAcompteAdmin | undefined>(initiale);
  const [message, setMessage] = useState<{ ton: "succes" | "erreur" | "avertissement"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const [montant, setMontant] = useState("");
  const [reference, setReference] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [verifie, setVerifie] = useState(false);
  const [ecartConfirme, setEcartConfirme] = useState(false);

  // Décisions : un formulaire chacune, jamais plusieurs à la fois.
  const [motif, setMotif] = useState("");
  const [issueTardive, setIssueTardive] = useState<"accepter" | "rembourser">("rembourser");
  const [montantRembourse, setMontantRembourse] = useState("");
  const [referenceRemb, setReferenceRemb] = useState("");
  const [commentaireRemb, setCommentaireRemb] = useState("");
  const [rembourseFait, setRembourseFait] = useState(false);

  const francs = (n: number) => formaterFrancs(n, langue);

  const enTete = (
    <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#001D35] text-amber-300">
        <Banknote className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-900">{t("admin.acompte.titre")}</h2>
        <p className="text-xs text-slate-500">{t("admin.acompte.sousTitre")}</p>
      </div>
    </div>
  );

  if (!vue) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {enTete}
        <div className="mt-4">
          <Bandeau variante="erreur">{t(cleErreurAcompte(erreurChargement?.code ?? "INJOIGNABLE"))}</Bandeau>
        </div>
      </div>
    );
  }

  const appliquer = (resultat: ResultatAcompte, succes: string, reinitialiser = false) => {
    if (!resultat.succes) {
      setMessage({ ton: "erreur", texte: t(cleErreurAcompte(resultat.code)) });
      return;
    }
    setVue(resultat.vue);
    // Aucun dossier n'a été ouvert : dire pourquoi, au lieu d'un faux « acompte ouvert ».
    if (resultat.info === "offre_deja_confirmee") {
      setMessage({ ton: "avertissement", texte: t("admin.acompte.offreDejaConfirmeeOuverture") });
      return;
    }
    const cleEnvoi = cleEtatEnvoi(resultat.info);
    // Un envoi qui a échoué n'est jamais présenté comme un succès.
    const echec = resultat.info === "echec" || resultat.info === "sans_destinataire";
    setMessage({
      ton: echec ? "avertissement" : "succes",
      texte: cleEnvoi ? `${succes} ${t(cleEnvoi)}` : succes,
    });
    if (reinitialiser) {
      setMontant("");
      setReference("");
      setCommentaire("");
      setVerifie(false);
      setEcartConfirme(false);
    }
  };

  const analyse = analyserSaisie(vue, montant);
  const pret = saisiePrete(analyse, { verifie, ecartConfirme, commentaire });
  const { acompte, actions } = vue;

  const enregistrer = () =>
    demarrer(async () => {
      if (!acompte || analyse.sens === null) return;
      appliquer(
        await saisirReceptionAction(demandeId, {
          montant: Number(montant.replace(/[\s  ]/g, "")),
          montantRecuAvant: acompte.montantRecu,
          referenceTransaction: reference.trim() || undefined,
          commentaire: commentaire.trim() || undefined,
          ecartConfirme: analyse.exigeConfirmation ? ecartConfirme : undefined,
        }),
        t("admin.acompte.reception.enregistree"),
        true,
      );
    });

  const decider = (action: () => Promise<ResultatAcompte>, succes: string) =>
    demarrer(async () => {
      appliquer(await action(), succes);
      setMotif("");
      setMontantRembourse("");
      setReferenceRemb("");
      setCommentaireRemb("");
      setRembourseFait(false);
    });

  const bouton = (libelle: string, action: () => Promise<ResultatAcompte>, succes: string) => (
    <button
      type="button"
      disabled={enCours}
      onClick={() => demarrer(async () => appliquer(await action(), succes))}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 disabled:opacity-60"
    >
      <Mail className="h-4 w-4" />
      {libelle}
    </button>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {enTete}

      {!vue.actif && (
        <div className="mt-4">
          <Bandeau variante="information">{t("admin.acompte.inactif")}</Bandeau>
        </div>
      )}

      {!vue.acompte && vue.offreDejaConfirmee && (
        <div className="mt-4" role="alert">
          <Bandeau variante="avertissement">{t("admin.acompte.offreDejaConfirmee")}</Bandeau>
        </div>
      )}

      {/* Rien d'ouvert : aperçu du calcul du serveur, et ouverture explicite */}
      {!acompte && (
        <div className="mt-4 space-y-3">
          {vue.apercu ? (
            <>
              <dl className="space-y-1.5 text-sm">
                <Ligne etiquette={t("admin.acompte.total")} valeur={francs(vue.apercu.montantTotal)} />
                <Ligne etiquette={t("admin.acompte.pourcentage")} valeur={`${vue.apercu.pourcentage} %`} />
                <Ligne etiquette={t("admin.acompte.attendu")} valeur={francs(vue.apercu.montantAttendu)} fort />
                <Ligne etiquette={t("admin.acompte.soldeSejour")} valeur={francs(vue.apercu.solde)} />
              </dl>
              {actions.preparer &&
                bouton(
                  t("admin.acompte.ouvrir"),
                  () => preparerAcompteAction(demandeId),
                  t("admin.acompte.ouverte"),
                )}
            </>
          ) : (
            <p className="text-sm text-slate-600">{t("admin.acompte.aucunDossier")}</p>
          )}
        </div>
      )}

      {acompte && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className={
                acompte.statut === "paye"
                  ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
                  : acompte.statut === "partiel"
                    ? "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                    : "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
              }
            >
              {t(`admin.acompte.statut.${acompte.statut}`)}
            </span>
            <span className="text-xs text-slate-500">
              {t("admin.acompte.reservationDistincte", { statut: t(`statut.${vue.statutDemande}`) })}
            </span>
          </div>

          <dl className="mt-4 space-y-1.5 text-sm">
            <Ligne etiquette={t("admin.acompte.total")} valeur={francs(acompte.montantTotal)} />
            <Ligne
              etiquette={t("admin.acompte.attendu")}
              valeur={`${francs(acompte.montantAttendu)} (${acompte.pourcentageApplique} %)`}
              fort
            />
            <Ligne etiquette={t("admin.acompte.recu")} valeur={francs(acompte.montantRecu)} />
            <Ligne etiquette={t("admin.acompte.reste")} valeur={francs(vue.resteDu ?? 0)} fort />
            <Ligne etiquette={t("admin.acompte.soldeSejour")} valeur={francs(vue.soldeApresAcompte ?? 0)} />
            <Ligne etiquette={t("admin.acompte.echeance")} valeur={formaterDateHeure(acompte.echeanceLe, langue)} />
            <Ligne etiquette={t("admin.acompte.reference")} valeur={acompte.referenceVirement} />
            <Ligne
              etiquette={t("admin.acompte.instructions")}
              valeur={
                acompte.instructionsEnvoyeesLe
                  ? formaterDateHeure(acompte.instructionsEnvoyeesLe, langue)
                  : t("admin.acompte.nonEnvoyees")
              }
            />
          </dl>

          {acompte.montantRecu > acompte.montantAttendu && (
            // Le reste dû est plafonné à zéro : sans cet avis, un trop-perçu serait invisible.
            <div className="mt-4" role="note">
              <Bandeau variante="avertissement">
                {t("admin.acompte.surplus", { surplus: francs(acompte.montantRecu - acompte.montantAttendu) })}
              </Bandeau>
            </div>
          )}

          {actions.deciderPaiementTardif && (
            <div className="mt-4">
              <Bandeau variante="avertissement">{t("admin.acompte.tardif")}</Bandeau>
            </div>
          )}

          {vue.coordonnees && (
            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {t("admin.acompte.coordonnees")}
              </h3>
              {vue.coordonnees.virement && (
                <div className="mt-2">
                  <p className="font-semibold text-slate-800">{t("admin.acompte.moyen.virement")}</p>
                  <p className="text-slate-600">
                    {vue.coordonnees.virement.titulaire} · {vue.coordonnees.virement.banque}
                  </p>
                  <p className="break-all font-mono text-xs text-slate-700">
                    {vue.coordonnees.virement.iban} · {vue.coordonnees.virement.bic}
                  </p>
                </div>
              )}
              {vue.coordonnees.mobileMoney.map((compte) => (
                <div key={compte.operateur} className="mt-2">
                  <p className="font-semibold text-slate-800">{t(`admin.acompte.moyen.${compte.operateur}`)}</p>
                  <p className="text-slate-600">
                    {compte.titulaire} · <span className="font-mono text-xs">{compte.numero}</span>
                  </p>
                </div>
              ))}
              {vue.coordonnees.instructions && (
                <p className="mt-2 text-xs text-slate-600">{vue.coordonnees.instructions}</p>
              )}
            </div>
          )}

          {actions.confirmerReception && (
            <form
              className="mt-5 space-y-3 border-t border-slate-100 pt-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (pret) enregistrer();
              }}
            >
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                {t("admin.acompte.reception.titre")}
              </h3>

              <div className="space-y-1.5">
                <label htmlFor="acompte-montant" className="text-xs font-semibold text-slate-700">
                  {t("admin.acompte.reception.montant")} <span className="text-red-600">*</span>
                </label>
                <input
                  id="acompte-montant"
                  inputMode="numeric"
                  autoComplete="off"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#001D35] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="acompte-reference" className="text-xs font-semibold text-slate-700">
                  {t("admin.acompte.reception.reference")}
                </label>
                <input
                  id="acompte-reference"
                  maxLength={100}
                  autoComplete="off"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#001D35] focus:outline-none"
                />
              </div>

              {analyse.sens === "exact" && (
                <p className="text-xs text-emerald-700">{t("admin.acompte.reception.exact")}</p>
              )}
              {analyse.exigeConfirmation && (
                <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {analyse.sens === "inferieur"
                      ? t("admin.acompte.reception.avertissementInferieur", {
                          manque: francs(-analyse.ecart),
                        })
                      : t("admin.acompte.reception.avertissementSuperieur", {
                          surplus: francs(analyse.ecart),
                        })}
                  </p>
                  <label className="mt-2 flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={ecartConfirme}
                      onChange={(e) => setEcartConfirme(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>{t("admin.acompte.reception.ecartConfirme")}</span>
                  </label>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="acompte-commentaire" className="text-xs font-semibold text-slate-700">
                  {t("admin.acompte.reception.commentaire")}
                  {analyse.exigeConfirmation && <span className="text-red-600"> *</span>}
                </label>
                <textarea
                  id="acompte-commentaire"
                  rows={2}
                  maxLength={500}
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#001D35] focus:outline-none"
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={verifie}
                  onChange={(e) => setVerifie(e.target.checked)}
                  className="mt-0.5"
                />
                <span>{t("admin.acompte.reception.verifie")}</span>
              </label>

              <button
                type="submit"
                disabled={enCours || !pret}
                className="w-full rounded-xl bg-[#001D35] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("admin.acompte.reception.enregistrer")}
              </button>
            </form>
          )}

          {(actions.deciderPaiementTardif || actions.deciderRemboursement || actions.constaterRemboursement) && (
            <div className="mt-5 space-y-5 border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-900">{t("admin.acompte.decisions.titre")}</h3>
              <p className="text-xs text-slate-500">{t("admin.acompte.decisions.aucunTransfert")}</p>
              <p className="text-xs font-semibold text-slate-600">{t("admin.acompte.decisions.limites")}</p>

              {actions.deciderPaiementTardif && (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (motif.trim()) {
                      decider(
                        () => deciderPaiementTardifAction(demandeId, { issue: issueTardive, commentaire: motif.trim() }),
                        t("admin.acompte.decisions.enregistree"),
                      );
                    }
                  }}
                >
                  <p className="text-sm font-semibold text-slate-800">{t("admin.acompte.decisions.tardifTitre")}</p>
                  <select
                    value={issueTardive}
                    onChange={(e) => setIssueTardive(e.target.value as "accepter" | "rembourser")}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    aria-label={t("admin.acompte.decisions.tardifTitre")}
                  >
                    <option value="rembourser">{t("admin.acompte.decisions.rembourser")}</option>
                    <option value="accepter">{t("admin.acompte.decisions.accepter")}</option>
                  </select>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    placeholder={t("admin.acompte.decisions.examen")}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={enCours || !motif.trim()}
                    className="w-full rounded-xl bg-[#001D35] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {t("admin.acompte.decisions.decider")}
                  </button>
                </form>
              )}

              {actions.deciderRemboursement && (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (motif.trim().length >= 3) {
                      decider(() => deciderRemboursementAction(demandeId, motif.trim()), t("admin.acompte.decisions.enregistree"));
                    }
                  }}
                >
                  <p className="text-sm font-semibold text-slate-800">{t("admin.acompte.decisions.remboursementTitre")}</p>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    placeholder={t("admin.acompte.decisions.motif")}
                    aria-label={t("admin.acompte.decisions.motif")}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={enCours || motif.trim().length < 3}
                    className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 disabled:opacity-50"
                  >
                    {t("admin.acompte.decisions.deciderRemboursement")}
                  </button>
                </form>
              )}

              {actions.constaterRemboursement && acompte && (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const montantRendu = Number(montantRembourse.replace(/[\s\u202f\u00a0]/g, ""));
                    if (rembourseFait && Number.isInteger(montantRendu) && montantRendu > 0) {
                      decider(
                        () =>
                          constaterRemboursementAction(demandeId, {
                            montant: montantRendu,
                            referenceTransaction: referenceRemb.trim() || undefined,
                            commentaire: commentaireRemb.trim() || undefined,
                          }),
                        t("admin.acompte.decisions.constatEnregistre"),
                      );
                    }
                  }}
                >
                  <p className="text-sm font-semibold text-slate-800">
                    {t("admin.acompte.decisions.constatTitre", { montant: francs(acompte.montantRecu) })}
                  </p>
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    value={montantRembourse}
                    onChange={(e) => setMontantRembourse(e.target.value)}
                    placeholder={t("admin.acompte.decisions.montantRendu")}
                    aria-label={t("admin.acompte.decisions.montantRendu")}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    maxLength={100}
                    autoComplete="off"
                    value={referenceRemb}
                    onChange={(e) => setReferenceRemb(e.target.value)}
                    placeholder={t("admin.acompte.reception.reference")}
                    aria-label={t("admin.acompte.reception.reference")}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={commentaireRemb}
                    onChange={(e) => setCommentaireRemb(e.target.value)}
                    placeholder={t("admin.acompte.reception.commentaire")}
                    aria-label={t("admin.acompte.reception.commentaire")}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                  <label className="flex items-start gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={rembourseFait}
                      onChange={(e) => setRembourseFait(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>{t("admin.acompte.decisions.dejaRembourse")}</span>
                  </label>
                  <button
                    type="submit"
                    disabled={enCours || !rembourseFait || !montantRembourse.trim()}
                    className="w-full rounded-xl bg-[#001D35] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {t("admin.acompte.decisions.constater")}
                  </button>
                </form>
              )}
            </div>
          )}

          {(actions.renvoyerInstructions || actions.renvoyerConfirmation) && (
            <div className="mt-5 space-y-2 border-t border-slate-100 pt-5">
              {actions.renvoyerInstructions &&
                bouton(
                  t("admin.acompte.renvoyerInstructions"),
                  () => renvoyerInstructionsAction(demandeId),
                  t("admin.acompte.instructionsRenvoyees"),
                )}
              {actions.renvoyerConfirmation &&
                bouton(
                  t("admin.acompte.renvoyerConfirmation"),
                  () => renvoyerConfirmationAction(demandeId),
                  t("admin.acompte.confirmationRenvoyee"),
                )}
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <RefreshCw className="h-3 w-3" />
                {t("admin.acompte.renvoiSansPaiement")}
              </p>
            </div>
          )}

          {vue.journal.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {t("admin.acompte.journal")}
              </h3>
              <ol className="mt-3 space-y-2">
                {vue.journal.map((evenement) => (
                  <li key={evenement.id} className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">
                      {t(`admin.acompte.evenement.${evenement.type}`)}
                    </span>
                    {evenement.montant !== undefined && <> · {francs(evenement.montant)}</>}
                    {evenement.referenceTransaction && <> · {evenement.referenceTransaction}</>}
                    <br />
                    <span className="text-slate-500">
                      {formaterDateHeure(evenement.creeLe, langue)} ·{" "}
                      {evenement.acteurId
                        ? (vue.acteurs[evenement.acteurId] ?? evenement.acteurId)
                        : t("admin.acompte.systeme")}
                    </span>
                    {evenement.commentaire && <p className="mt-0.5 text-slate-600">{evenement.commentaire}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      {message && (
        <div className="mt-4" role="status">
          <Bandeau variante={message.ton}>{message.texte}</Bandeau>
        </div>
      )}
    </div>
  );
}

function Ligne({ etiquette, valeur, fort }: { etiquette: string; valeur: string; fort?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{etiquette}</dt>
      <dd className={fort ? "text-right font-bold text-slate-900" : "text-right font-medium text-slate-800"}>
        {valeur}
      </dd>
    </div>
  );
}
