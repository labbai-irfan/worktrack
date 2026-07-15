import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize, orgScope } from '../../middlewares/auth';
import { ok, created } from '../../utils/respond';
import { ApiError } from '../../utils/ApiError';
import { ProjectModule } from '../../models/Module';
import { Task } from '../../models/Task';
import { Issue } from '../../models/Issue';
import { WorkUpdate } from '../../models/WorkUpdate';
import { MODULE_STATUSES, PRIORITIES } from '../../constants/enums';
import { audit } from '../../services/audit.service';
import { recordActivity } from '../../services/activity.service';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const createSchema = z.object({
  projectId: objectId,
  name: z.string().min(2).max(120),
  key: z.string().min(2).max(12).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  description: z.string().max(3000).optional(),
  icon: z.string().max(40).optional(),
  color: z.string().max(20).optional(),
  ownerId: objectId.nullable().optional(),
  memberIds: z.array(objectId).max(200).optional(),
  status: z.enum(MODULE_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  startDate: z.coerce.date().nullable().optional(),
  targetDate: z.coerce.date().nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

const updateSchema = createSchema.partial().omit({ projectId: true, key: true }).extend({
  progress: z.number().min(0).max(100).optional(),
});

async function list(req: Request, res: Response) {
  const scope = orgScope(req);
  const filter: Record<string, unknown> = { ...scope, archivedAt: null };
  if (req.query.projectId) filter.projectId = req.query.projectId;
  const items = await ProjectModule.find(filter)
    .sort({ name: 1 })
    .populate('ownerId', 'displayName avatarUrl')
    .lean();
  return ok(res, items);
}

async function get(req: Request, res: Response) {
  const scope = orgScope(req);
  const module_ = await ProjectModule.findOne({ _id: req.params.id, ...scope })
    .populate('ownerId', 'displayName avatarUrl')
    .populate('memberIds', 'displayName avatarUrl jobTitle')
    .lean();
  if (!module_) throw ApiError.notFound('Module not found.');

  const [taskCounts, openIssues, blockedTasks, recentUpdates] = await Promise.all([
    Task.aggregate([
      { $match: { moduleId: module_._id, deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Issue.countDocuments({ moduleId: module_._id, status: { $nin: ['resolved', 'closed', 'duplicate', 'wont_fix'] }, deletedAt: null }),
    Task.countDocuments({ moduleId: module_._id, status: 'blocked', deletedAt: null }),
    WorkUpdate.find({ moduleId: module_._id, deletedAt: null }).sort({ workDate: -1 }).limit(5)
      .populate('userId', 'displayName avatarUrl').select('number title status workDate userId').lean(),
  ]);

  return ok(res, {
    ...module_,
    stats: {
      tasksByStatus: Object.fromEntries(taskCounts.map((t) => [t._id, t.count])),
      openIssues,
      blockedTasks,
    },
    recentUpdates,
  });
}

async function create(req: Request, res: Response) {
  const scope = orgScope(req);
  const key = String(req.body.key).toUpperCase();
  if (await ProjectModule.exists({ ...scope, projectId: req.body.projectId, key })) {
    throw ApiError.conflict(`Module key "${key}" already exists in this project.`);
  }
  const module_ = await ProjectModule.create({ ...scope, ...req.body, key, createdBy: req.user!._id });
  audit({ req, action: 'module.create', entityType: 'module', entityId: module_._id, newData: req.body });
  recordActivity({
    organizationId: scope.organizationId, projectId: module_.projectId, actorId: req.user!.id,
    action: 'module.created', entityType: 'module', entityId: module_._id, entityLabel: module_.name,
    link: `/projects/${module_.projectId}?module=${module_._id}`,
  });
  return created(res, module_.toObject(), 'Module created.');
}

async function update(req: Request, res: Response) {
  const scope = orgScope(req);
  const module_ = await ProjectModule.findOneAndUpdate(
    { _id: req.params.id, ...scope },
    { $set: req.body },
    { new: true, runValidators: true }
  ).lean();
  if (!module_) throw ApiError.notFound('Module not found.');
  audit({ req, action: 'module.update', entityType: 'module', entityId: module_._id, newData: req.body });
  return ok(res, module_, 'Module updated.');
}

async function archive(req: Request, res: Response) {
  const scope = orgScope(req);
  const module_ = await ProjectModule.findOneAndUpdate(
    { _id: req.params.id, ...scope },
    { archivedAt: new Date(), status: 'archived' },
    { new: true }
  ).lean();
  if (!module_) throw ApiError.notFound('Module not found.');
  audit({ req, action: 'module.archive', entityType: 'module', entityId: module_._id });
  return ok(res, null, 'Module archived.');
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('project.view'), asyncHandler(list));
router.get('/:id', authorize('project.view'), asyncHandler(get));
router.post('/', authorize('module.create'), validate(createSchema), asyncHandler(create));
router.patch('/:id', authorize('module.manage'), validate(updateSchema), asyncHandler(update));
router.delete('/:id', authorize('module.manage'), asyncHandler(archive));

export default router;
