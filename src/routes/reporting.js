import { Router } from 'express';
import { requireManagerAuth } from '../middleware/auth.js';
import siteScope from '../middleware/siteScope.js';
import { assertISOWeek } from '../utils/validators.js';
import { ValidationError } from '../errors/index.js';
import pool from '../models/db.js';

const router = Router();
router.use(requireManagerAuth, siteScope);

const ISO_WEEK_RE = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

// Calcul des heures d'un créneau en tenant compte des shifts nocturnes
const HOURS_EXPR = `
  CASE
    WHEN c.heure_fin > c.heure_debut
      THEN EXTRACT(EPOCH FROM (c.heure_fin::TIME - c.heure_debut::TIME)) / 3600
    ELSE
      24 - EXTRACT(EPOCH FROM (c.heure_debut::TIME - c.heure_fin::TIME)) / 3600
  END * c.nb_postes
`;

// GET /reporting/activite?isoWeekFrom=2026-W01&isoWeekTo=2026-W26
router.get('/activite', async (req, res, next) => {
  try {
    const { isoWeekFrom, isoWeekTo } = req.query;
    if (!isoWeekFrom || !ISO_WEEK_RE.test(isoWeekFrom)) throw new ValidationError('isoWeekFrom requis (format YYYY-Wnn)');
    if (!isoWeekTo   || !ISO_WEEK_RE.test(isoWeekTo))   throw new ValidationError('isoWeekTo requis (format YYYY-Wnn)');
    if (isoWeekFrom > isoWeekTo) throw new ValidationError('isoWeekFrom doit être antérieure à isoWeekTo');

    // Totaux par type d'activité
    const { rows: parActivite } = await pool.query(
      `SELECT
         COALESCE(c.type_activite, 'non_defini') AS type_activite,
         COUNT(*)::int                            AS nb_creneaux,
         ROUND(SUM(${HOURS_EXPR})::numeric, 2)   AS total_heures,
         SUM(c.nb_postes)::int                   AS nb_postes_total
       FROM creneaux c
       JOIN semaines s ON s.id = c.semaine_id
       WHERE s.site_id = $1
         AND s.iso_week >= $2
         AND s.iso_week <= $3
       GROUP BY COALESCE(c.type_activite, 'non_defini')
       ORDER BY total_heures DESC`,
      [req.siteId, isoWeekFrom, isoWeekTo]
    );

    // Détail par semaine × type d'activité
    const { rows: parSemaine } = await pool.query(
      `SELECT
         s.iso_week,
         COALESCE(c.type_activite, 'non_defini') AS type_activite,
         COUNT(*)::int                            AS nb_creneaux,
         ROUND(SUM(${HOURS_EXPR})::numeric, 2)   AS total_heures
       FROM creneaux c
       JOIN semaines s ON s.id = c.semaine_id
       WHERE s.site_id = $1
         AND s.iso_week >= $2
         AND s.iso_week <= $3
       GROUP BY s.iso_week, COALESCE(c.type_activite, 'non_defini')
       ORDER BY s.iso_week, type_activite`,
      [req.siteId, isoWeekFrom, isoWeekTo]
    );

    res.json({ ok: true, data: { parActivite, parSemaine, isoWeekFrom, isoWeekTo } });
  } catch (err) {
    next(err);
  }
});

// GET /reporting/activite/export.csv
router.get('/activite/export.csv', async (req, res, next) => {
  try {
    const { isoWeekFrom, isoWeekTo } = req.query;
    if (!isoWeekFrom || !ISO_WEEK_RE.test(isoWeekFrom)) throw new ValidationError('isoWeekFrom requis (format YYYY-Wnn)');
    if (!isoWeekTo   || !ISO_WEEK_RE.test(isoWeekTo))   throw new ValidationError('isoWeekTo requis (format YYYY-Wnn)');

    const { rows } = await pool.query(
      `SELECT
         s.iso_week                              AS semaine,
         c.jour,
         c.slot_label,
         c.heure_debut,
         c.heure_fin,
         COALESCE(c.type_activite, 'non_defini') AS type_activite,
         c.nb_postes,
         ROUND((${HOURS_EXPR})::numeric, 2)     AS heures_totales,
         p.libelle                              AS poste,
         pdv.nom                               AS salle
       FROM creneaux c
       JOIN semaines s ON s.id = c.semaine_id
       LEFT JOIN postes p ON p.id = c.poste_id AND p.site_id = s.site_id
       LEFT JOIN points_de_vente pdv ON pdv.id = c.point_de_vente_id AND pdv.site_id = s.site_id
       WHERE s.site_id = $1
         AND s.iso_week >= $2
         AND s.iso_week <= $3
       ORDER BY s.iso_week, c.jour, c.heure_debut`,
      [req.siteId, isoWeekFrom, isoWeekTo]
    );

    const header = 'Semaine;Jour;Libellé;Début;Fin;Type activité;Nb postes;Heures totales;Poste;Salle';
    const csvLines = rows.map(r =>
      [r.semaine, r.jour, r.slot_label, r.heure_debut, r.heure_fin,
       r.type_activite, r.nb_postes, r.heures_totales, r.poste ?? '', r.salle ?? ''].join(';')
    );
    const csv = [header, ...csvLines].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reporting_activite_${isoWeekFrom}_${isoWeekTo}.csv"`);
    res.send('﻿' + csv); // BOM UTF-8 pour Excel
  } catch (err) {
    next(err);
  }
});

export default router;
