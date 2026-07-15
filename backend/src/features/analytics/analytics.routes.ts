import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize, orgScope } from '../../middlewares/auth';
import { ok } from '../../utils/respond';
import { Project } from '../../models/Project';
import { Task } from '../../models/Task';
import { Issue } from '../../models/Issue';
import { WorkUpdate } from '../../models/WorkUpdate';
import { User } from '../../models/User';
import { DailyReport } from '../../models/DailyReport';

function range(req: Request): { from: Date; to: Date } {
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(to.getTime() - 30 * 86_400_000);
  return { from, to };
}

/** GET /analytics/dashboard — manager overview KPIs. */
async function dashboard(req: Request, res: Response) {
  const scope = orgScope(req);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStr = today.toISOString().slice(0, 10);

  const [
    activeEmployees, activeProjects, updatesToday, pendingReviews, approvedToday,
    tasksInProgress, tasksCompleted30d, overdueTasks, openIssues, criticalIssues,
    blockedTasks, reportsToday, submittedReportsToday,
  ] = await Promise.all([
    User.countDocuments({ ...scope, status: 'active', deletedAt: null }),
    Project.countDocuments({ ...scope, status: 'active' }),
    WorkUpdate.countDocuments({ ...scope, workDate: { $gte: today }, status: { $ne: 'draft' }, deletedAt: null }),
    WorkUpdate.countDocuments({ ...scope, status: { $in: ['submitted', 'under_review'] }, deletedAt: null }),
    WorkUpdate.countDocuments({ ...scope, 'review.approvedAt': { $gte: today }, deletedAt: null }),
    Task.countDocuments({ ...scope, status: 'in_progress', deletedAt: null }),
    Task.countDocuments({ ...scope, completedAt: { $gte: new Date(Date.now() - 30 * 86_400_000) }, deletedAt: null }),
    Task.countDocuments({ ...scope, dueDate: { $lt: new Date() }, status: { $nin: ['completed', 'cancelled'] }, deletedAt: null }),
    Issue.countDocuments({ ...scope, status: { $nin: ['resolved', 'closed', 'duplicate', 'wont_fix'] }, deletedAt: null }),
    Issue.countDocuments({ ...scope, severity: 'critical', status: { $nin: ['resolved', 'closed'] }, deletedAt: null }),
    Task.countDocuments({ ...scope, status: 'blocked', deletedAt: null }),
    User.countDocuments({ ...scope, status: 'active', deletedAt: null }),
    DailyReport.countDocuments({ ...scope, date: dateStr, status: { $ne: 'draft' } }),
  ]);

  const projectHealth = await Project.aggregate([
    { $match: { ...scope, status: { $in: ['active', 'at_risk', 'on_hold'] } } },
    { $group: { _id: '$health', count: { $sum: 1 } } },
  ]);

  return ok(res, {
    kpis: {
      activeEmployees, activeProjects, updatesToday, pendingReviews, approvedToday,
      tasksInProgress, tasksCompleted30d, overdueTasks, openIssues, criticalIssues,
      blockedTasks, reportsExpected: reportsToday, reportsSubmitted: submittedReportsToday,
    },
    projectHealth: Object.fromEntries(projectHealth.map((h) => [h._id, h.count])),
  });
}

