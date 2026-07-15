import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize, orgScope } from '../../middlewares/auth';
import { ok } from '../../utils/respond';
import { ApiError } from '../../utils/ApiError';
import { DailyReport } from '../../models/DailyReport';
import { WorkUpdate } from '../../models/WorkUpdate';
import { Issue } from '../../models/Issue';
import { TimeEntry } from '../../models/TimeEntry';
import { getPagination, pageMeta } from '../../utils/pagination';
import { notify } from '../../services/notification.service';
import { audit } from '../../services/audit.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const upsertSchema = z.object({
  date: z.string().regex(DATE_RE),
  blockers: z.string().max(5000).optional(),
  assistanceRequired: z.string().max(5000).optional(),
  nextDayPlan: z.string().max(5000).optional(),
  employeeNotes: z.string().max(10_000).optional(),
  completedSummary: z.string().max(10_000).optional(),
  inProgressSummary: z.string().max(10_000).optional(),
});

const reviewSchema = z.object({
  action: z.enum(['approve', 'request_changes', 'reviewed']),
  managerNotes: z.string().max(5000).optional(),
});

function dayRange(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);
  return { start, end };
}

/**
 * Aggregates the employee's real activity for the day. Never fabricates
 * activity — empty days produce an empty aggregate.
 */
async function aggregateDay(organizationId: Types.ObjectId, userId: Types.ObjectId, date: string) {
  const { start, end } = dayRange(date);
  const [updates, issuesCreated, issuesResolved, timeEntries] = await Promise.all([
    WorkUpdate.find({ organizationId, userId, workDate: { $gte: start, $lte: end }, status: { $ne: 'draft' }, deletedAt: null })
      .select('projectId moduleId taskId title progressStatus blockers time').lean(),
    Issue.countDocuments({ organizationId, reporterId: userId, createdAt: { $gte: start, $lte: end }, deletedAt: null }),
    Issue.countDocuments({ organizationId, assigneeId: userId, resolvedAt: { $gte: start, $lte: end }, deletedAt: null }),
    TimeEntry.find({ organizationId, userId, startedAt: { $gte: start, $lte: end }, running: false }).select('minutes').lean(),
  ]);
  const totalMinutes =
    timeEntries.reduce((sum, t) => sum + t.minutes, 0) ||
    updates.reduce((sum, u) => sum + (u.time?.minutesSpent ?? 0), 0);
  return {
    projectIds: [...new Set(updates.map((u) => String(u.projectId)))],
    moduleIds: [...new Set(updates.filter((u) => u.moduleId).map((u) => String(u.moduleId)))],
    workUpdateIds: updates.map((u) => u._id),
    taskIds: [...new Set(updates.filter((u) => u.taskId).map((u) => String(u.taskId)))],
    issuesCreated,
    issuesResolved,
    totalMinutes,
    blockersDetected: updates.map((u) => u.blockers).filter(Boolean).join('\n'),
  };
}

/** GET /reports/daily/preview?date= — aggregate before submission. */
async function preview(req: Request, res: Response) {
  const scope = orgScope(req);
  const date = String(req.query.date ?? '');
  if (!DATE_RE.test(date)) throw ApiError.badRequest('date is required (YYYY-MM-DD).');
  const aggregate = await aggregateDay(scope.organizationId, req.user!._id, date);
  const existing = await DailyReport.findOne({ ...scope, userId: req.user!._id, date }).lean();
  return ok(res, { aggregate, existing });
}

