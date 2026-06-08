import { Resend } from 'resend';
import 'dotenv/config';
import logger from '../logger.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM;

/**
 * @param {{ prenom: string, nom: string, email: string }} extra
 * @param {string} magicLinkUrl
 */
export async function sendDispoLink(extra, magicLinkUrl) {
  const { error } = await resend.emails.send({
    from: FROM,
    to: extra.email,
    subject: 'Indiquez vos disponibilités pour la semaine',
    html: `
      <p>Bonjour ${extra.prenom},</p>
      <p>Merci d'indiquer vos disponibilités pour la semaine en cliquant sur le lien ci-dessous :</p>
      <p><a href="${magicLinkUrl}">Indiquer mes disponibilités</a></p>
      <p>Ce lien est valable 48h.</p>
      <p>Cordialement</p>
    `,
  });
  if (error) {
    logger.error({ message: 'sendDispoLink error', extra_id: extra.id, error });
    throw new Error(`Mail dispo failed: ${error.message}`);
  }
  logger.info({ message: 'sendDispoLink sent', extra_id: extra.id });
}

/**
 * @param {{ prenom: string, nom: string, email: string }} extra
 * @param {string} contratUrl
 */
export async function sendContratLink(extra, contratUrl) {
  const { error } = await resend.emails.send({
    from: FROM,
    to: extra.email,
    subject: 'Votre contrat est disponible',
    html: `
      <p>Bonjour ${extra.prenom},</p>
      <p>Votre contrat pour la prochaine prestation est prêt. Veuillez le consulter et le signer :</p>
      <p><a href="${contratUrl}">Voir et signer mon contrat</a></p>
      <p>Ce lien est valable 7 jours.</p>
      <p>Cordialement</p>
    `,
  });
  if (error) {
    logger.error({ message: 'sendContratLink error', extra_id: extra.id, error });
    throw new Error(`Mail contrat failed: ${error.message}`);
  }
  logger.info({ message: 'sendContratLink sent', extra_id: extra.id });
}
