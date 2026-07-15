import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/auth';
import { authLimiter } from '../../middlewares/rateLimit';
import * as ctrl from './auth.controller';
import {
  registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema,
  changePasswordSchema, acceptInvitationSchema, updateProfileSchema,
} from './auth.validation';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(ctrl.register));
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(ctrl.login));
router.post('/refresh', asyncHandler(ctrl.refresh));
router.post('/logout', asyncHandler(ctrl.logout));
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), asyncHandler(ctrl.forgotPassword));
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), asyncHandler(ctrl.resetPassword));
router.get('/invitations/:token', asyncHandler(ctrl.getInvitation));
router.post('/accept-invitation', authLimiter, validate(acceptInvitationSchema), asyncHandler(ctrl.acceptInvitation));

router.use(authenticate);
router.get('/me', asyncHandler(ctrl.me));
router.patch('/me', validate(updateProfileSchema), asyncHandler(ctrl.updateProfile));
router.post('/change-password', validate(changePasswordSchema), asyncHandler(ctrl.changePassword));
router.get('/sessions', asyncHandler(ctrl.listSessions));
router.delete('/sessions/:id', asyncHandler(ctrl.revokeSession));
router.delete('/sessions', asyncHandler(ctrl.revokeAllSessions));

export default router;
