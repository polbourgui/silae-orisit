import 'dotenv/config';
import logger from '../logger.js';
import { upsertExtra } from '../models/extrasModel.js';
import { SilaeApiError } from '../errors/index.js';

const SILAE_API_BASE_URL = process.env.SILAE_API_BASE_URL;
const SILAE_CLIENT_ID = process.env.SILAE_CLIENT_ID;
const SILAE_CLIENT_SECRET = process.env.SILAE_CLIENT_SECRET;
const SILAE_DOSSIER_SIRET = process.env.SILAE_DOSSIER_SIRET;

let cachedToken = null;
let tokenExpiresAt = 0;

export async function getSilaeToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: SILAE_CLIENT_ID,
    client_secret: SILAE_CLIENT_SECRET,
  });
  const res = await fetch(`${SILAE_API_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new SilaeApiError(`Silae OAuth2 error: ${res.status}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

export async function createContratSilae(contrat) {
  const token = await getSilaeToken();
  const payload = {
    DossierSiret: SILAE_DOSSIER_SIRET,
    MatriculeExtra: contrat.matricule_silae,
    DateDebut: contrat.date_debut,
    DateFin: contrat.date_fin,
    CodeEmploi: contrat.code_emploi,
    NbHeures: contrat.nb_heures,
    TauxHoraire: contrat.taux_horaire ?? null,
  };
  logger.info({ message: 'Silae createContrat payload', contrat_id: contrat.id, payload });
  const res = await fetch(`${SILAE_API_BASE_URL}/ExtraCreationManifestation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const responseData = await res.json().catch(() => ({}));
  logger.info({ message: 'Silae createContrat response', contrat_id: contrat.id, status: res.status, responseData });
  if (!res.ok) {
    throw new SilaeApiError(`Silae API error ${res.status}: ${JSON.stringify(responseData)}`);
  }
  return responseData;
}

export async function syncExtrasFromSilae(siteId) {
  const token = await getSilaeToken();
  logger.info({ message: 'Silae syncExtras start', siteId });
  const res = await fetch(`${SILAE_API_BASE_URL}/extras?DossierSiret=${SILAE_DOSSIER_SIRET}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new SilaeApiError(`Silae syncExtras error: ${res.status}`);
  }
  const extras = await res.json();
  const results = [];
  for (const extra of extras) {
    const upserted = await upsertExtra(siteId, {
      matricule_silae: extra.Matricule,
      nom: extra.Nom,
      prenom: extra.Prenom,
      email: extra.Email,
      telephone: extra.Telephone,
    });
    results.push(upserted);
  }
  logger.info({ message: 'Silae syncExtras done', siteId, count: results.length });
  return results;
}