/** GET /analytics/trends — daily counts for charting. */
async function trends(req: Request, res: Response) {
  const scope = orgScope(req);
  const { from, to } = range(req);
  const projectFilter = req.query.projectId ? { projectId: new Types.ObjectId(String(req.query.projectId)) } : {};

  const [updates, completedTasks, issuesCreated, issuesResolved] = await Promise.all([
    WorkUpdate.aggregate([
      { $match: { ...scope, ...projectFilter, workDate: { $gte: from, $lte: to }, status: { $ne: 'draft' }, deletedAt: null } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$workDate' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Task.aggregate([
      { $match: { ...scope, ...projectFilter, completedAt: { $gte: from, $lte: to }, deletedAt: null } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Issue.aggregate([
      { $match: { ...scope, ...projectFilter, createdAt: { $gte: from, $lte: to }, deletedAt: null } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Issue.aggregate([
      { $match: { ...scope, ...projectFilter, resolvedAt: { $gte: from, $lte: to }, deletedAt: null } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$resolvedAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return ok(res, { updates, completedTasks, issuesCreated, issuesResolved });
}

/**
 * GET /analytics/workload — open work by employee.
 * Reports estimate-based capacity (Phase 18) when the employee's open tasks
 * carry hour estimates; falls back to a task-count context view and an
 * explicit `estimateCoverage: false` flag otherwise, per the rule against
 * presenting fabricated utilization numbers.
 */
async function workload(req: Request, res: Response) {
  const scope = orgScope(req);
  const capacityHours = Math.max(1, Number(req.query.capacityHours) || 40); // default: 40h/week
  const rows = await Task.aggregate([
    { $match: { ...scope, status: { $nin: ['completed', 'cancelled', 'backlog'] }, assigneeId: { $ne: null }, deletedAt: null } },
    { $group: {
      _id: '$assigneeId',
      total: { $sum: 1 },
      inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
      blocked: { $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] } },
      overdue: { $sum: { $cond: [{ $and: [{ $lt: ['$dueDate', new Date()] }, { $ne: ['$dueDate', null] }] }, 1, 0] } },
      estimatedHours: { $sum: { $ifNull: ['$estimatedHours', 0] } },
      tasksWithEstimate: { $sum: { $cond: [{ $ne: ['$estimatedHours', null] }, 1, 0] } },
    } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: {
      total: 1, inProgress: 1, blocked: 1, overdue: 1, estimatedHours: 1, tasksWithEstimate: 1,
      displayName: '$user.displayName', avatarUrl: '$user.avatarUrl', jobTitle: '$user.jobTitle',
    } },
    { $sort: { total: -1 } },
    { $limit: 50 },
  ]);

  const withCapacity = rows.map((r) => {
    const estimateCoverage = r.total > 0 ? r.tasksWithEstimate / r.total : 0;
    // Require estimates on most open tasks before claiming a utilization number —
    // a couple of estimated tasks out of a dozen would be a misleading percentage.
    const hasReliableEstimate = estimateCoverage >= 0.6;
    const utilization = hasReliableEstimate ? r.estimatedHours / capacityHours : null;
    let capacityState: 'available' | 'balanced' | 'near_capacity' | 'over_capacity' | 'unknown' = 'unknown';
    if (utilization !== null) {
      capacityState = utilization > 1 ? 'over_capacity' : utilization >= 0.85 ? 'near_capacity' : utilization >= 0.5 ? 'balanced' : 'available';
    }
    return { ...r, estimateCoverage, hasReliableEstimate, capacityHours, utilization, capacityState };
  });

  return ok(res, withCapacity);
}

/** GET /analytics/work-distribution — by type/project/module for a period. */
async function workDistribution(req: Request, res: Response) {
  const scope = orgScope(req);
  const { from, to } = range(req);
  const match: Record<string, unknown> = { ...scope, workDate: { $gte: from, $lte: to }, status: { $ne: 'draft' }, deletedAt: null };
  if (req.query.projectId) match.projectId = new Types.ObjectId(String(req.query.projectId));
  if (req.query.userId) match.userId = new Types.ObjectId(String(req.query.userId));

  const [byType, byProject, byModule] = await Promise.all([
    WorkUpdate.aggregate([{ $match: match }, { $group: { _id: '$workType', count: { $sum: 1 }, minutes: { $sum: '$time.minutesSpent' } } }, { $sort: { count: -1 } }]),
    WorkUpdate.aggregate([
      { $match: match },
      { $group: { _id: '$projectId', count: { $sum: 1 }, minutes: { $sum: '$time.minutesSpent' } } },
      { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'p' } },
      { $unwind: '$p' },
      { $project: { count: 1, minutes: 1, name: '$p.name', color: '$p.color' } },
      { $sort: { count: -1 } },
    ]),
    WorkUpdate.aggregate([
      { $match: { ...match, moduleId: { $ne: null } } },
      { $group: { _id: '$moduleId', count: { $sum: 1 }, minutes: { $sum: '$time.minutesSpent' } } },
      { $lookup: { from: 'modules', localField: '_id', foreignField: '_id', as: 'm' } },
      { $unwind: '$m' },
      { $project: { count: 1, minutes: 1, name: '$m.name', color: '$m.color' } },
      { $sort: { count: -1 } },
    ]),
  ]);
  return ok(res, { byType, byProject, byModule });
}

const router = Router();
router.use(authenticate);
router.get('/dashboard', authorize('analytics.team', 'analytics.organization'), asyncHandler(dashboard));
router.get('/trends', authorize('analytics.personal'), asyncHandler(trends));
router.get('/workload', authorize('analytics.team', 'analytics.organization'), asyncHandler(workload));
router.get('/work-distribution', authorize('analytics.personal'), asyncHandler(workDistribution));

export default router;
