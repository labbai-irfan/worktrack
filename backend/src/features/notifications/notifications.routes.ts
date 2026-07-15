import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, orgScope } from '../../middlewares/auth';
import { ok } from '../../utils/respond';
import { ApiError } from '../../utils/ApiError';
import { Notification } from '../../models/Notification';
import { getPagination, pageMeta } from '../../utils/pagination';

async function list(req: Request, res: Response) {
  const scope = orgScope(req);
  const { page, limit, skip } = getPagination(req, '-createdAt', 50);
  const filter: Record<string, unknown> = { ...scope, userId: req.user!._id };
  if (req.query.unread === 'true') filter.readAt = null;
  if (req.query.type) filter.type = { $in: String(req.query.type).split(',') };
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('actorId', 'displayName avatarUrl').lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...scope, userId: req.user!._id, readAt: null }),
  ]);
  return ok(res, items, 'OK', { ...pageMeta(page, limit, total), unreadCount });
}

async function markRead(req: Request, res: Response) {
  const scope = orgScope(req);
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, ...scope, userId: req.user!._id },
    { readAt: new Date() },
    { new: true }
  ).lean();
  if (!notification) throw ApiError.notFound('Notification not found.');
  return ok(res, notification, 'Marked as read.');
}

async function markAllRead(req: Request, res: Response) {
  const scope = orgScope(req);
  await Notification.updateMany({ ...scope, userId: req.user!._id, readAt: null }, { readAt: new Date() });
  return ok(res, null, 'All notifications marked as read.');
}

const router = Router();
router.use(authenticate);
router.get('/', asyncHandler(list));
router.post('/read-all', asyncHandler(markAllRead));
router.post('/:id/read', asyncHandler(markRead));

export default router;
