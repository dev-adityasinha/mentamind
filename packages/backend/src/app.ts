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
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

  // Logging
  app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
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

  // Global error handler (must be last)
  app.use(errorHandler);

  return { app, services };
}
