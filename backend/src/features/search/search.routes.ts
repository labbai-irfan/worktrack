import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize, orgScope } from '../../middlewares/auth';
import { ok } from '../../utils/respond';
import { ApiError } from '../../utils/ApiError';
import { Project } from '../../models/Project';
import { Task } from '../../models/Task';
import { Issue } from '../../models/Issue';
import { WorkUpdate } from '../../models/WorkUpdate';
import { User } from '../../models/User';
import { Release } from '../../models/Release';

/**
 * Global permission-aware search. Uses regex/text-index matching as the
 * portable fallback strategy; swap the per-collection queries for MongoDB
 * Atlas Search aggregations when Atlas Search is enabled.
 */
async function search(req: Request, res: Response) {
  const scope = orgScope(req);
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) throw ApiError.badRequest('Search query must be at least 2 characters.');
  const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const limit = 8;
  const canSeeTeamUpdates = req.user!.permissions.includes('work_update.view_team');

  const [projects, tasks, issues, updates, employees, releases] = await Promise.all([
    Project.find({ ...scope, $or: [{ name: rx }, { key: rx }] }).limit(limit).select('name key color status').lean(),
    Task.find({ ...scope, deletedAt: null, $or: [{ title: rx }, { number: rx }] })
      .limit(limit).select('number title status priority projectId').populate('projectId', 'name key').lean(),
    Issue.find({ ...scope, deletedAt: null, $or: [{ title: rx }, { number: rx }, { 'error.message': rx }, { 'error.commitHash': rx }] })
      .limit(limit).select('number title status severity projectId').populate('projectId', 'name key').lean(),
    WorkUpdate.find({
      ...scope, deletedAt: null,
      ...(canSeeTeamUpdates ? { status: { $ne: 'draft' } } : { userId: req.user!._id }),
      $or: [{ title: rx }, { number: rx }, { 'technical.commitHash': rx }],
    }).limit(limit).select('number title status workDate userId').populate('userId', 'displayName').lean(),
    req.user!.permissions.includes('employee.view')
      ? User.find({ ...scope, deletedAt: null, $or: [{ displayName: rx }, { email: rx }, { employeeCode: rx }] })
          .limit(limit).select('displayName email avatarUrl jobTitle status').lean()
      : Promise.resolve([]),
    Release.find({ ...scope, $or: [{ version: rx }, { name: rx }] }).limit(limit).select('version name status projectId').populate('projectId', 'name').lean(),
  ]);

  return ok(res, { projects, tasks, issues, workUpdates: updates, employees, releases });
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('search.use'), asyncHandler(search));

export default router;
