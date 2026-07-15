import { Router } from 'express';
import { z } from 'zod';
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize, orgScope } from '../../middlewares/auth';
import { ok } from '../../utils/respond';
import { ApiError } from '../../utils/ApiError';
import { Organization } from '../../models/Organization';
import { Role } from '../../models/Role';
import { PERMISSIONS } from '../../constants/permissions';
import { audit } from '../../services/audit.service';

const updateOrgSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  logoUrl: z.string().url().or(z.literal('')).optional(),
  industry: z.string().max(80).optional(),
  companySize: z.string().max(40).optional(),
  country: z.string().max(80).optional(),
  timezone: z.string().max(60).optional(),
  workingDays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional(),
  workingHours: z.object({ start: z.string(), end: z.string() }).optional(),
  settings: z
    .object({
      dateFormat: z.string().optional(),
      timeFormat: z.string().optional(),
      weekStart: z.string().optional(),
      dailyReportCutoff: z.string().optional(),
      allowSelfApproval: z.boolean().optional(),
      allowMultipleTimers: z.boolean().optional(),
    })
    .optional(),
});

const roleSchema = z.object({
  name: z.string().min(2).max(80),
  key: z.string().min(2).max(40).regex(/^[a-z0-9_]+$/),
  description: z.string().max(300).optional(),
  permissions: z.array(z.enum(PERMISSIONS)),
});

async function getCurrent(req: Request, res: Response) {
  const scope = orgScope(req);
  const organization = await Organization.findById(scope.organizationId).lean();
  if (!organization) throw ApiError.notFound('Organization not found.');
  return ok(res, organization);
}

async function updateCurrent(req: Request, res: Response) {
  const scope = orgScope(req);
  const before = await Organization.findById(scope.organizationId).lean();
  const organization = await Organization.findByIdAndUpdate(
    scope.organizationId,
    { $set: req.body },
    { new: true, runValidators: true }
  ).lean();
  audit({ req, action: 'organization.update', entityType: 'organization', entityId: scope.organizationId, previousData: before, newData: req.body });
  return ok(res, organization, 'Organization settings updated.');
}

async function listRoles(req: Request, res: Response) {
  const scope = orgScope(req);
  const roles = await Role.find(scope).sort({ isSystem: -1, name: 1 }).lean();
  return ok(res, roles);
}

async function createRole(req: Request, res: Response) {
  const scope = orgScope(req);
  if (await Role.exists({ ...scope, key: req.body.key })) throw ApiError.conflict('A role with this key already exists.');
  const role = await Role.create({ ...scope, ...req.body, isSystem: false });
  audit({ req, action: 'role.create', entityType: 'role', entityId: role._id, newData: req.body });
  return ok(res, role.toObject(), 'Role created.', {}, 201);
}

async function updateRole(req: Request, res: Response) {
  const scope = orgScope(req);
  const role = await Role.findOne({ _id: req.params.id, ...scope });
  if (!role) throw ApiError.notFound('Role not found.');
  if (role.isSystem && role.key === 'org_admin') throw ApiError.badRequest('The Organization Admin role cannot be modified.');
  const previous = { name: role.name, permissions: role.permissions };
  if (req.body.name) role.name = req.body.name;
  if (req.body.description !== undefined) role.description = req.body.description;
  if (req.body.permissions) role.set('permissions', req.body.permissions);
  await role.save();
  audit({ req, action: 'role.update', entityType: 'role', entityId: role._id, previousData: previous, newData: req.body });
  return ok(res, role.toObject(), 'Role updated.');
}

const router = Router();
router.use(authenticate);

router.get('/current', authorize('organization.view'), asyncHandler(getCurrent));
router.patch('/current', authorize('organization.manage'), validate(updateOrgSchema), asyncHandler(updateCurrent));
router.get('/roles', authorize('organization.view'), asyncHandler(listRoles));
router.post('/roles', authorize('organization.manage'), validate(roleSchema), asyncHandler(createRole));
router.patch('/roles/:id', authorize('organization.manage'), validate(roleSchema.partial()), asyncHandler(updateRole));
router.get('/permissions', authorize('organization.view'), (_req, res) => ok(res, PERMISSIONS));

export default router;