/** POST /reports/daily — create/update the day's report (draft). */
async function upsertDaily(req: Request, res: Response) {
  const scope = orgScope(req);
  const { date, ...fields } = req.body;
  const existing = await DailyReport.findOne({ ...scope, userId: req.user!._id, date });
  if (existing && ['approved', 'reviewed'].includes(existing.status)) {
    throw ApiError.badRequest('This report has already been reviewed and can no longer be edited.');
  }
  const aggregate = await aggregateDay(scope.organizationId, req.user!._id, date);
  const report = await DailyReport.findOneAndUpdate(
    { ...scope, userId: req.user!._id, date },
    {
      $set: {
        ...fields,
        projectIds: aggregate.projectIds,
        moduleIds: aggregate.moduleIds,
        workUpdateIds: aggregate.workUpdateIds,
        taskIds: aggregate.taskIds,
        issuesCreated: aggregate.issuesCreated,
        issuesResolved: aggregate.issuesResolved,
        totalMinutes: aggregate.totalMinutes,
        blockers: fields.blockers ?? aggregate.blockersDetected,
        status: existing?.status === 'changes_requested' ? 'changes_requested' : 'draft',
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return ok(res, report, 'Daily report saved.');
}

/** POST /reports/daily/:id/submit */
async function submitDaily(req: Request, res: Response) {
  const scope = orgScope(req);
  const report = await DailyReport.findOne({ _id: req.params.id, ...scope, userId: req.user!._id });
  if (!report) throw ApiError.notFound('Report not found.');
  if (!['draft', 'changes_requested'].includes(report.status)) throw ApiError.badRequest('This report has already been submitted.');
  report.status = 'submitted';
  report.submittedAt = new Date();
  await report.save();
  audit({ req, action: 'report.submit', entityType: 'daily_report', entityId: report._id });
  return ok(res, report.toObject(), 'Daily report submitted.');
}

/** GET /reports/daily — own reports, or team reports with report.review. */
async function listDaily(req: Request, res: Response) {
  const scope = orgScope(req);
  const { page, limit, skip } = getPagination(req, '-date');
  const canReview = req.user!.permissions.includes('report.review');
  const filter: Record<string, unknown> = { ...scope };
  filter.userId = canReview && req.query.userId ? (req.query.userId === 'me' ? req.user!._id : req.query.userId) : req.user!._id;
  if (canReview && req.query.all === 'true') delete filter.userId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    const range: Record<string, string> = {};
    if (req.query.from) range.$gte = String(req.query.from);
    if (req.query.to) range.$lte = String(req.query.to);
    filter.date = range;
  }
  // Reviewers should not browse other people's unsubmitted drafts.
  if (canReview && !('userId' in filter)) filter.status = filter.status ?? { $ne: 'draft' };
  const [items, total] = await Promise.all([
    DailyReport.find(filter).sort({ date: -1 }).skip(skip).limit(limit)
      .populate('userId', 'displayName avatarUrl jobTitle')
      .populate('projectIds', 'name key color')
      .lean(),
    DailyReport.countDocuments(filter),
  ]);
  return ok(res, items, 'OK', pageMeta(page, limit, total));
}

async function getDaily(req: Request, res: Response) {
  const scope = orgScope(req);
  const report = await DailyReport.findOne({ _id: req.params.id, ...scope })
    .populate('userId', 'displayName avatarUrl jobTitle')
    .populate('projectIds', 'name key color')
    .populate({ path: 'workUpdateIds', select: 'number title status workType progress moduleId projectId', populate: { path: 'moduleId', select: 'name' } })
    .populate('reviewedBy', 'displayName')
    .lean();
  if (!report) throw ApiError.notFound('Report not found.');
  const isOwner = String((report.userId as { _id?: unknown })?._id ?? report.userId) === req.user!.id;
  if (!isOwner && !req.user!.permissions.includes('report.review')) throw ApiError.forbidden();
  return ok(res, report);
}

/** POST /reports/daily/:id/review */
async function reviewDaily(req: Request, res: Response) {
  const scope = orgScope(req);
  const report = await DailyReport.findOne({ _id: req.params.id, ...scope });
  if (!report) throw ApiError.notFound('Report not found.');
  if (report.status !== 'submitted') throw ApiError.badRequest('Only submitted reports can be reviewed.');
  if (String(report.userId) === req.user!.id) throw ApiError.forbidden('You cannot review your own report.');

  const map = { approve: 'approved', request_changes: 'changes_requested', reviewed: 'reviewed' } as const;
  report.status = map[req.body.action as keyof typeof map];
  report.managerNotes = req.body.managerNotes ?? report.managerNotes;
  report.reviewedBy = req.user!._id;
  report.reviewedAt = new Date();
  await report.save();

  await notify({
    organizationId: scope.organizationId, userId: report.userId, actorId: req.user!.id,
    type: 'report_reviewed',
    title: `Your daily report for ${report.date} was ${report.status.replace(/_/g, ' ')}`,
    body: req.body.managerNotes ?? '', entityType: 'daily_report', entityId: report._id, link: `/reports?date=${report.date}`,
  });
  audit({ req, action: 'report.review', entityType: 'daily_report', entityId: report._id, newData: { action: req.body.action } });
  return ok(res, report.toObject(), 'Report reviewed.');
}

/** GET /reports/summary?period=week|month&from=... — aggregated periodic report data. */
async function summary(req: Request, res: Response) {
  const scope = orgScope(req);
  const canReviewAll = req.user!.permissions.includes('report.review');
  const userId = canReviewAll && req.query.userId ? new Types.ObjectId(String(req.query.userId)) : req.user!._id;
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 7 * 86_400_000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();

  const matchUpdates = { organizationId: scope.organizationId, userId, workDate: { $gte: from, $lte: to }, status: { $ne: 'draft' }, deletedAt: null };
  const [byType, byProject, byStatus, issueStats, totalTime] = await Promise.all([
    WorkUpdate.aggregate([{ $match: matchUpdates }, { $group: { _id: '$workType', count: { $sum: 1 }, minutes: { $sum: '$time.minutesSpent' } } }]),
    WorkUpdate.aggregate([
      { $match: matchUpdates },
      { $group: { _id: '$projectId', count: { $sum: 1 }, minutes: { $sum: '$time.minutesSpent' } } },
      { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'project' } },
      { $unwind: '$project' },
      { $project: { count: 1, minutes: 1, name: '$project.name', key: '$project.key', color: '$project.color' } },
    ]),
    WorkUpdate.aggregate([{ $match: matchUpdates }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Issue.aggregate([
      { $match: { organizationId: scope.organizationId, $or: [{ reporterId: userId }, { assigneeId: userId }], createdAt: { $gte: from, $lte: to }, deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    TimeEntry.aggregate([
      { $match: { organizationId: scope.organizationId, userId, startedAt: { $gte: from, $lte: to }, running: false } },
      { $group: { _id: null, minutes: { $sum: '$minutes' } } },
    ]),
  ]);

  return ok(res, {
    from, to,
    workByType: byType,
    workByProject: byProject,
    updatesByStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
    issuesByStatus: Object.fromEntries(issueStats.map((s) => [s._id, s.count])),
    totalMinutes: totalTime[0]?.minutes ?? 0,
  });
}

const router = Router();
router.use(authenticate);
router.get('/daily', asyncHandler(listDaily));
router.get('/daily/preview', authorize('report.submit'), asyncHandler(preview));
router.post('/daily', authorize('report.submit'), validate(upsertSchema), asyncHandler(upsertDaily));
router.get('/daily/:id', asyncHandler(getDaily));
router.post('/daily/:id/submit', authorize('report.submit'), asyncHandler(submitDaily));
router.post('/daily/:id/review', authorize('report.review'), validate(reviewSchema), asyncHandler(reviewDaily));
router.get('/summary', authorize('analytics.personal'), asyncHandler(summary));

export default router;
