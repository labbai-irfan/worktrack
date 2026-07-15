import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { TASK_TYPES, TASK_STATUSES, PRIORITIES, ENVIRONMENTS } from '../../constants/enums';
import * as ctrl from './tasks.controller';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const gitSchema = z.object({
  repository: z.string().max(300).optional(),
  branch: z.string().max(200).optional(),
  commitHash: z.string().max(64).optional(),
  pullRequestUrl: z.string().url().or(z.literal('')).optional(),
});

const createSchema = z.object({
  projectId: objectId,
  moduleId: objectId.nullable().optional(),
  milestoneId: objectId.nullable().optional(),
  parentTaskId: objectId.nullable().optional(),
  title: z.string().min(2).max(300),
  description: z.string().max(20_000).optional(),
  type: z.enum(TASK_TYPES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeId: objectId.nullable().optional(),
  collaboratorIds: z.array(objectId).max(50).optional(),
  reporterId: objectId.optional(),
  reviewerId: objectId.nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  estimatedHours: z.number().min(0).max(10_000).nullable().optional(),
  progress: z.number().min(0).max(100).optional(),
  labels: z.array(z.string().max(40)).max(20).optional(),
  checklist: z.array(z.object({ text: z.string().max(300), done: z.boolean().default(false) })).max(100).optional(),
  dependencyIds: z.array(objectId).max(50).optional(),
  acceptanceCriteria: z.string().max(10_000).optional(),
  environment: z.enum(ENVIRONMENTS).optional(),
  git: gitSchema.optional(),
  watcherIds: z.array(objectId).max(100).optional(),
  blockedReason: z.string().max(2000).optional(),
});

const updateSchema = createSchema.partial().omit({ projectId: true });

const reorderSchema = z.object({
  items: z.array(z.object({
    id: objectId,
    status: z.enum(TASK_STATUSES),
    order: z.number().int().min(0),
  })).min(1).max(500),
});

const bulkSchema = z.object({
  ids: z.array(objectId).min(1).max(200),
  set: z.object({
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assigneeId: objectId.nullable().optional(),
    moduleId: objectId.nullable().optional(),
    milestoneId: objectId.nullable().optional(),
    labels: z.array(z.string().max(40)).optional(),
  }),
});

const router = Router();
router.use(authenticate);

router.get('/', authorize('project.view'), asyncHandler(ctrl.list));
router.get('/my-work', authorize('project.view'), asyncHandler(ctrl.myWork));
router.post('/', authorize('task.create'), validate(createSchema), asyncHandler(ctrl.create));
router.patch('/reorder', authorize('task.update'), validate(reorderSchema), asyncHandler(ctrl.reorder));
router.post('/bulk', authorize('task.assign', 'task.update'), validate(bulkSchema), asyncHandler(ctrl.bulkUpdate));
router.get('/:id', authorize('project.view'), asyncHandler(ctrl.get));
router.patch('/:id', authorize('task.update'), validate(updateSchema), asyncHandler(ctrl.update));
router.delete('/:id', authorize('task.delete'), asyncHandler(ctrl.remove));

export default router;
