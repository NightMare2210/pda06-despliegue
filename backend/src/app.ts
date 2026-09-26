import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import empleadosRoutes from './routes/empleados.routes.js';
import { errorHandler } from './middlewares/error-handler.middleware.js';

const app = express();
app.disable('x-powered-by');

app.use(cors());
app.set('trust proxy', 1);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'pda03-api', version: '1.1.0', env: process.env.NODE_ENV ?? 'development' });
});
app.use('/api/v1', empleadosRoutes);
app.use(errorHandler);

export default app;
