import { env } from '../config/env';
import { logger } from '../config/logger';

interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Mail abstraction. When SMTP is not configured (local development), the
 * message is logged so flows like invitations and password reset remain
 * fully testable without an email provider. Plug an SMTP transport here
 * (e.g. nodemailer) once SMTP_* variables are set.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (!env.SMTP_HOST) {
    logger.info({ to: mail.to, subject: mail.subject, body: mail.text }, '[mailer] SMTP not configured — logging email instead');
    return;
  }
  // SMTP transport integration point.
  logger.warn('[mailer] SMTP configured but no transport installed; add nodemailer to enable delivery.');
}

export function appLink(path: string): string {
  return `${env.APP_URL.replace(/\/$/, '')}${path}`;
}
