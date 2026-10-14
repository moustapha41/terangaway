import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Erreurs métier, avec un code stable.
 *
 * Le site décide sur le `code`, jamais sur le texte : un message se réécrit,
 * un code se contracte. Chaque code ajouté ici doit l'être aussi dans l'OpenAPI
 * de la route qui peut le renvoyer.
 */
export class ErreurMetier extends HttpException {
  constructor(code: string, message: string, statut: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ code, message }, statut);
  }
}

export const introuvable = (quoi: string) =>
  new ErreurMetier(`${quoi.toUpperCase()}_INTROUVABLE`, `${quoi} introuvable.`, HttpStatus.NOT_FOUND);
