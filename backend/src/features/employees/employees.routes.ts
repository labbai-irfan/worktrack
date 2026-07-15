import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { passwordSchema } from '../auth/auth.validation';
import * as ctrl from './employees.controller';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id.');

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  roleId: objectId,
  departmentId: objectId.nullable().optional(),
  teamId: objectId.nullable().optional(),
  jobTitle: z.string().max(120).optional(),
});

const updateSchema = z.object({
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().max(60).optional(),
  displayName: z.string().min(1).max(120).optional(),
  jobTitle: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  departmentId: objectId.nullable().optional(),
  teamId: objectId.nullable().optional(),
  managerId: objectId.nullable().optional(),
  roleId: objectId.optional(),
  status: z.enum(['invited', 'active', 'inactive', 'on_leave', 'suspended', 'exited']).optional(),
  joiningDate: z.coerce.date().nullable().optional(),
  workLocation: z.string().max(120).optional(),
  timezone: z.string().max(60).optional(),
  skills: z.array(z.string().max(40)).max(30).optional(),
  employeeCode: z.string().max(20).optional(),
  avatarUrl: z.string().url().or(z.literal('')).optional(),
});

const router = Router();
router.use(authenticate);

router.get('/', authorize('employee.view'), asyncHandler(ctrl.list));
router.get('/invitations', authorize('employee.invite', 'employee.manage'), asyncHandler(ctrl.listInvitations));
router.post('/invite', authorize('employee.invite'), validate(inviteSchema), asyncHandler(ctrl.invite));
router.delete('/invitations/:id', authorize('employee.invite', 'employee.manage'), asyncHandler(ctrl.revokeInvitation));
router.get('/:id', authorize('employee.view'), asyncHandler(ctrl.get));
router.patch('/:id', authorize('employee.manage'), validate(updateSchema), asyncHandler(ctrl.update));
router.post('/:id/activate', authorize('employee.deactivate', 'employee.manage'), asyncHandler(ctrl.setActive));
router.post('/:id/deactivate', authorize('employee.deactivate', 'employee.manage'), asyncHandler(ctrl.setActive));
router.post(
  '/:id/reset-password',
  authorize('employee.manage'),
  validate(z.object({ password: passwordSchema })),
  asyncHandler(ctrl.adminResetPassword)
);

export default router;
