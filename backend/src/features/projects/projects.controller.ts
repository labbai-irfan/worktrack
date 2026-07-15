import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ok, created } from '../../utils/respond';
import { getPagination, pageMeta } from '../../utils/pagination';
import { orgScope } from '../../middlewares/auth';
import { Project } from '../../models/Project';
import { Task } from '../../models/Task';
import { Issue } from '../../models/Issue';
import { WorkUpdate } from '../../models/WorkUpdate';
import { audit } from '../../services/audit.service';
import { recordActivity } from '../../services/activity.service';
import { computeProjectHealth } from '../../services/projectHealth.service';

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Members see org-visible projects plus projects they belong to; managers see all. */
function visibilityFilter(req: Request): Record<string, unknown> {
  const scope = orgScope(req);
  const canSeeAll = req.user!.permissions.includes('project.update') || req.user!.roleKey === 'org_admin';
  if (canSeeAll) return { ...scope };
  return {
    ...scope,
    $or: [
      { visibility: 'organization' },
      { 'members.userId': req.user!._id },
      { managerId: req.user!._id },
    ],
  };
}

export async function list(req: Request, res: Response) {
  const { page, limit, skip, sort } = getPagination(req, '-updatedAt');
  const filter = visibilityFilter(req);
  if (req.query.status) filter.status = req.query.status;
  else filter.status = { $ne: 'archived' };
  if (req.query.q) filter.name = { $regex: String(req.query.q), $options: 'i' };
  if (req.query.mine === 'true') {
    filter.$or = [{ 'members.userId': req.user!._id }, { managerId: req.user!._id }];
  }
  const [items, total] = await Promise.all([
    Project.find(filter).sort(sort).skip(skip).limit(limit)
      .populate('managerId', 'displayName avatarUrl')
      .populate('members.userId', 'displayName avatarUrl')
      .lean(),
    Project.countDocuments(filter),
  ]);
  return ok(res, items, 'OK', pageMeta(page, limit, total));
}

export async function get(req: Request, res: Response) {
  const project = await Project.findOne({ _id: req.params.id, ...visibilityFilter(req) })
    .populate('managerId', 'displayName avatarUrl jobTitle')
    .populate('members.userId', 'displayName avatarUrl jobTitle')
    .lean();
  if (!project) throw ApiError.notFound('Project not found.');

  const [taskCounts, openIssues, criticalIssues, updateCount] = await Promise.all([
    Task.aggregate([
      { $match: { projectId: project._id, deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Issue.countDocuments({ projectId: project._id, status: { $nin: ['resolved', 'closed', 'duplicate', 'wont_fix'] }, deletedAt: null }),
    Issue.countDocuments({ projectId: project._id, severity: 'critical', status: { $nin: ['resolved', 'closed'] }, deletedAt: null }),
    WorkUpdate.countDocuments({ projectId: project._id, deletedAt: null }),
  ]);

  return ok(res, {
    ...project,
    stats: {
      tasksByStatus: Object.fromEntries(taskCounts.map((t) => [t._id, t.count])),
      openIssues,
      criticalIssues,
      workUpdates: updateCount,
    },
  });
}

/** GET /projects/:id/health — transparent, rule-based health score with reasons. */
export async function health(req: Request, res: Response) {
  const project = await Project.findOne({ _id: req.params.id, ...visibilityFilter(req) }).select('status organizationId').lean();
  if (!project) throw ApiError.notFound('Project not found.');
  const result = await computeProjectHealth({ organizationId: project.organizationId }, project._id, project.status);
  return ok(res, result);
}

export async function create(req: Request, res: Response) {
  const scope = orgScope(req);
  const { name, key } = req.body;
  const projectKey = String(key).toUpperCase();
  if (await Project.exists({ ...scope, key: projectKey })) {
    throw ApiError.conflict(`Project key "${projectKey}" is already in use.`);
  }
  const members = req.body.members ?? [];
  const managerId = req.body.managerId ?? req.user!._id;
  if (!members.some((m: { userId: string }) => String(m.userId) === String(managerId))) {
    members.push({ userId: managerId, role: 'manager' });
  }
  const project = await Project.create({
    ...scope,
    ...req.body,
    key: projectKey,
    slug: slugify(name),
    managerId,
    members,
    createdBy: req.user!._id,
  });
  audit({ req, action: 'project.create', entityType: 'project', entityId: project._id, newData: { name, key: projectKey } });
  recordActivity({
    organizationId: scope.organizationId, projectId: project._id, actorId: req.user!.id,
    action: 'project.created', entityType: 'project', entityId: project._id, entityLabel: project.name,
    link: `/projects/${project._id}`,
  });
  return created(res, project.toObject(), 'Project created.');
}

export async function update(req: Request, res: Response) {
  const scope = orgScope(req);
  const project = await Project.findOne({ _id: req.params.id, ...scope });
  if (!project) throw ApiError.notFound('Project not found.');
  const previous = { status: project.status, health: project.health, progress: project.progress };
  Object.assign(project, req.body, { updatedBy: req.user!._id });
  if (req.body.status === 'completed' && !project.completedAt) project.completedAt = new Date();
  await project.save();
  audit({ req, action: 'project.update', entityType: 'project', entityId: project._id, previousData: previous, newData: req.body });
  if (req.body.status && req.body.status !== previous.status) {
    recordActivity({
      organizationId: scope.organizationId, projectId: project._id, actorId: req.user!.id,
      action: 'project.status_changed', entityType: 'project', entityId: project._id,
      entityLabel: project.name, previousValue: previous.status, newValue: req.body.status,
      link: `/projects/${project._id}`,
    });
  }
  return ok(res, project.toObject(), 'Project updated.');
}

export async function archive(req: Request, res: Response) {
  const scope = orgScope(req);
  const project = await Project.findOneAndUpdate(
    { _id: req.params.id, ...scope },
    { status: 'archived', archivedAt: new Date(), updatedBy: req.user!._id },
    { new: true }
  ).lean();
  if (!project) throw ApiError.notFound('Project not found.');
  audit({ req, action: 'project.archive', entityType: 'project', entityId: project._id });
  return ok(res, null, 'Project archived.');
}

export async function updateMembers(req: Request, res: Response) {
  const scope = orgScope(req);
  const project = await Project.findOne({ _id: req.params.id, ...scope });
  if (!project) throw ApiError.notFound('Project not found.');
  const previous = project.members.map((m) => ({ userId: String(m.userId), role: m.role }));
  project.set('members', req.body.members);
  if (req.body.managerId !== undefined) project.managerId = req.body.managerId;
  project.updatedBy = req.user!._id;
  await project.save();
  audit({ req, action: 'project.manage_members', entityType: 'project', entityId: project._id, previousData: previous, newData: req.body.members });
  return ok(res, project.toObject(), 'Project members updated.');
}
