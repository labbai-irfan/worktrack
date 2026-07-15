import rateLimit from 'express-rate-limit';
import { env, isTest } from '../config/env';

const skip = () => isTest;

export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { success: false, message: 'Too many requests. Please try again later.', code: 'RATE_LIMITED', errors: [] },
});

export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { success: false, message: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED', errors: [] },
});
