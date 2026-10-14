import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Enveloppe d'erreur unique.
 *
 * Toutes les erreurs sortent sous la même forme, pour que le site n'ait qu'un
 * seul cas à traiter :
 *
 *     { "erreur": { "code": "LOGEMENT_INTROUVABLE", "message": "…" } }
 *
 * Le `message` est destiné à être lu par une personne ; le `code` est ce sur
 * quoi le code décide. Un message traduit côté site se choisit avec le code,
 * jamais avec le texte.
 *
 * Une erreur inattendue ne dit rien de l'intérieur du serveur : elle est
 * journalisée côté API et renvoie un message neutre.
 */
@Catch()
export class FiltreExceptions implements ExceptionFilter {
  private readonly journal = new Logger("Erreur");

  catch(exception: unknown, host: ArgumentsHost) {
    const contexte = host.switchToHttp();
    const reponse = contexte.getResponse<Response>();
    const requete = contexte.getRequest<Request>();

    if (exception instanceof HttpException) {
      const corps = exception.getResponse();

      if (typeof corps === "object" && corps !== null && "code" in corps) {
        const detail = corps as { code: string; message?: string };
        reponse.status(exception.getStatus()).json({
          erreur: { code: detail.code, message: detail.message ?? exception.message },
        });
        return;
      }

      // La validation renvoie la liste des champs fautifs. Les perdre fait
      // répondre « Bad Request Exception » à qui cherche quel champ manque :
      // on les garde dans `details`.
      const details =
        typeof corps === "object" && corps !== null && Array.isArray((corps as { message?: unknown }).message)
          ? ((corps as { message: string[] }).message)
          : undefined;

      reponse.status(exception.getStatus()).json({
        erreur: {
          code: codeParDefaut(exception.getStatus()),
          message: details ? "La requête est invalide." : exception.message,
          ...(details ? { details } : {}),
        },
      });
      return;
    }

    this.journal.error(
      `${requete.method} ${requete.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    reponse.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      erreur: { code: "ERREUR_SERVEUR", message: "Une erreur est survenue." },
    });
  }
}

function codeParDefaut(statut: number): string {
  if (statut === HttpStatus.NOT_FOUND) return "INTROUVABLE";
  if (statut === HttpStatus.BAD_REQUEST) return "REQUETE_INVALIDE";
  if (statut === HttpStatus.UNAUTHORIZED) return "NON_AUTHENTIFIE";
  if (statut === HttpStatus.FORBIDDEN) return "INTERDIT";
  if (statut === HttpStatus.CONFLICT) return "CONFLIT";
  return "ERREUR";
}
