import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize, orgScope } from '../../middlewares/auth';
import { ok, created } from '../../utils/respond';
import { ApiError } from '../../utils/ApiError';
import { Milestone } from '../../models/Milestone';
import { MILESTONE_STATUSES } from '../../constants/enums';
import { audit } from '../../services/audit.service';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const createSchema = z.object({
  projectId: objectId,
  name: z.string().min(2).max(160),
  description: z.string().max(3000).optional(),
  startDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  status: z.enum(MILESTONE_STATUSES).optional(),
});

const updateSchema = createSchema.partial().omit({ projectId: true }).extend({
  progress: z.number().min(0).max(100).optional(),
});

async function list(req: Request, res: Response) {
  const scope = orgScope(req);
  const filter: Record<string, unknown> = { ...scope };
  if (req.query.projectId) filter.projectId = req.query.projectId;
  const items = await Milestone.find(filter).sort({ dueDate: 1 }).lean();
  return ok(res, items);
}

/**
 * GET /milestones/alerts — upcoming (next 7 days) and overdue milestones.
 * Scoped to a project when projectId is given, otherwise organization-wide
 * (used for manager dashboards).
 */
async function alerts(req: Request, res: Response) {
  const scope = orgScope(req);
  const filter: Record<string, unknown> = { ...scope, status: { $ne: 'completed' } };
  if (req.query.projectId) filter.projectId = req.query.projectId;
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);

  const [overdue, upcoming] = await Promise.all([
    Milestone.find({ ...filter, dueDate: { $lt: now, $ne: null } })
      .sort({ dueDate: 1 }).limit(50).populate('projectId', 'name key color').lean(),
    Milestone.find({ ...filter, dueDate: { $gte: now, $lte: weekAhead } })
      .sort({ dueDate: 1 }).limit(50).populate('projectId', 'name key color').lean(),
  ]);
  return ok(res, { overdue, upcoming });
}

async function create(req: Request, res: Response) {
  const scope = orgScope(req);
  const milestone = await Milestone.create({ ...scope, ...req.body, createdBy: req.user!._id });
  audit({ req, action: 'milestone.create', entityType: 'milestone', entityId: milestone._id, newData: req.body });
  return created(res, milestone.toObject(), 'Milestone created.');
}

async function update(req: Request, res: Response) {
  const scope = orgScope(req);
  const updates: Record<string, unknown> = { ...req.body };
  if (req.body.status === 'completed') updates.completedAt = new Date();
  const milestone = await Milestone.findOneAndUpdate({ _id: req.params.id, ...scope }, { $set: updates }, { new: true }).lean();
  if (!milestone) throw ApiError.notFound('Milestone not found.');
  audit({ req, action: 'milestone.update', entityType: 'milestone', entityId: milestone._id, newData: req.body });
  return ok(res, milestone, 'Milestone updated.');
}

async function remove(req: Request, res: Response) {
  const scope = orgScope(req);
  const milestone = await Milestone.findOneAndDelete({ _id: req.params.id, ...scope }).lean();
  if (!milestone) throw ApiError.notFound('Milestone not found.');
  audit({ req, action: 'milestone.delete', entityType: 'milestone', entityId: milestone._id, previousData: milestone });
  return ok(res, null, 'Milestone deleted.');
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('project.view'), asyncHandler(list));
router.get('/alerts', authorize('project.view'), asyncHandler(alerts));
router.post('/', authorize('milestone.manage'), validate(createSchema), asyncHandler(create));
router.patch('/:id', authorize('milestone.manage'), validate(updateSchema), asyncHandler(update));
router.delete('/:id', authorize('milestone.manage'), asyncHandler(remove));

export default router;
