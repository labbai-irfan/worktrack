import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env, isTest } from './config/env';
import { logger } from './config/logger';
import { requestId } from './middlewares/requestId';
import { apiLimiter } from './middlewares/rateLimit';
import { notFoundHandler, errorHandler } from './middlewares/error';

import authRoutes from './features/auth/auth.routes';
import organizationRoutes from './features/organizations/organizations.routes';
import employeeRoutes from './features/employees/employees.routes';
import teamRoutes from './features/teams/teams.routes';
import projectRoutes from './features/projects/projects.routes';
import moduleRoutes from './features/modules/modules.routes';
import milestoneRoutes from './features/milestones/milestones.routes';
import taskRoutes from './features/tasks/tasks.routes';
import workUpdateRoutes from './features/workUpdates/workUpdates.routes';
import attachmentRoutes from './features/attachments/attachments.routes';
import issueRoutes from './features/issues/issues.routes';
import commentRoutes from './features/comments/comments.routes';
import timeEntryRoutes from './features/timeEntries/timeEntries.routes';
import reportRoutes from './features/reports/reports.routes';
import notificationRoutes from './features/notifications/notifications.routes';
import activityRoutes from './features/activities/activities.routes';
import auditLogRoutes from './features/auditLogs/auditLogs.routes';
import releaseRoutes from './features/releases/releases.routes';
import analyticsRoutes from './features/analytics/analytics.routes';
import searchRoutes from './features/search/search.routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(requestId);
  if (!isTest) {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
  }

  app.get('/health', (_req, res) => res.json({ status: 'ok', name: env.APP_NAME, version: env.API_VERSION }));

  const api = express.Router();
  api.use(apiLimiter);
  api.use('/auth', authRoutes);
  api.use('/organizations', organizationRoutes);
  api.use('/employees', employeeRoutes);
  api.use('/teams', teamRoutes);
  api.use('/projects', projectRoutes);
  api.use('/modules', moduleRoutes);
  api.use('/milestones', milestoneRoutes);
  api.use('/tasks', taskRoutes);
  api.use('/work-updates', workUpdateRoutes);
  api.use('/attachments', attachmentRoutes);
  api.use('/issues', issueRoutes);
  api.use('/comments', commentRoutes);
  api.use('/time-entries', timeEntryRoutes);
  api.use('/reports', reportRoutes);
  api.use('/notifications', notificationRoutes);
  api.use('/activities', activityRoutes);
  api.use('/audit-logs', auditLogRoutes);
  api.use('/releases', releaseRoutes);
  api.use('/analytics', analyticsRoutes);
  api.use('/search', searchRoutes);

  app.use(`/api/${env.API_VERSION}`, api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
