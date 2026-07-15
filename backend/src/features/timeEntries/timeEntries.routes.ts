import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize, orgScope } from '../../middlewares/auth';
import { ok, created } from '../../utils/respond';
import { ApiError } from '../../utils/ApiError';
import { TimeEntry } from '../../models/TimeEntry';
import { Task } from '../../models/Task';
import { Organization } from '../../models/Organization';
import { getPagination, pageMeta } from '../../utils/pagination';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const linkFields = {
  projectId: objectId.nullable().optional(),
  moduleId: objectId.nullable().optional(),
  taskId: objectId.nullable().optional(),
  issueId: objectId.nullable().optional(),
  workUpdateId: objectId.nullable().optional(),
};

const manualSchema = z.object({
  ...linkFields,
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  notes: z.string().max(2000).optional(),
  billable: z.boolean().optional(),
});

const startSchema = z.object({
  ...linkFields,
  notes: z.string().max(2000).optional(),
  billable: z.boolean().optional(),
});

const correctionSchema = z.object({
  minutes: z.number().int().min(1).max(1440),
  reason: z.string().min(3).max(500),
});

async function addLoggedMinutes(taskId: unknown, minutes: number) {
  if (taskId && minutes > 0) {
    await Task.updateOne({ _id: taskId }, { $inc: { loggedMinutes: minutes } });
  }
}

async function list(req: Request, res: Response) {
  const scope = orgScope(req);
  const { page, limit, skip } = getPagination(req, '-startedAt');
  const filter: Record<string, unknown> = { ...scope };
  const canManage = req.user!.permissions.includes('time.manage');
  filter.userId = canManage && req.query.userId ? req.query.userId : req.user!._id;
  if (req.query.projectId) filter.projectId = req.query.projectId;
  if (req.query.taskId) filter.taskId = req.query.taskId;
  if (req.query.from || req.query.to) {
    const range: Record<string, Date> = {};
    if (req.query.from) range.$gte = new Date(String(req.query.from));
    if (req.query.to) range.$lte = new Date(String(req.query.to));
    filter.startedAt = range;
  }
  const [items, total] = await Promise.all([
    TimeEntry.find(filter).sort({ startedAt: -1 }).skip(skip).limit(limit)
      .populate('projectId', 'name key color')
      .populate('taskId', 'number title')
      .lean(),
    TimeEntry.countDocuments(filter),
  ]);
  return ok(res, items, 'OK', pageMeta(page, limit, total));
}

/** GET /time-entries/active — restore a running timer after refresh. */
async function active(req: Request, res: Response) {
  const scope = orgScope(req);
  const entry = await TimeEntry.findOne({ ...scope, userId: req.user!._id, running: true })
    .populate('projectId', 'name key color')
    .populate('taskId', 'number title')
    .lean();
  return ok(res, entry);
}

async function createManual(req: Request, res: Response) {
  const scope = orgScope(req);
  const { startedAt, endedAt } = req.body;
  if (endedAt <= startedAt) throw ApiError.validation([{ field: 'endedAt', message: 'End time must be after start time.' }]);
  const minutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000);
  const entry = await TimeEntry.create({
    ...scope, ...req.body, userId: req.user!._id, minutes, source: 'manual', running: false,
  });
  await addLoggedMinutes(entry.taskId, minutes);
  return created(res, entry.toObject(), 'Time entry added.');
}

/** POST /time-entries/start — server-side timestamps. */
async function startTimer(req: Request, res: Response) {
  const scope = orgScope(req);
  const org = await Organization.findById(scope.organizationId).lean();
  if (!org?.settings?.allowMultipleTimers) {
    const runningTimer = await TimeEntry.findOne({ ...scope, userId: req.user!._id, running: true }).lean();
    if (runningTimer) throw ApiError.conflict('You already have a running timer. Stop it before starting a new one.');
  }
  const entry = await TimeEntry.create({
    ...scope, ...req.body, userId: req.user!._id, startedAt: new Date(), source: 'timer', running: true,
  });
  return created(res, entry.toObject(), 'Timer started.');
}

/** POST /time-entries/:id/stop */
async function stopTimer(req: Request, res: Response) {
  const scope = orgScope(req);
  const entry = await TimeEntry.findOne({ _id: req.params.id, ...scope, userId: req.user!._id, running: true });
  if (!entry) throw ApiError.notFound('Running timer not found.');
  entry.endedAt = new Date();
  entry.minutes = Math.max(1, Math.round((entry.endedAt.getTime() - entry.startedAt.getTime()) / 60_000));
  entry.running = false;
  await entry.save();
  await addLoggedMinutes(entry.taskId, entry.minutes);
  return ok(res, entry.toObject(), 'Timer stopped.');
}

/** PATCH /time-entries/:id/correct — manager correction with audit trail. */
async function correct(req: Request, res: Response) {
  const scope = orgScope(req);
  const entry = await TimeEntry.findOne({ _id: req.params.id, ...scope, running: false });
  if (!entry) throw ApiError.notFound('Time entry not found.');
  const isOwner = String(entry.userId) === req.user!.id;
  const canManage = req.user!.permissions.includes('time.manage');
  if (!isOwner && !canManage) throw ApiError.forbidden();
  const previousMinutes = entry.minutes;
  entry.corrections.push({
    byId: req.user!._id, reason: req.body.reason,
    previousMinutes, newMinutes: req.body.minutes, at: new Date(),
  });
  entry.minutes = req.body.minutes;
  await entry.save();
  await addLoggedMinutes(entry.taskId, req.body.minutes - previousMinutes);
  return ok(res, entry.toObject(), 'Time entry corrected.');
}

async function remove(req: Request, res: Response) {
  const scope = orgScope(req);
  const entry = await TimeEntry.findOne({ _id: req.params.id, ...scope });
  if (!entry) throw ApiError.notFound('Time entry not found.');
  const isOwner = String(entry.userId) === req.user!.id;
  if (!isOwner && !req.user!.permissions.includes('time.manage')) throw ApiError.forbidden();
  await entry.deleteOne();
  await addLoggedMinutes(entry.taskId, -entry.minutes);
  return ok(res, null, 'Time entry deleted.');
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('time.track'), asyncHandler(list));
router.get('/active', authorize('time.track'), asyncHandler(active));
router.post('/', authorize('time.track'), validate(manualSchema), asyncHandler(createManual));
router.post('/start', authorize('time.track'), validate(startSchema), asyncHandler(startTimer));
router.post('/:id/stop', authorize('time.track'), asyncHandler(stopTimer));
router.patch('/:id/correct', authorize('time.track'), validate(correctionSchema), asyncHandler(correct));
router.delete('/:id', authorize('time.track'), asyncHandler(remove));

export default router;
