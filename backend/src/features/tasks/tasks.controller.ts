import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ok, created } from '../../utils/respond';
import { getPagination, pageMeta } from '../../utils/pagination';
import { orgScope } from '../../middlewares/auth';
import { Task } from '../../models/Task';
import { TASK_STATUSES } from '../../constants/enums';
import { Project } from '../../models/Project';
import { nextIdentifier } from '../../utils/counters';
import { audit } from '../../services/audit.service';
import { recordActivity } from '../../services/activity.service';
import { notify } from '../../services/notification.service';

const POPULATE = [
  { path: 'assigneeId', select: 'displayName avatarUrl' },
  { path: 'reporterId', select: 'displayName avatarUrl' },
  { path: 'reviewerId', select: 'displayName avatarUrl' },
  { path: 'projectId', select: 'name key color' },
  { path: 'moduleId', select: 'name key color' },
];

/**
 * Validates a task's dependency list: every dependency must exist in the same
 * organization and project, must not be the task itself, and must not create
 * a cycle anywhere in the dependency graph (A→B→C→A).
 */
async function assertValidDependencies(
  scope: { organizationId: unknown },
  projectId: unknown,
  dependencyIds: string[],
  taskId: string | null
) {
  if (dependencyIds.length === 0) return;
  const unique = [...new Set(dependencyIds.map(String))];
  if (taskId && unique.includes(String(taskId))) {
    throw ApiError.badRequest('A task cannot depend on itself.');
  }
  const deps = await Task.find({ _id: { $in: unique }, ...scope, deletedAt: null })
    .select('_id projectId dependencyIds')
    .lean();
  if (deps.length !== unique.length) {
    throw ApiError.badRequest('One or more dependencies do not exist.');
  }
  if (deps.some((d) => String(d.projectId) !== String(projectId))) {
    throw ApiError.badRequest('Dependencies must belong to the same project.');
  }
  if (!taskId) return; // a brand-new task cannot be part of an existing cycle

  // BFS upstream from the proposed dependencies; reaching this task means a cycle.
  const visited = new Set<string>(unique);
  let frontier = deps.flatMap((d) => (d.dependencyIds ?? []).map(String));
  while (frontier.length > 0) {
    if (frontier.includes(String(taskId))) {
      throw new ApiError(400, 'This dependency would create a circular chain.', 'CIRCULAR_DEPENDENCY');
    }
    const next = frontier.filter((id) => !visited.has(id));
    next.forEach((id) => visited.add(id));
    if (next.length === 0) break;
    const docs = await Task.find({ _id: { $in: next }, ...scope, deletedAt: null })
      .select('dependencyIds')
      .lean();
    frontier = docs.flatMap((d) => (d.dependencyIds ?? []).map(String));
  }
}

