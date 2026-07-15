import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ok, created } from '../../utils/respond';
import { getPagination, pageMeta } from '../../utils/pagination';
import { orgScope } from '../../middlewares/auth';
import { Issue } from '../../models/Issue';
import { Project } from '../../models/Project';
import { nextIdentifier } from '../../utils/counters';
import { audit } from '../../services/audit.service';
import { recordActivity } from '../../services/activity.service';
import { notify } from '../../services/notification.service';
import { redact } from '../../services/audit.service';

const POPULATE = [
  { path: 'reporterId', select: 'displayName avatarUrl' },
  { path: 'assigneeId', select: 'displayName avatarUrl' },
  { path: 'projectId', select: 'name key color' },
  { path: 'moduleId', select: 'name key color' },
  { path: 'taskId', select: 'number title' },
  { path: 'attachmentIds' },
];

/** Allowed status transitions for the issue lifecycle. */
const TRANSITIONS: Record<string, string[]> = {
  open: ['triaged', 'assigned', 'in_progress', 'duplicate', 'wont_fix', 'closed'],
  triaged: ['assigned', 'in_progress', 'duplicate', 'wont_fix', 'closed'],
  assigned: ['in_progress', 'blocked', 'triaged', 'duplicate', 'wont_fix'],
  in_progress: ['blocked', 'fix_implemented', 'assigned', 'wont_fix'],
  blocked: ['in_progress', 'assigned'],
  fix_implemented: ['under_review', 'testing', 'in_progress'],
  under_review: ['testing', 'in_progress', 'resolved'],
  testing: ['resolved', 'in_progress', 'reopened'],
  resolved: ['closed', 'reopened'],
  closed: ['reopened'],
  reopened: ['assigned', 'in_progress', 'triaged'],
  duplicate: ['reopened'],
  wont_fix: ['reopened'],
};

