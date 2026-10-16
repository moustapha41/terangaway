/**
 * Les écrans qui prennent toute la fenêtre.
 *
 * Un groupe sans enveloppe : ni pied de page, ni barre du bas, ni en-tête.
 * La connexion est le premier à y entrer — sa maquette ne montre que la photo,
 * la carte et les quatre repères, et tout ce qu'on ajouterait autour serait une
 * sortie offerte au milieu d'une entrée.
 *
 * Le nom entre parenthèses ne paraît pas dans l'URL : `/fr/connexion` reste
 * `/fr/connexion`.
 */
export default function LayoutPleinCadre({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
