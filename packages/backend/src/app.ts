import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRoutes } from './routes/auth.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { identityRoutes } from './routes/identity.routes.js';
import { patientRoutes } from './routes/patient.routes.js';
import { bloodRequestRoutes } from './routes/blood-request.routes.js';
import { donorRoutes } from './routes/donor.routes.js';
import { medicineRequestRoutes } from './routes/medicine-request.routes.js';
import { adminRoutes, notificationRoutes } from './routes/admin.routes.js';
import { hospitalRoutes } from './routes/hospital.routes.js';
import { volunteerRoutes } from './routes/volunteer.routes.js';
import {
  createServiceContainer,
  ServiceContainer,
} from './services/service-container.js';

export function createApp(): {
  app: express.Application;
  services: ServiceContainer;
} {
  const app = express();
  const services = createServiceContainer(config);

  // Security middleware
  app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [config.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);

  // Logging
  app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // Body parsing — catch malformed JSON and return a structured error instead of crashing
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    express.json({ limit: '10mb' })(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: { message: 'Invalid JSON body', code: 'INVALID_JSON' } });
        return;
      }
      next();
    });
  });
  app.use(express.urlencoded({ extended: true }));

  // Make services available on requests
  app.set('services', services);

  // Routes
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/identity', identityRoutes);
  app.use('/api/patients', patientRoutes);
  app.use('/api/blood-requests', bloodRequestRoutes);
  app.use('/api/donors', donorRoutes);
  app.use('/api/medicine-requests', medicineRequestRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/hospitals', hospitalRoutes);
  app.use('/api/volunteers', volunteerRoutes);

  // 404 handler — unknown routes return JSON, not Express default HTML
  app.use((_req: express.Request, res: express.Response) => {
    res.status(404).json({ error: { message: 'Route not found', code: 'NOT_FOUND' } });
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  return { app, services };
}
