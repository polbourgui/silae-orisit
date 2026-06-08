import cron from 'node-cron';
import pool from '../models/db.js';
import { findExtrasBySite } from '../models/extrasModel.js';
import { findOrCreateSemaine } from '../models/semainModel.js';
import { generateMagicLinkToken } from '../utils/jwt.js';
import { updateTokenVersion } from '../models/extrasModel.js';
import { sendDispoLink } from '../services/mailService.js';
import { getCurrentISOWeek } from '../utils/dates.js';
import logger from '../logger.js';

async function sendDispoLinksToAllSites() {
  const { rows: sites } = await pool.query('SELECT id FROM sites');
  const semaine = getCurrentISOWeek();

  for (const site of sites) {
    const extras = await findExtrasBySite(site.id);
    const semaineRow = await findOrCreateSemaine(site.id, semaine);

    for (const extra of extras) {
      try {
        await updateTokenVersion(extra.id);
        const { rows } = await pool.query(
          'SELECT token_version FROM extras WHERE id = $1',
          [extra.id]
        );
        const token = generateMagicLinkToken({
          type: 'dispo',
          extraId: extra.id,
          siteId: site.id,
          semaine,
          tokenVersion: rows[0].token_version,
        });
        const url = `${process.env.APP_BASE_URL}/dispos/${token}`;
        await sendDispoLink(extra, url);
      } catch (err) {
        logger.error({ msg: 'Erreur envoi dispo link', extraId: extra.id, err: err.message });
      }
    }
  }
  logger.info({ msg: 'sendDispoLinks terminé', semaine });
}

export function startSendDispoJob() {
  cron.schedule('0 8 * * 1', sendDispoLinksToAllSites, { timezone: 'Europe/Paris' });
  logger.info({ msg: 'Job sendDispoLinks planifié (lundi 8h)' });
}
