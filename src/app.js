import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRouter from './routes/auth.js';
import extrasRouter from './routes/extras.js';
import disponibilitesRouter from './routes/disponibilites.js';
import planningsRouter from './routes/plannings.js';
import contratsRouter from './routes/contrats.js';
import creneauxRouter from './routes/creneaux.js';
import postesRouter from './routes/postes.js';
import presetsRouter from './routes/presets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
import errorHandler from './middleware/errorHandler.js';
import logger from './logger.js';
import { startSendDispoJob } from './jobs/sendDispoLinks.js';
import { startPlanningProposalJob } from './jobs/generatePlanningProposal.js';
import { applyIncrementalMigrations } from './models/migrate.js';

const app = express();
const PORT = process.env.PORT ?? 3000;

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/extras', extrasRouter);
app.use('/dispos', disponibilitesRouter);
app.use('/plannings', planningsRouter);
app.use('/contrats', contratsRouter);
app.use('/creneaux', creneauxRouter);
app.use('/postes', postesRouter);
app.use('/presets', presetsRouter);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  applyIncrementalMigrations().then(() => {
    app.listen(PORT, () => {
      logger.info({ message: `silae-orisit listening on port ${PORT}` });
      startSendDispoJob();
      startPlanningProposalJob();
    });
  }).catch(err => {
    logger.error({ message: 'incremental migrations failed', err });
    process.exit(1);
  });
}

export default app;
