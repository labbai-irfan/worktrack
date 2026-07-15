import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize, orgScope } from '../../middlewares/auth';
import { ok, created } from '../../utils/respond';
import { ApiError } from '../../utils/ApiError';
import { Comment } from '../../models/Comment';
import { notify, notifyMany } from '../../services/notification.service';
import { emitToOrg } from '../../sockets';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
const ENTITY_TYPES = ['project', 'module', 'task', 'work_update', 'issue', 'release', 'daily_report'] as const;

const createSchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId: objectId,
  body: z.string().min(1).max(10_000),
  mentionIds: z.array(objectId).max(30).optional(),
  parentId: objectId.nullable().optional(),
});

const updateSchema = z.object({ body: z.string().min(1).max(10_000) });
const reactSchema = z.object({ emoji: z.string().min(1).max(16) });

async function list(req: Request, res: Response) {
  const scope = orgScope(req);
  const { entityType, entityId } = req.query;
  if (!entityType || !entityId) throw ApiError.badRequest('entityType and entityId are required.');
  const comments = await Comment.find({ ...scope, entityType, entityId, deletedAt: null })
    .sort({ pinned: -1, createdAt: 1 })
    .populate('authorId', 'displayName avatarUrl jobTitle')
    .populate('mentionIds', 'displayName')
    .lean();
  return ok(res, comments);
}

async function create(req: Request, res: Response) {
  const scope = orgScope(req);
  const comment = await Comment.create({ ...scope, ...req.body, authorId: req.user!._id });

  if (req.body.mentionIds?.length) {
    await notifyMany(req.body.mentionIds, {
      organizationId: scope.organizationId, actorId: req.user!.id,
      type: 'mention', title: `${req.user!.displayName} mentioned you`,
      body: req.body.body.slice(0, 200), entityType: req.body.entityType, entityId: req.body.entityId,
      link: entityLink(req.body.entityType, req.body.entityId),
    });
  }
  if (req.body.parentId) {
    const parent = await Comment.findOne({ _id: req.body.parentId, ...scope }).lean();
    if (parent && String(parent.authorId) !== req.user!.id) {
      await notify({
        organizationId: scope.organizationId, userId: parent.authorId, actorId: req.user!.id,
        type: 'reply', title: `${req.user!.displayName} replied to your comment`,
        body: req.body.body.slice(0, 200), entityType: req.body.entityType, entityId: req.body.entityId,
        link: entityLink(req.body.entityType, req.body.entityId),
      });
    }
  }
  const populated = await Comment.findById(comment._id).populate('authorId', 'displayName avatarUrl jobTitle').lean();
  emitToOrg(String(scope.organizationId), 'comment:new', { entityType: req.body.entityType, entityId: req.body.entityId, comment: populated });
  return created(res, populated, 'Comment added.');
}

function entityLink(entityType: string, entityId: string): string {
  const map: Record<string, string> = {
    task: `/tasks/${entityId}`, work_update: `/work-updates/${entityId}`, issue: `/issues/${entityId}`,
    project: `/projects/${entityId}`, release: `/releases/${entityId}`, module: `/modules/${entityId}`,
    daily_report: `/reports`,
  };
  return map[entityType] ?? '/';
}

async function update(req: Request, res: Response) {
  const scope = orgScope(req);
  const comment = await Comment.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!comment) throw ApiError.notFound('Comment not found.');
  if (String(comment.authorId) !== req.user!.id) throw ApiError.forbidden('You can only edit your own comments.');
  comment.body = req.body.body;
  comment.editedAt = new Date();
  await comment.save();
  return ok(res, comment.toObject(), 'Comment updated.');
}

async function remove(req: Request, res: Response) {
  const scope = orgScope(req);
  const comment = await Comment.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!comment) throw ApiError.notFound('Comment not found.');
  const isModerator = req.user!.permissions.includes('work_update.approve');
  if (String(comment.authorId) !== req.user!.id && !isModerator) throw ApiError.forbidden();
  comment.deletedAt = new Date();
  await comment.save();
  return ok(res, null, 'Comment deleted.');
}

async function react(req: Request, res: Response) {
  const scope = orgScope(req);
  const comment = await Comment.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!comment) throw ApiError.notFound('Comment not found.');
  const { emoji } = req.body;
  const existing = comment.reactions.find((r) => r.emoji === emoji);
  const uid = req.user!._id;
  if (existing) {
    const idx = existing.userIds.findIndex((u) => String(u) === String(uid));
    if (idx >= 0) existing.userIds.splice(idx, 1);
    else existing.userIds.push(uid);
    if (existing.userIds.length === 0) {
      comment.reactions = comment.reactions.filter((r) => r.emoji !== emoji) as typeof comment.reactions;
    }
  } else {
    comment.reactions.push({ emoji, userIds: [uid] });
  }
  await comment.save();
  return ok(res, comment.toObject(), 'Reaction updated.');
}

async function toggleResolve(req: Request, res: Response) {
  const scope = orgScope(req);
  const comment = await Comment.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!comment) throw ApiError.notFound('Comment not found.');
  comment.resolvedAt = comment.resolvedAt ? null : new Date();
  await comment.save();
  return ok(res, comment.toObject(), comment.resolvedAt ? 'Discussion resolved.' : 'Discussion reopened.');
}

async function togglePin(req: Request, res: Response) {
  const scope = orgScope(req);
  const comment = await Comment.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!comment) throw ApiError.notFound('Comment not found.');
  comment.pinned = !comment.pinned;
  await comment.save();
  return ok(res, comment.toObject(), comment.pinned ? 'Comment pinned.' : 'Comment unpinned.');
}

const router = Router();
router.use(authenticate);
router.get('/', asyncHandler(list));
router.post('/', authorize('comment.create'), validate(createSchema), asyncHandler(create));
router.patch('/:id', authorize('comment.create'), validate(updateSchema), asyncHandler(update));
router.delete('/:id', asyncHandler(remove));
router.post('/:id/react', authorize('comment.create'), validate(reactSchema), asyncHandler(react));
router.post('/:id/resolve', authorize('comment.create'), asyncHandler(toggleResolve));
router.post('/:id/pin', authorize('work_update.review', 'work_update.approve'), asyncHandler(togglePin));

export default router;
