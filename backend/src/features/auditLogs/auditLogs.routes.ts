import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize, orgScope } from '../../middlewares/auth';
import { ok } from '../../utils/respond';
import { AuditLog } from '../../models/AuditLog';
import { getPagination, pageMeta } from '../../utils/pagination';

/** Read-only: audit logs cannot be modified through any API. */
async function list(req: Request, res: Response) {
  const scope = orgScope(req);
  const { page, limit, skip } = getPagination(req, '-createdAt', 100);
  const filter: Record<string, unknown> = { ...scope };
  if (req.query.action) filter.action = { $regex: String(req.query.action), $options: 'i' };
  if (req.query.actorId) filter.actorId = req.query.actorId;
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.from || req.query.to) {
    const range: Record<string, Date> = {};
    if (req.query.from) range.$gte = new Date(String(req.query.from));
    if (req.query.to) range.$lte = new Date(String(req.query.to));
    filter.createdAt = range;
  }
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('actorId', 'displayName avatarUrl email').lean(),
    AuditLog.countDocuments(filter),
  ]);
  return ok(res, items, 'OK', pageMeta(page, limit, total));
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('audit.view'), asyncHandler(list));

export default router;
