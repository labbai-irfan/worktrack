import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize, orgScope } from '../../middlewares/auth';
import { ok, created } from '../../utils/respond';
import { ApiError } from '../../utils/ApiError';
import { Release } from '../../models/Release';
import { Task } from '../../models/Task';
import { Issue } from '../../models/Issue';
import { RELEASE_STATUSES, ENVIRONMENTS } from '../../constants/enums';
import { audit } from '../../services/audit.service';
import { recordActivity } from '../../services/activity.service';
import { notifyMany } from '../../services/notification.service';
import { Project } from '../../models/Project';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const createSchema = z.object({
  projectId: objectId,
  version: z.string().min(1).max(40),
  name: z.string().max(160).optional(),
  environment: z.enum(ENVIRONMENTS).optional(),
  status: z.enum(RELEASE_STATUSES).optional(),
  managerId: objectId.nullable().optional(),
  releaseDate: z.coerce.date().nullable().optional(),
  taskIds: z.array(objectId).max(500).optional(),
  issueIds: z.array(objectId).max(500).optional(),
  workUpdateIds: z.array(objectId).max(500).optional(),
  notes: z.object({
    features: z.string().max(20_000).optional(),
    improvements: z.string().max(20_000).optional(),
    bugFixes: z.string().max(20_000).optional(),
    breakingChanges: z.string().max(10_000).optional(),
    migrationNotes: z.string().max(10_000).optional(),
    rollbackPlan: z.string().max(10_000).optional(),
  }).optional(),
  git: z.object({
    repository: z.string().max(300).optional(),
    branch: z.string().max(200).optional(),
    commitHash: z.string().max(64).optional(),
    buildUrl: z.string().url().or(z.literal('')).optional(),
    deploymentUrl: z.string().url().or(z.literal('')).optional(),
  }).optional(),
});

const updateSchema = createSchema.partial().omit({ projectId: true });

async function list(req: Request, res: Response) {
  const scope = orgScope(req);
  const filter: Record<string, unknown> = { ...scope };
  if (req.query.projectId) filter.projectId = req.query.projectId;
  if (req.query.status) filter.status = req.query.status;
  const items = await Release.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('projectId', 'name key color')
    .populate('managerId', 'displayName avatarUrl')
    .lean();
  return ok(res, items);
}

async function get(req: Request, res: Response) {
  const scope = orgScope(req);
  const release = await Release.findOne({ _id: req.params.id, ...scope })
    .populate('projectId', 'name key color')
    .populate('managerId', 'displayName avatarUrl')
    .populate('taskIds', 'number title type status')
    .populate('issueIds', 'number title type severity status')
    .lean();
  if (!release) throw ApiError.notFound('Release not found.');
  return ok(res, release);
}

async function create(req: Request, res: Response) {
  const scope = orgScope(req);
  if (await Release.exists({ ...scope, projectId: req.body.projectId, version: req.body.version })) {
    throw ApiError.conflict(`Version ${req.body.version} already exists for this project.`);
  }
  const release = await Release.create({
    ...scope, ...req.body,
    managerId: req.body.managerId ?? req.user!._id,
    createdBy: req.user!._id,
  });
  audit({ req, action: 'release.create', entityType: 'release', entityId: release._id, newData: { version: release.version } });
  recordActivity({
    organizationId: scope.organizationId, projectId: release.projectId, actorId: req.user!.id,
    action: 'release.created', entityType: 'release', entityId: release._id,
    entityLabel: `${release.version}`, link: `/releases/${release._id}`,
  });
  return created(res, release.toObject(), 'Release created.');
}

async function update(req: Request, res: Response) {
  const scope = orgScope(req);
  const release = await Release.findOne({ _id: req.params.id, ...scope });
  if (!release) throw ApiError.notFound('Release not found.');
  const previousStatus = release.status;
  Object.assign(release, req.body, { updatedBy: req.user!._id });
  if (req.body.status === 'deployed' && previousStatus !== 'deployed') {
    release.deployedAt = new Date();
    const project = await Project.findById(release.projectId).lean();
    if (project) {
      await notifyMany(
        project.members.map((m) => m.userId),
        {
          organizationId: scope.organizationId, actorId: req.user!.id,
          type: 'deployment_completed',
          title: `${project.name} ${release.version} deployed to ${release.environment}`,
          entityType: 'release', entityId: release._id, link: `/releases/${release._id}`,
        }
      );
    }
    recordActivity({
      organizationId: scope.organizationId, projectId: release.projectId, actorId: req.user!.id,
      action: 'release.deployed', entityType: 'release', entityId: release._id,
      entityLabel: release.version, newValue: release.environment, link: `/releases/${release._id}`,
    });
  }
  await release.save();
  audit({ req, action: 'release.update', entityType: 'release', entityId: release._id, previousData: { status: previousStatus }, newData: req.body });
  return ok(res, release.toObject(), 'Release updated.');
}

/** GET /releases/:id/notes — release notes generated from linked records. */
async function generateNotes(req: Request, res: Response) {
  const scope = orgScope(req);
  const release = await Release.findOne({ _id: req.params.id, ...scope }).lean();
  if (!release) throw ApiError.notFound('Release not found.');
  const [tasks, issues] = await Promise.all([
    Task.find({ _id: { $in: release.taskIds }, ...scope }).select('number title type').lean(),
    Issue.find({ _id: { $in: release.issueIds }, ...scope }).select('number title type severity').lean(),
  ]);
  const features = tasks.filter((t) => ['feature', 'improvement', 'ui_ux'].includes(t.type));
  const other = tasks.filter((t) => !['feature', 'improvement', 'ui_ux'].includes(t.type));
  const lines: string[] = [`# ${release.name || release.version}`, ''];
  if (features.length) {
    lines.push('## Features & Improvements');
    features.forEach((t) => lines.push(`- ${t.number}: ${t.title}`));
    lines.push('');
  }
  if (issues.length) {
    lines.push('## Bug Fixes');
    issues.forEach((i) => lines.push(`- ${i.number}: ${i.title} (${i.severity})`));
    lines.push('');
  }
  if (other.length) {
    lines.push('## Other Changes');
    other.forEach((t) => lines.push(`- ${t.number}: ${t.title}`));
  }
  return ok(res, { markdown: lines.join('\n') });
}

const router = Router();
router.use(authenticate);
router.get('/', authorize('project.view'), asyncHandler(list));
router.get('/:id', authorize('project.view'), asyncHandler(get));
router.get('/:id/notes', authorize('project.view'), asyncHandler(generateNotes));
router.post('/', authorize('release.create'), validate(createSchema), asyncHandler(create));
router.patch('/:id', authorize('release.create', 'release.deploy'), validate(updateSchema), asyncHandler(update));

export default router;
