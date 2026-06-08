import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import extrasRouter from './routes/extras.js';
import disponibilitesRouter from './routes/disponibilites.js';
import planningsRouter from './routes/plannings.js';
import contratsRouter from './routes/contrats.js';
import errorHandler from './middleware/errorHandler.js';
import logger from './logger.js';
import { startSendDispoJob } from './jobs/sendDispoLinks.js';
import { startPlanningProposalJob } from './jobs/generatePlanningProposal.js';

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

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/extras', extrasRouter);
app.use('/dispos', disponibilitesRouter);
app.use('/plannings', planningsRouter);
app.use('/contrats', contratsRouter);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info({ message: `silae-orisit listening on port ${PORT}` });
    startSendDispoJob();
    startPlanningProposalJob();
  });
}

export default app;
