import cron from 'node-cron';
import 'dotenv/config';
import logger from '../logger.js';
import pool from '../models/db.js';
import { findExtrasBySite, updateTokenVersion } from '../models/extrasModel.js';
import { findOrCreateSemaine } from '../models/semainModel.js';
import { generateMagicLinkToken } from '../utils/jwt.js';
import { getCurrentISOWeek } from '../utils/dates.js';
import { sendDispoLink } from '../services/mailService.js';

const APP_BASE_URL = process.env.APP_BASE_URL;

async function sendDispoLinksForAllSites() {
  logger.info({ message: 'sendDispoLinks job start' });
  const { rows: sites } = await pool.query('SELECT id FROM sites');
  const isoWeek = getCurrentISOWeek();

  for (const site of sites) {
    try {
      const semaine = await findOrCreateSemaine(site.id, isoWeek);
      const extras = await findExtrasBySite(site.id);
      for (const extra of extras) {
        try {
          const updated = await updateTokenVersion(extra.id);
          const token = generateMagicLinkToken({
            type: 'dispo',
            extraId: extra.id,
            siteId: site.id,
            semaine: isoWeek,
            tokenVersion: updated.token_version,
          });
          const magicLinkUrl = `${APP_BASE_URL}/dispos/${token}`;
          await sendDispoLink(extra, magicLinkUrl);
        } catch (err) {
          logger.error({ message: 'sendDispoLink failed for extra', extra_id: extra.id, err });
        }
      }
      logger.info({ message: 'sendDispoLinks done for site', site_id: site.id, count: extras.length });
    } catch (err) {
      logger.error({ message: 'sendDispoLinks failed for site', site_id: site.id, err });
    }
  }
}

export function startSendDispoJob() {
  cron.schedule('0 8 * * 1', sendDispoLinksForAllSites, { timezone: 'Europe/Paris' });
  logger.info({ message: 'sendDispoLinks job scheduled: monday 08:00' });
}