export async function list(req: Request, res: Response) {
  const scope = orgScope(req);
  const { page, limit, skip, sort } = getPagination(req, '-updatedAt', 200);
  const filter: Record<string, unknown> = { ...scope, deletedAt: null };
  if (req.query.projectId) filter.projectId = req.query.projectId;
  if (req.query.moduleId) filter.moduleId = req.query.moduleId;
  if (req.query.milestoneId) filter.milestoneId = req.query.milestoneId;
  if (req.query.assigneeId) filter.assigneeId = req.query.assigneeId === 'me' ? req.user!._id : req.query.assigneeId;
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
  if (req.query.priority) filter.priority = { $in: String(req.query.priority).split(',') };
  if (req.query.type) filter.type = { $in: String(req.query.type).split(',') };
  if (req.query.parentTaskId) filter.parentTaskId = req.query.parentTaskId;
  else if (req.query.includeSubtasks !== 'true') filter.parentTaskId = null;
  if (req.query.dueBefore) filter.dueDate = { $lte: new Date(String(req.query.dueBefore)), $ne: null };
  if (req.query.overdue === 'true') {
    filter.dueDate = { $lt: new Date(), $ne: null };
    filter.status = { $nin: ['completed', 'cancelled'] };
  }
  if (req.query.q) {
    filter.$or = [
      { title: { $regex: String(req.query.q), $options: 'i' } },
      { number: { $regex: String(req.query.q), $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    Task.find(filter).sort(sort).skip(skip).limit(limit).populate(POPULATE).lean(),
    Task.countDocuments(filter),
  ]);
  return ok(res, items, 'OK', pageMeta(page, limit, total));
}

export async function get(req: Request, res: Response) {
  const scope = orgScope(req);
  const task = await Task.findOne({ _id: req.params.id, ...scope, deletedAt: null })
    .populate(POPULATE)
    .populate('collaboratorIds', 'displayName avatarUrl')
    .populate('watcherIds', 'displayName avatarUrl')
    .populate('dependencyIds', 'number title status')
    .lean();
  if (!task) throw ApiError.notFound('Task not found.');
  const [subtasks, dependents] = await Promise.all([
    Task.find({ parentTaskId: task._id, ...scope, deletedAt: null })
      .sort({ createdAt: 1 })
      .populate('assigneeId', 'displayName avatarUrl')
      .select('number title status priority assigneeId dueDate progress')
      .lean(),
    // Tasks that depend on this one ("this task blocks…").
    Task.find({ dependencyIds: task._id, ...scope, deletedAt: null })
      .select('number title status')
      .lean(),
  ]);
  return ok(res, { ...task, subtasks, dependents });
}

/**
 * GET /tasks/my-work — the personal command center.
 * Groups the caller's open tasks into actionable buckets.
 */
export async function myWork(req: Request, res: Response) {
  const scope = orgScope(req);
  const me = req.user!._id;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const weekAhead = new Date(startOfDay);
  weekAhead.setDate(weekAhead.getDate() + 8);

  const base = { ...scope, deletedAt: null, assigneeId: me, status: { $nin: ['completed', 'cancelled'] } };
  const select = 'number title status priority dueDate progress projectId blockedReason checklist';
  const pop = { path: 'projectId', select: 'name key color' };
  const LIMIT = 25;

  const [overdue, today, upcoming, blocked, inReview, noDueDate] = await Promise.all([
    Task.find({ ...base, dueDate: { $lt: startOfDay, $ne: null } }).sort({ dueDate: 1 }).limit(LIMIT).select(select).populate(pop).lean(),
    Task.find({ ...base, dueDate: { $gte: startOfDay, $lt: endOfDay } }).sort({ priority: 1 }).limit(LIMIT).select(select).populate(pop).lean(),
    Task.find({ ...base, dueDate: { $gte: endOfDay, $lt: weekAhead } }).sort({ dueDate: 1 }).limit(LIMIT).select(select).populate(pop).lean(),
    Task.find({ ...scope, deletedAt: null, assigneeId: me, status: 'blocked' }).sort({ updatedAt: -1 }).limit(LIMIT).select(select).populate(pop).lean(),
    Task.find({ ...scope, deletedAt: null, reviewerId: me, status: 'under_review' }).sort({ updatedAt: -1 }).limit(LIMIT).select(select).populate(pop).lean(),
    Task.countDocuments({ ...base, dueDate: null }),
  ]);

  return ok(res, {
    overdue, today, upcoming, blocked, inReview,
    counts: {
      overdue: overdue.length, today: today.length, upcoming: upcoming.length,
      blocked: blocked.length, inReview: inReview.length, noDueDate,
    },
  });
}

export async function create(req: Request, res: Response) {
  const scope = orgScope(req);
  const project = await Project.findOne({ _id: req.body.projectId, ...scope }).lean();
  if (!project) throw ApiError.badRequest('Invalid project.');
  if (req.body.dependencyIds?.length) {
    await assertValidDependencies(scope, req.body.projectId, req.body.dependencyIds, null);
  }
  if (req.body.parentTaskId) {
    const parent = await Task.findOne({ _id: req.body.parentTaskId, ...scope, deletedAt: null }).select('projectId parentTaskId').lean();
    if (!parent) throw ApiError.badRequest('Parent task not found.');
    if (String(parent.projectId) !== String(req.body.projectId)) throw ApiError.badRequest('Subtasks must belong to the parent task’s project.');
    if (parent.parentTaskId) throw ApiError.badRequest('Subtasks cannot be nested more than one level.');
  }

  const number = await nextIdentifier(scope.organizationId, `task:${project.key}`, project.key);
  const task = await Task.create({
    ...scope,
    ...req.body,
    number,
    reporterId: req.body.reporterId ?? req.user!._id,
    createdBy: req.user!._id,
  });
  audit({ req, action: 'task.create', entityType: 'task', entityId: task._id, newData: { number, title: task.title } });
  recordActivity({
    organizationId: scope.organizationId, projectId: task.projectId, actorId: req.user!.id,
    action: 'task.created', entityType: 'task', entityId: task._id, entityLabel: `${task.number} ${task.title}`,
    link: `/tasks/${task._id}`,
  });
  if (task.assigneeId && String(task.assigneeId) !== req.user!.id) {
    await notify({
      organizationId: scope.organizationId, userId: task.assigneeId, actorId: req.user!.id,
      type: 'task_assigned', title: `${req.user!.displayName} assigned you ${task.number}`,
      body: task.title, entityType: 'task', entityId: task._id, link: `/tasks/${task._id}`,
    });
  }
  const populated = await Task.findById(task._id).populate(POPULATE).lean();
  return created(res, populated, 'Task created.');
}

export async function update(req: Request, res: Response) {
  const scope = orgScope(req);
  const task = await Task.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!task) throw ApiError.notFound('Task not found.');
  if (req.body.dependencyIds?.length) {
    await assertValidDependencies(scope, task.projectId, req.body.dependencyIds, task.id);
  }

  const previous = { status: task.status, assigneeId: task.assigneeId ? String(task.assigneeId) : null, priority: task.priority };
  Object.assign(task, req.body, { updatedBy: req.user!._id });
  if (req.body.status === 'completed' && !task.completedAt) {
    task.completedAt = new Date();
    task.progress = 100;
  }
  if (req.body.status && req.body.status !== 'completed') task.completedAt = null;
  await task.save();

  if (req.body.status && req.body.status !== previous.status) {
    recordActivity({
      organizationId: scope.organizationId, projectId: task.projectId, actorId: req.user!.id,
      action: 'task.status_changed', entityType: 'task', entityId: task._id,
      entityLabel: `${task.number} ${task.title}`, previousValue: previous.status, newValue: req.body.status,
      link: `/tasks/${task._id}`,
    });
    // Blockers threaten schedules — escalate to the project manager immediately.
    if (req.body.status === 'blocked') {
      const project = await Project.findOne({ _id: task.projectId, ...scope }).select('managerId').lean();
      const managerId = project?.managerId;
      if (managerId && String(managerId) !== req.user!.id) {
        await notify({
          organizationId: scope.organizationId, userId: managerId, actorId: req.user!.id,
          type: 'blocker_created', title: `${task.number} is blocked`,
          body: task.blockedReason || task.title, entityType: 'task', entityId: task._id, link: `/tasks/${task._id}`,
        });
      }
    }
    for (const watcherId of [task.assigneeId, task.reporterId, ...task.watcherIds].filter(Boolean)) {
      await notify({
        organizationId: scope.organizationId, userId: watcherId!, actorId: req.user!.id,
        type: 'task_status_changed', title: `${task.number} moved to ${req.body.status.replace(/_/g, ' ')}`,
        body: task.title, entityType: 'task', entityId: task._id, link: `/tasks/${task._id}`,
      });
    }
  }
  if (req.body.assigneeId && req.body.assigneeId !== previous.assigneeId) {
    await notify({
      organizationId: scope.organizationId, userId: req.body.assigneeId, actorId: req.user!.id,
      type: 'task_assigned', title: `${req.user!.displayName} assigned you ${task.number}`,
      body: task.title, entityType: 'task', entityId: task._id, link: `/tasks/${task._id}`,
    });
  }
  audit({ req, action: 'task.update', entityType: 'task', entityId: task._id, previousData: previous, newData: req.body });
  const populated = await Task.findById(task._id).populate(POPULATE).lean();
  return ok(res, populated, 'Task updated.');
}

/** PATCH /tasks/reorder — persist kanban ordering. */
export async function reorder(req: Request, res: Response) {
  const scope = orgScope(req);
  const { items } = req.body as { items: { id: string; status: string; order: number }[] };
  const ops = items.map((item) => ({
    updateOne: {
      filter: { _id: item.id, ...scope, deletedAt: null },
      update: { $set: { status: item.status as (typeof TASK_STATUSES)[number], order: item.order, updatedBy: req.user!._id } },
    },
  }));
  await Task.bulkWrite(ops);
  return ok(res, null, 'Board updated.');
}

/** POST /tasks/bulk — bulk status/assignment changes. */
export async function bulkUpdate(req: Request, res: Response) {
  const scope = orgScope(req);
  const { ids, set } = req.body as { ids: string[]; set: Record<string, unknown> };
  const allowed: Record<string, unknown> = {};
  for (const key of ['status', 'priority', 'assigneeId', 'moduleId', 'milestoneId', 'labels'] as const) {
    if (set[key] !== undefined) allowed[key] = set[key];
  }
  if (Object.keys(allowed).length === 0) throw ApiError.badRequest('Nothing to update.');
  const result = await Task.updateMany(
    { _id: { $in: ids }, ...scope, deletedAt: null },
    { $set: { ...allowed, updatedBy: req.user!._id } }
  );
  audit({ req, action: 'task.bulk_update', entityType: 'task', metadata: { count: result.modifiedCount, set: allowed } });
  return ok(res, { modified: result.modifiedCount }, `${result.modifiedCount} tasks updated.`);
}

export async function remove(req: Request, res: Response) {
  const scope = orgScope(req);
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, ...scope, deletedAt: null },
    { deletedAt: new Date(), updatedBy: req.user!._id },
    { new: true }
  ).lean();
  if (!task) throw ApiError.notFound('Task not found.');
  audit({ req, action: 'task.delete', entityType: 'task', entityId: task._id, previousData: { number: task.number, title: task.title } });
  return ok(res, null, 'Task deleted.');
}
