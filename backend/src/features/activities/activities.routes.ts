import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize, orgScope } from '../../middlewares/auth';
import { ok } from '../../utils/respond';
import { Activity } from '../../models/Activity';
import { getPagination, pageMeta } from '../../utils/pagination';

async function list(req: Request, res: Response) {
  const scope = orgScope(req);
  const { page, limit, skip } = getPagination(req, '-createdAt', 100);
  const filter: Record<string, unknown> = { ...scope };
  if (req.query.projectId) filter.projectId = req.query.projectId;
  if (req.query.actorId) filter.actorId = req.query.actorId === 'me' ? req.user!._id : req.query.actorId;
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.entityId) filter.entityId = req.query.entityId;
  const [items, total] = await Promise.all([
    Activity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('actorId', 'displayName avatarUrl').lean(),
    Activity.countDocuments(filter),
  ]);
  return ok(res, items, 'OK', pageMeta(page, limit, total));
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('project.view'), asyncHandler(list));

export default router;
