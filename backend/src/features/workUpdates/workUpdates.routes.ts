import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { WORK_TYPES, WORK_PROGRESS_STATUSES, ENVIRONMENTS } from '../../constants/enums';
import * as ctrl from './workUpdates.controller';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const timeSchema = z.object({
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal('')).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal('')).optional(),
  breakMinutes: z.number().int().min(0).max(1440).optional(),
  minutesSpent: z.number().int().min(0).max(1440).optional(),
  billable: z.boolean().optional(),
  source: z.enum(['manual', 'timer']).optional(),
});

const technicalSchema = z.object({
  environment: z.enum(ENVIRONMENTS).optional(),
  repository: z.string().max(300).optional(),
  branch: z.string().max(200).optional(),
  commitHash: z.string().max(64).optional(),
  pullRequestUrl: z.string().url().or(z.literal('')).optional(),
  deploymentUrl: z.string().url().or(z.literal('')).optional(),
  apiEndpoint: z.string().max(300).optional(),
  httpMethod: z.string().max(10).optional(),
  httpStatus: z.string().max(10).optional(),
  databaseChanges: z.string().max(5000).optional(),
  migrationNotes: z.string().max(5000).optional(),
  notes: z.string().max(10_000).optional(),
});

const beforeAfterSchema = z.object({
  beforeAttachmentId: objectId,
  afterAttachmentId: objectId,
  caption: z.string().max(300).optional(),
});

const createSchema = z.object({
  projectId: objectId,
  moduleId: objectId.nullable().optional(),
  taskId: objectId.nullable().optional(),
  issueId: objectId.nullable().optional(),
  milestoneId: objectId.nullable().optional(),
  title: z.string().min(3).max(300),
  description: z.string().max(30_000).optional(),
  workType: z.enum(WORK_TYPES).optional(),
  progressStatus: z.enum(WORK_PROGRESS_STATUSES).optional(),
  progress: z.number().min(0).max(100).optional(),
  workDate: z.coerce.date(),
  planned: z.string().max(10_000).optional(),
  implemented: z.string().max(20_000).optional(),
  changed: z.string().max(10_000).optional(),
  remaining: z.string().max(10_000).optional(),
  outcome: z.string().max(10_000).optional(),
  blockers: z.string().max(10_000).optional(),
  dependencies: z.string().max(5000).optional(),
  assistanceRequired: z.string().max(5000).optional(),
  nextAction: z.string().max(5000).optional(),
  time: timeSchema.optional(),
  technical: technicalSchema.optional(),
  attachmentIds: z.array(objectId).max(50).optional(),
  beforeAfter: z.array(beforeAfterSchema).max(20).optional(),
  watcherIds: z.array(objectId).max(100).optional(),
});

const updateSchema = createSchema.partial();

const reviewSchema = z.object({
  action: z.enum(['start_review', 'approve', 'request_changes', 'reject']),
  comment: z.string().max(5000).optional(),
});

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(ctrl.list));
router.get('/pending-reviews', authorize('work_update.review', 'work_update.approve'), asyncHandler(ctrl.pendingReviews));
router.get('/:id', asyncHandler(ctrl.get));
router.post('/', authorize('work_update.create'), validate(createSchema), asyncHandler(ctrl.create));
router.patch('/:id', authorize('work_update.edit_own'), validate(updateSchema), asyncHandler(ctrl.update));
router.post('/:id/submit', authorize('work_update.create'), asyncHandler(ctrl.submit));
router.post('/:id/review', authorize('work_update.review', 'work_update.approve'), validate(reviewSchema), asyncHandler(ctrl.review));
router.delete('/:id', asyncHandler(ctrl.remove));

export default router;
