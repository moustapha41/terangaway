/**
 * Le catalogue présenté est-il un catalogue de démonstration ?
 *
 * Aujourd'hui la réponse est **oui**, et elle ne dépend pas du mode mock :
 * `logementParId` et `vehiculeParId` lisent `@teranga/fixtures` dans tous les
 * cas, l'API résout les offres par `DepotLogementsFixtures`, et le schéma
 * Prisma n'a aucune table d'offre — seulement des comptes, des sessions et des
 * demandes. Les dix-sept logements et les véhicules sont des exemples.
 *
 * Ces exemples portent un badge « Vérifié » et un prix. Sans marqueur, un
 * visiteur n'a aucun moyen de savoir qu'il s'apprête à demander une villa qui
 * n'existe pas. Le défaut est donc à `true` : on annonce la démonstration tant
 * que personne n'a déclaré le contraire.
 *
 * Le jour où un vrai catalogue est branché, `NEXT_PUBLIC_CATALOGUE_DEMO=false`
 * à la construction fait disparaître le marqueur — et ce fichier avec lui.
 */
export function catalogueDeDemonstration(): boolean {
  return process.env.NEXT_PUBLIC_CATALOGUE_DEMO !== "false";
}
