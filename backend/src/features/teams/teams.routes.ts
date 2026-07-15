import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize, orgScope } from '../../middlewares/auth';
import { ok, created } from '../../utils/respond';
import { ApiError } from '../../utils/ApiError';
import { Department } from '../../models/Department';
import { Team } from '../../models/Team';
import { audit } from '../../services/audit.service';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const departmentSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional(),
  headId: objectId.nullable().optional(),
});

const teamSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional(),
  departmentId: objectId.nullable().optional(),
  leadId: objectId.nullable().optional(),
  memberIds: z.array(objectId).max(200).optional(),
});

// --- Departments ---
async function listDepartments(req: Request, res: Response) {
  const scope = orgScope(req);
  const items = await Department.find({ ...scope, archivedAt: null })
    .sort({ name: 1 })
    .populate('headId', 'displayName avatarUrl')
    .lean();
  return ok(res, items);
}

async function createDepartment(req: Request, res: Response) {
  const scope = orgScope(req);
  const dept = await Department.create({ ...scope, ...req.body, createdBy: req.user!._id });
  audit({ req, action: 'department.create', entityType: 'department', entityId: dept._id, newData: req.body });
  return created(res, dept.toObject(), 'Department created.');
}

async function updateDepartment(req: Request, res: Response) {
  const scope = orgScope(req);
  const dept = await Department.findOneAndUpdate({ _id: req.params.id, ...scope }, { $set: req.body }, { new: true }).lean();
  if (!dept) throw ApiError.notFound('Department not found.');
  audit({ req, action: 'department.update', entityType: 'department', entityId: dept._id, newData: req.body });
  return ok(res, dept, 'Department updated.');
}

async function archiveDepartment(req: Request, res: Response) {
  const scope = orgScope(req);
  const dept = await Department.findOneAndUpdate({ _id: req.params.id, ...scope }, { archivedAt: new Date() }, { new: true }).lean();
  if (!dept) throw ApiError.notFound('Department not found.');
  audit({ req, action: 'department.archive', entityType: 'department', entityId: dept._id });
  return ok(res, null, 'Department archived.');
}

// --- Teams ---
async function listTeams(req: Request, res: Response) {
  const scope = orgScope(req);
  const filter: Record<string, unknown> = { ...scope, archivedAt: null };
  if (req.query.departmentId) filter.departmentId = req.query.departmentId;
  const items = await Team.find(filter)
    .sort({ name: 1 })
    .populate('leadId', 'displayName avatarUrl')
    .populate('memberIds', 'displayName avatarUrl jobTitle')
    .populate('departmentId', 'name')
    .lean();
  return ok(res, items);
}

async function createTeam(req: Request, res: Response) {
  const scope = orgScope(req);
  const team = await Team.create({ ...scope, ...req.body, createdBy: req.user!._id });
  audit({ req, action: 'team.create', entityType: 'team', entityId: team._id, newData: req.body });
  return created(res, team.toObject(), 'Team created.');
}

async function updateTeam(req: Request, res: Response) {
  const scope = orgScope(req);
  const team = await Team.findOneAndUpdate({ _id: req.params.id, ...scope }, { $set: req.body }, { new: true }).lean();
  if (!team) throw ApiError.notFound('Team not found.');
  audit({ req, action: 'team.update', entityType: 'team', entityId: team._id, newData: req.body });
  return ok(res, team, 'Team updated.');
}

async function archiveTeam(req: Request, res: Response) {
  const scope = orgScope(req);
  const team = await Team.findOneAndUpdate({ _id: req.params.id, ...scope }, { archivedAt: new Date() }, { new: true }).lean();
  if (!team) throw ApiError.notFound('Team not found.');
  audit({ req, action: 'team.archive', entityType: 'team', entityId: team._id });
  return ok(res, null, 'Team archived.');
}

const router = Router();
router.use(authenticate);

router.get('/departments', authorize('employee.view'), asyncHandler(listDepartments));
router.post('/departments', authorize('department.manage', 'organization.manage'), validate(departmentSchema), asyncHandler(createDepartment));
router.patch('/departments/:id', authorize('department.manage', 'organization.manage'), validate(departmentSchema.partial()), asyncHandler(updateDepartment));
router.delete('/departments/:id', authorize('department.manage', 'organization.manage'), asyncHandler(archiveDepartment));

router.get('/', authorize('employee.view'), asyncHandler(listTeams));
router.post('/', authorize('team.create', 'team.manage'), validate(teamSchema), asyncHandler(createTeam));
router.patch('/:id', authorize('team.manage'), validate(teamSchema.partial()), asyncHandler(updateTeam));
router.delete('/:id', authorize('team.manage'), asyncHandler(archiveTeam));

export default router;
