import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { ok, created } from '../../utils/respond';
import { getPagination, pageMeta } from '../../utils/pagination';
import { orgScope } from '../../middlewares/auth';
import { User } from '../../models/User';
import { Role } from '../../models/Role';
import { Invitation } from '../../models/Invitation';
import { generateOpaqueToken } from '../../utils/tokens';
import { audit } from '../../services/audit.service';
import { sendMail, appLink } from '../../services/mailer.service';

/** GET /employees */
export async function list(req: Request, res: Response) {
  const scope = orgScope(req);
  const { page, limit, skip, sort } = getPagination(req, 'displayName');
  const filter: Record<string, unknown> = { ...scope, deletedAt: null };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.departmentId) filter.departmentId = req.query.departmentId;
  if (req.query.teamId) filter.teamId = req.query.teamId;
  if (req.query.q) {
    const q = String(req.query.q);
    filter.$or = [
      { displayName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { employeeCode: { $regex: q, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit)
      .populate('roleId', 'key name')
      .populate('departmentId', 'name')
      .populate('teamId', 'name')
      .populate('managerId', 'displayName avatarUrl')
      .lean(),
    User.countDocuments(filter),
  ]);
  return ok(res, items, 'OK', pageMeta(page, limit, total));
}

/** GET /employees/:id */
export async function get(req: Request, res: Response) {
  const scope = orgScope(req);
  const user = await User.findOne({ _id: req.params.id, ...scope, deletedAt: null })
    .populate('roleId', 'key name permissions')
    .populate('departmentId', 'name')
    .populate('teamId', 'name')
    .populate('managerId', 'displayName avatarUrl')
    .lean();
  if (!user) throw ApiError.notFound('Employee not found.');
  return ok(res, user);
}

/** POST /employees/invite */
export async function invite(req: Request, res: Response) {
  const scope = orgScope(req);
  const { email, name, roleId, departmentId, teamId, jobTitle } = req.body;

  const role = await Role.findOne({ _id: roleId, ...scope }).lean();
  if (!role) throw ApiError.badRequest('Invalid role.');
  if (await User.exists({ ...scope, email, deletedAt: null })) {
    throw ApiError.conflict('This person is already a member of the organization.');
  }
  await Invitation.updateMany({ ...scope, email, status: 'pending' }, { status: 'revoked' });

  const { token, hash } = generateOpaqueToken();
  const invitation = await Invitation.create({
    ...scope,
    email,
    name: name ?? '',
    roleId,
    departmentId: departmentId ?? null,
    teamId: teamId ?? null,
    jobTitle: jobTitle ?? '',
    tokenHash: hash,
    invitedBy: req.user!._id,
    expiresAt: new Date(Date.now() + env.INVITATION_EXPIRES_DAYS * 86_400_000),
  });

  const inviteUrl = appLink(`/accept-invitation?token=${token}`);
  await sendMail({
    to: email,
    subject: `You've been invited to join WorkTrack`,
    text: `${req.user!.displayName} invited you to join their workspace. Accept: ${inviteUrl}`,
  });

  audit({ req, action: 'employee.invite', entityType: 'invitation', entityId: invitation._id, newData: { email, roleId } });
  // The invite link is returned so admins can share it manually when SMTP is not configured.
  return created(res, { invitation: { ...invitation.toObject(), tokenHash: undefined }, inviteUrl }, 'Invitation sent.');
}

/** GET /employees/invitations */
export async function listInvitations(req: Request, res: Response) {
  const scope = orgScope(req);
  const invitations = await Invitation.find({ ...scope, status: 'pending', expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .populate('roleId', 'name key')
    .populate('invitedBy', 'displayName')
    .select('-tokenHash')
    .lean();
  return ok(res, invitations);
}

/** DELETE /employees/invitations/:id */
export async function revokeInvitation(req: Request, res: Response) {
  const scope = orgScope(req);
  const invitation = await Invitation.findOne({ _id: req.params.id, ...scope, status: 'pending' });
  if (!invitation) throw ApiError.notFound('Invitation not found.');
  invitation.status = 'revoked';
  await invitation.save();
  audit({ req, action: 'employee.invitation_revoked', entityType: 'invitation', entityId: invitation._id });
  return ok(res, null, 'Invitation revoked.');
}

/** PATCH /employees/:id */
export async function update(req: Request, res: Response) {
  const scope = orgScope(req);
  const user = await User.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!user) throw ApiError.notFound('Employee not found.');

  const previous = { roleId: user.roleId, status: user.status, departmentId: user.departmentId, teamId: user.teamId };
  const allowed = ['firstName', 'lastName', 'displayName', 'jobTitle', 'phone', 'departmentId', 'teamId',
    'managerId', 'roleId', 'status', 'joiningDate', 'workLocation', 'timezone', 'skills', 'employeeCode', 'avatarUrl'] as const;
  for (const key of allowed) {
    if (req.body[key] !== undefined) (user as unknown as Record<string, unknown>)[key] = req.body[key];
  }
  if (req.body.roleId) {
    const role = await Role.findOne({ _id: req.body.roleId, ...scope }).lean();
    if (!role) throw ApiError.badRequest('Invalid role.');
  }
  await user.save();
  audit({ req, action: 'employee.update', entityType: 'user', entityId: user._id, previousData: previous, newData: req.body });
  return ok(res, user.toObject(), 'Employee updated.');
}

/** POST /employees/:id/deactivate and /activate */
export async function setActive(req: Request, res: Response) {
  const scope = orgScope(req);
  const activate = req.path.endsWith('/activate');
  if (!activate && req.params.id === req.user!.id) throw ApiError.badRequest('You cannot deactivate your own account.');
  const user = await User.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!user) throw ApiError.notFound('Employee not found.');
  user.status = activate ? 'active' : 'inactive';
  await user.save();
  if (!activate) {
    const { Session } = await import('../../models/Session');
    await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
  }
  audit({ req, action: activate ? 'employee.activate' : 'employee.deactivate', entityType: 'user', entityId: user._id });
  return ok(res, user.toObject(), activate ? 'Employee activated.' : 'Employee deactivated.');
}

/** POST /employees/:id/reset-password (admin-set temporary password) */
export async function adminResetPassword(req: Request, res: Response) {
  const scope = orgScope(req);
  const { password } = req.body;
  const user = await User.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!user) throw ApiError.notFound('Employee not found.');
  user.passwordHash = await bcrypt.hash(password, 12);
  user.passwordChangedAt = new Date();
  await user.save();
  const { Session } = await import('../../models/Session');
  await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
  audit({ req, action: 'employee.admin_reset_password', entityType: 'user', entityId: user._id });
  return ok(res, null, 'Password updated. The employee must sign in again.');
}
