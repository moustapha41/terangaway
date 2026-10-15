/**
 * Modèle d'e-mail pour le code de vérification OTP Teranga Way.
 */

export interface ContenuEmailOtp {
  sujet: string;
  html: string;
  texte: string;
}

export function genererEmailOtp(code: string, minutesValidite = 10): ContenuEmailOtp {
  const sujet = "Votre code de vérification Teranga Way";

  const texte = `Bonjour,

Voici votre code de vérification à usage unique pour vous connecter à Teranga Way :

${code}

Ce code est valable pendant ${minutesValidite} minutes.

Pour votre sécurité :
- Ne communiquez jamais ce code à qui que ce soit, pas même à un conseiller Teranga Way.
- Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.

L'équipe Teranga Way
L'hospitalité sénégalaise en toute confiance
`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sujet}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 560px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #0f172a;
      padding: 28px 32px;
      text-align: center;
    }
    .brand-title {
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .brand-accent {
      color: #f59e0b;
    }
    .content {
      padding: 36px 32px;
    }
    .title {
      font-size: 20px;
      font-weight: 600;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .text {
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
      margin-bottom: 24px;
    }
    .code-container {
      text-align: center;
      margin: 28px 0;
      background-color: #f1f5f9;
      border: 2px dashed #cbd5e1;
      border-radius: 10px;
      padding: 20px;
    }
    .code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #0f172a;
      display: inline-block;
      user-select: all;
    }
    .notice {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 14px 16px;
      border-radius: 4px;
      margin-bottom: 24px;
    }
    .notice-text {
      font-size: 13px;
      line-height: 1.5;
      color: #92400e;
      margin: 0;
    }
    .warning {
      font-size: 13px;
      line-height: 1.5;
      color: #64748b;
      margin-top: 20px;
      margin-bottom: 0;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 32px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1 class="brand-title">Teranga <span class="brand-accent">Way</span></h1>
    </div>
    <div class="content">
      <h2 class="title">Votre code de vérification</h2>
      <p class="text">
        Utilisez le code ci-dessous pour confirmer votre identité et accéder à vos réservations :
      </p>
      <div class="code-container">
        <span class="code">${code}</span>
      </div>
      <div class="notice">
        <p class="notice-text">
          ⏳ <strong>Validité :</strong> Ce code expire dans <strong>${minutesValidite} minutes</strong> et ne peut être utilisé qu'une seule fois.
        </p>
      </div>
      <p class="warning">
        🔒 <strong>Sécurité :</strong> Ne partagez ce code avec personne. Aucun collaborateur de Teranga Way ne vous demandera votre code de vérification. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} Teranga Way. L'hospitalité en toute confiance.</p>
    </div>
  </div>
</body>
</html>`;

  return { sujet, html, texte };
}
