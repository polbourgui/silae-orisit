import cron from 'node-cron';
import pool from '../models/db.js';
import { findDisponibilites } from '../models/disponibilitesModel.js';
import { findPlanningBySemaine, createPlanning, createAffectation } from '../models/planningsModel.js';
import { greedyScheduler } from '../services/planningService.js';
import { getCurrentISOWeek } from '../utils/dates.js';
import logger from '../logger.js';

async function generateProposalsForAllSites() {
  const semaine = getCurrentISOWeek();
  const { rows: semaines } = await pool.query(
    'SELECT id, site_id FROM semaines WHERE iso_week = $1',
    [semaine]
  );

  for (const sem of semaines) {
    try {
      const existingPlanning = await findPlanningBySemaine(sem.id, sem.site_id);
      if (existingPlanning) continue;

      const dispos = await findDisponibilites(sem.id, sem.site_id);
      if (!dispos.disponibilites?.length) continue;

      const planning = await createPlanning(sem.id, sem.site_id);
      const affectations = greedyScheduler(dispos.extras, dispos.creneaux, dispos.disponibilites);

      for (const aff of affectations) {
        await createAffectation(planning.id, aff.extra_id, aff.creneau_id, sem.site_id);
      }

      logger.info({
        msg: 'Proposition planning générée',
        semaineId: sem.id,
        siteId: sem.site_id,
        affectations: affectations.length,
      });
    } catch (err) {
      logger.error({ msg: 'Erreur génération planning', semaineId: sem.id, err: err.message });
    }
  }
}

export function startPlanningProposalJob() {
  cron.schedule('0 19 * * 4', generateProposalsForAllSites, { timezone: 'Europe/Paris' });
  logger.info({ msg: 'Job generatePlanningProposal planifié (jeudi 19h)' });
}
