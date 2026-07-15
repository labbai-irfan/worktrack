import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { ISSUE_TYPES, ISSUE_STATUSES, SEVERITIES, PRIORITIES, RESOLUTION_CODES, ENVIRONMENTS } from '../../constants/enums';
import * as ctrl from './issues.controller';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const errorSchema = z.object({
  message: z.string().max(2000).optional(),
  stackTrace: z.string().max(50_000).optional(),
  consoleLog: z.string().max(50_000).optional(),
  apiEndpoint: z.string().max(300).optional(),
  httpMethod: z.string().max(10).optional(),
  requestPayload: z.string().max(20_000).optional(),
  responseStatus: z.string().max(10).optional(),
  responseBody: z.string().max(20_000).optional(),
  browser: z.string().max(80).optional(),
  browserVersion: z.string().max(40).optional(),
  os: z.string().max(80).optional(),
  device: z.string().max(80).optional(),
  appVersion: z.string().max(40).optional(),
  buildVersion: z.string().max(40).optional(),
  commitHash: z.string().max(64).optional(),
  occurrenceCount: z.number().int().min(1).optional(),
});

const reproductionSchema = z.object({
  steps: z.string().max(10_000).optional(),
  expected: z.string().max(5000).optional(),
  actual: z.string().max(5000).optional(),
  frequency: z.enum(['always', 'often', 'sometimes', 'rare', 'once', '']).optional(),
  reproducible: z.enum(['yes', 'no', 'intermittent', 'unknown', '']).optional(),
});

const resolutionSchema = z.object({
  rootCause: z.string().max(10_000).optional(),
  fixSummary: z.string().max(10_000).optional(),
  solution: z.string().max(20_000).optional(),
  testingPerformed: z.string().max(10_000).optional(),
  regressionRisk: z.string().max(5000).optional(),
  code: z.enum(RESOLUTION_CODES).optional(),
});

const createSchema = z.object({
  projectId: objectId,
  moduleId: objectId.nullable().optional(),
  taskId: objectId.nullable().optional(),
  workUpdateId: objectId.nullable().optional(),
  title: z.string().min(3).max(300),
  description: z.string().max(30_000).optional(),
  type: z.enum(ISSUE_TYPES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeId: objectId.nullable().optional(),
  collaboratorIds: z.array(objectId).max(50).optional(),
  reviewerId: objectId.nullable().optional(),
  environment: z.enum(ENVIRONMENTS).optional(),
  affectedVersion: z.string().max(40).optional(),
  fixedVersion: z.string().max(40).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  labels: z.array(z.string().max(40)).max(20).optional(),
  watcherIds: z.array(objectId).max(100).optional(),
  error: errorSchema.optional(),
  reproduction: reproductionSchema.optional(),
  attachmentIds: z.array(objectId).max(50).optional(),
});

const updateSchema = createSchema.partial().omit({ projectId: true }).extend({
  resolution: resolutionSchema.optional(),
});

const transitionSchema = z.object({
  status: z.enum(ISSUE_STATUSES),
  note: z.string().max(5000).optional(),
  resolution: resolutionSchema.optional(),
});

const router = Router();
router.use(authenticate);

router.get('/', authorize('project.view'), asyncHandler(ctrl.list));
router.get('/:id', authorize('project.view'), asyncHandler(ctrl.get));
router.post('/', authorize('issue.create'), validate(createSchema), asyncHandler(ctrl.create));
router.patch('/:id', authorize('issue.create', 'issue.manage', 'issue.assign'), validate(updateSchema), asyncHandler(ctrl.update));
router.post('/:id/transition', authorize('issue.create', 'issue.manage'), validate(transitionSchema), asyncHandler(ctrl.transition));
router.delete('/:id', authorize('issue.manage'), asyncHandler(ctrl.remove));

export default router;
