import cron from 'node-cron';
import 'dotenv/config';
import logger from '../logger.js';
import pool from '../models/db.js';
import { findExtrasBySite } from '../models/extrasModel.js';
import { findSemaineBySite } from '../models/semainModel.js';
import { findDisponibilites } from '../models/disponibilitesModel.js';
import { findPlanningBySemaine, createPlanning, createAffectation } from '../models/planningsModel.js';
import { findCreneauxBySemaine } from '../models/creneauxModel.js';
import { getPostesByExtras } from '../models/postesModel.js';
import { greedyScheduler } from '../services/planningService.js';
import { getCurrentISOWeek } from '../utils/dates.js';

async function generatePlanningProposalsForAllSites() {
  logger.info({ message: 'generatePlanningProposal job start' });
  const { rows: sites } = await pool.query('SELECT id FROM sites');
  const isoWeek = getCurrentISOWeek();

  for (const site of sites) {
    try {
      const semaines = await findSemaineBySite(site.id);
      const semaine = semaines.find((s) => s.iso_week === isoWeek);
      if (!semaine) {
        logger.info({ message: 'No semaine found for site', site_id: site.id, isoWeek });
        continue;
      }
      const existingPlanning = await findPlanningBySemaine(semaine.id, site.id);
      if (existingPlanning) {
        logger.info({ message: 'Planning already exists', site_id: site.id, semaine_id: semaine.id });
        continue;
      }
      const dispos = await findDisponibilites(semaine.id, site.id);
      if (dispos.length === 0) {
        logger.info({ message: 'No dispos for site this week', site_id: site.id });
        continue;
      }
      const extras = await findExtrasBySite(site.id);
      const creneaux = await findCreneauxBySemaine(semaine.id, site.id);
      const postesMap = await getPostesByExtras(extras.map(e => e.id), site.id);
      const extrasWithPostes = extras.map(e => ({ ...e, poste_ids: postesMap[e.id] ?? [] }));
      const proposals = greedyScheduler(extrasWithPostes, creneaux, dispos);
      const planning = await createPlanning(semaine.id, site.id);
      for (const { extra_id, creneau_id } of proposals) {
        await createAffectation(planning.id, extra_id, creneau_id, site.id);
      }
      logger.info({ message: 'Planning proposal created', site_id: site.id, planning_id: planning.id, count: proposals.length });
    } catch (err) {
      logger.error({ message: 'generatePlanningProposal failed for site', site_id: site.id, err });
    }
  }
}

export function startPlanningProposalJob() {
  cron.schedule('0 19 * * 4', generatePlanningProposalsForAllSites, { timezone: 'Europe/Paris' });
  logger.info({ message: 'generatePlanningProposal job scheduled: thursday 19:00' });
}
