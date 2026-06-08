import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import logger from './logger.js';
import errorHandler from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import extrasRoutes from './routes/extras.js';
import disponibilitesRoutes from './routes/disponibilites.js';
import planningsRoutes from './routes/plannings.js';
import contratsRoutes from './routes/contrats.js';
import { startSendDispoJob } from './jobs/sendDispoLinks.js';
import { startPlanningProposalJob } from './jobs/generatePlanningProposal.js';

const app = express();
const PORT = process.env.PORT ?? 3000;

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/extras', extrasRoutes);
app.use('/dispos', disponibilitesRoutes);
app.use('/plannings', planningsRoutes);
app.use('/contrats', contratsRoutes);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  startSendDispoJob();
  startPlanningProposalJob();
  app.listen(PORT, () => {
    logger.info({ msg: 'Serveur démarré', port: PORT, env: process.env.NODE_ENV });
  });
}

export default app;