export async function list(req: Request, res: Response) {
  const scope = orgScope(req);
  const { page, limit, skip, sort } = getPagination(req, '-createdAt');
  const filter: Record<string, unknown> = { ...scope, deletedAt: null };
  if (req.query.projectId) filter.projectId = req.query.projectId;
  if (req.query.moduleId) filter.moduleId = req.query.moduleId;
  if (req.query.assigneeId) filter.assigneeId = req.query.assigneeId === 'me' ? req.user!._id : req.query.assigneeId;
  if (req.query.reporterId) filter.reporterId = req.query.reporterId === 'me' ? req.user!._id : req.query.reporterId;
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
  if (req.query.open === 'true') filter.status = { $nin: ['resolved', 'closed', 'duplicate', 'wont_fix'] };
  if (req.query.severity) filter.severity = { $in: String(req.query.severity).split(',') };
  if (req.query.type) filter.type = { $in: String(req.query.type).split(',') };
  if (req.query.environment) filter.environment = req.query.environment;
  if (req.query.q) {
    filter.$or = [
      { title: { $regex: String(req.query.q), $options: 'i' } },
      { number: { $regex: String(req.query.q), $options: 'i' } },
      { 'error.message': { $regex: String(req.query.q), $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    Issue.find(filter).sort(sort).skip(skip).limit(limit).populate(POPULATE).lean(),
    Issue.countDocuments(filter),
  ]);
  return ok(res, items, 'OK', pageMeta(page, limit, total));
}

export async function get(req: Request, res: Response) {
  const scope = orgScope(req);
  const issue = await Issue.findOne({ _id: req.params.id, ...scope, deletedAt: null })
    .populate(POPULATE)
    .populate('collaboratorIds', 'displayName avatarUrl')
    .populate('history.byId', 'displayName avatarUrl')
    .lean();
  if (!issue) throw ApiError.notFound('Issue not found.');
  return ok(res, issue);
}

export async function create(req: Request, res: Response) {
  const scope = orgScope(req);
  const project = await Project.findOne({ _id: req.body.projectId, ...scope }).lean();
  if (!project) throw ApiError.badRequest('Invalid project.');

  const number = await nextIdentifier(scope.organizationId, 'issue', 'BUG');
  const body = { ...req.body };
  if (body.error) body.error = redact(body.error); // never persist raw payload secrets
  const issue = await Issue.create({
    ...scope,
    ...body,
    number,
    reporterId: req.user!._id,
    status: body.assigneeId ? 'assigned' : 'open',
    createdBy: req.user!._id,
    history: [{ action: 'created', byId: req.user!._id, to: body.assigneeId ? 'assigned' : 'open', at: new Date() }],
    ...(body.error ? { 'error.firstSeenAt': new Date(), 'error.lastSeenAt': new Date() } : {}),
  });

  audit({ req, action: 'issue.create', entityType: 'issue', entityId: issue._id, newData: { number, title: issue.title, severity: issue.severity } });
  recordActivity({
    organizationId: scope.organizationId, projectId: issue.projectId, actorId: req.user!.id,
    action: 'issue.created', entityType: 'issue', entityId: issue._id,
    entityLabel: `${issue.number} ${issue.title}`, link: `/issues/${issue._id}`,
  });
  if (issue.assigneeId) {
    await notify({
      organizationId: scope.organizationId, userId: issue.assigneeId, actorId: req.user!.id,
      type: 'issue_assigned', title: `${req.user!.displayName} assigned you ${issue.number}`,
      body: issue.title, entityType: 'issue', entityId: issue._id, link: `/issues/${issue._id}`,
    });
  }
  const populated = await Issue.findById(issue._id).populate(POPULATE).lean();
  return created(res, populated, 'Issue created.');
}

export async function update(req: Request, res: Response) {
  const scope = orgScope(req);
  const issue = await Issue.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!issue) throw ApiError.notFound('Issue not found.');

  const previous = { status: issue.status, assigneeId: issue.assigneeId ? String(issue.assigneeId) : null, severity: issue.severity };
  const body = { ...req.body };
  if (body.error) {
    const currentError = (issue.get('error') ?? {}) as Record<string, unknown>;
    body.error = { ...currentError, ...(redact(body.error) as Record<string, unknown>) };
  }
  delete body.status; // status changes go through /transition to enforce the lifecycle
  Object.assign(issue, body, { updatedBy: req.user!._id });

  if (body.assigneeId && body.assigneeId !== previous.assigneeId) {
    issue.history.push({ action: 'assigned', byId: req.user!._id, from: previous.assigneeId ?? '', to: String(body.assigneeId), note: '', at: new Date() });
    if (issue.status === 'open' || issue.status === 'triaged') issue.status = 'assigned';
    await notify({
      organizationId: scope.organizationId, userId: body.assigneeId, actorId: req.user!.id,
      type: 'issue_assigned', title: `${req.user!.displayName} assigned you ${issue.number}`,
      body: issue.title, entityType: 'issue', entityId: issue._id, link: `/issues/${issue._id}`,
    });
  }
  if (body.severity && body.severity !== previous.severity && issue.assigneeId) {
    await notify({
      organizationId: scope.organizationId, userId: issue.assigneeId, actorId: req.user!.id,
      type: 'issue_status_changed', title: `${issue.number} severity changed to ${body.severity}`,
      body: issue.title, entityType: 'issue', entityId: issue._id, link: `/issues/${issue._id}`,
    });
  }
  await issue.save();
  audit({ req, action: 'issue.update', entityType: 'issue', entityId: issue._id, previousData: previous, newData: req.body });
  const populated = await Issue.findById(issue._id).populate(POPULATE).lean();
  return ok(res, populated, 'Issue updated.');
}

/** POST /issues/:id/transition — lifecycle transitions with resolution capture. */
export async function transition(req: Request, res: Response) {
  const scope = orgScope(req);
  const { status, note, resolution } = req.body;
  const issue = await Issue.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!issue) throw ApiError.notFound('Issue not found.');

  const allowed = TRANSITIONS[issue.status] ?? [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(`Cannot move issue from "${issue.status}" to "${status}".`);
  }
  if (status === 'resolved' && !resolution?.code && !issue.resolution?.code) {
    throw ApiError.validation([{ field: 'resolution.code', message: 'A resolution code is required to resolve an issue.' }]);
  }

  const from = issue.status;
  issue.status = status;
  if (resolution) {
    const currentResolution = (issue.get('resolution') ?? {}) as Record<string, unknown>;
    issue.set('resolution', { ...currentResolution, ...resolution });
  }
  if (status === 'resolved') issue.resolvedAt = new Date();
  if (status === 'closed') issue.closedAt = new Date();
  if (status === 'reopened') {
    issue.resolvedAt = null;
    issue.closedAt = null;
  }
  issue.history.push({ action: 'status_changed', byId: req.user!._id, from, to: status, note: note ?? '', at: new Date() });
  issue.updatedBy = req.user!._id;
  await issue.save();

  recordActivity({
    organizationId: scope.organizationId, projectId: issue.projectId, actorId: req.user!.id,
    action: status === 'reopened' ? 'issue.reopened' : status === 'resolved' ? 'issue.resolved' : 'issue.status_changed',
    entityType: 'issue', entityId: issue._id, entityLabel: `${issue.number} ${issue.title}`,
    previousValue: from, newValue: status, link: `/issues/${issue._id}`,
  });
  const interested = [issue.reporterId, issue.assigneeId, ...issue.watcherIds].filter(Boolean);
  for (const userId of interested) {
    await notify({
      organizationId: scope.organizationId, userId: userId!, actorId: req.user!.id,
      type: status === 'reopened' ? 'issue_reopened' : 'issue_status_changed',
      title: `${issue.number} moved to ${status.replace(/_/g, ' ')}`,
      body: note ?? issue.title, entityType: 'issue', entityId: issue._id, link: `/issues/${issue._id}`,
    });
  }
  audit({ req, action: 'issue.transition', entityType: 'issue', entityId: issue._id, previousData: { status: from }, newData: { status, note } });
  const populated = await Issue.findById(issue._id).populate(POPULATE).lean();
  return ok(res, populated, `Issue moved to ${status.replace(/_/g, ' ')}.`);
}

export async function remove(req: Request, res: Response) {
  const scope = orgScope(req);
  const issue = await Issue.findOneAndUpdate(
    { _id: req.params.id, ...scope, deletedAt: null },
    { deletedAt: new Date(), updatedBy: req.user!._id },
    { new: true }
  ).lean();
  if (!issue) throw ApiError.notFound('Issue not found.');
  audit({ req, action: 'issue.delete', entityType: 'issue', entityId: issue._id, previousData: { number: issue.number, title: issue.title } });
  return ok(res, null, 'Issue deleted.');
}
