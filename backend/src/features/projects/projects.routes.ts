import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { PROJECT_STATUSES, PROJECT_HEALTH, PRIORITIES } from '../../constants/enums';
import * as ctrl from './projects.controller';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const memberSchema = z.object({
  userId: objectId,
  role: z.enum(['manager', 'lead', 'member', 'viewer']).default('member'),
});

const createSchema = z.object({
  name: z.string().min(2).max(160),
  key: z.string().min(2).max(10).regex(/^[a-zA-Z][a-zA-Z0-9]*$/, 'Key must be alphanumeric and start with a letter.'),
  description: z.string().max(5000).optional(),
  client: z.string().max(160).optional(),
  managerId: objectId.optional(),
  members: z.array(memberSchema).max(200).optional(),
  startDate: z.coerce.date().nullable().optional(),
  targetDate: z.coerce.date().nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(40).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  repositoryUrl: z.string().url().or(z.literal('')).optional(),
  stagingUrl: z.string().url().or(z.literal('')).optional(),
  productionUrl: z.string().url().or(z.literal('')).optional(),
  documentationUrl: z.string().url().or(z.literal('')).optional(),
  visibility: z.enum(['private', 'organization']).optional(),
});

const updateSchema = createSchema.partial().omit({ key: true, members: true }).extend({
  progress: z.number().min(0).max(100).optional(),
  health: z.enum(PROJECT_HEALTH).optional(),
});

const membersSchema = z.object({
  members: z.array(memberSchema).max(200),
  managerId: objectId.optional(),
});

const router = Router();
router.use(authenticate);

router.get('/', authorize('project.view'), asyncHandler(ctrl.list));
router.get('/:id', authorize('project.view'), asyncHandler(ctrl.get));
router.get('/:id/health', authorize('project.view'), asyncHandler(ctrl.health));
router.post('/', authorize('project.create'), validate(createSchema), asyncHandler(ctrl.create));
router.patch('/:id', authorize('project.update'), validate(updateSchema), asyncHandler(ctrl.update));
router.post('/:id/archive', authorize('project.archive'), asyncHandler(ctrl.archive));
router.put('/:id/members', authorize('project.manage_members'), validate(membersSchema), asyncHandler(ctrl.updateMembers));

export default router;
