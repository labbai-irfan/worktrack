import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { env, isProd } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { ok, created } from '../../utils/respond';
import { signAccessToken, generateOpaqueToken, hashToken, refreshExpiryDate } from '../../utils/tokens';
import { Organization } from '../../models/Organization';
import { User } from '../../models/User';
import { Session } from '../../models/Session';
import { Role } from '../../models/Role';
import { Invitation } from '../../models/Invitation';
import { DEFAULT_ROLES } from '../../constants/permissions';
import { audit } from '../../services/audit.service';
import { sendMail, appLink } from '../../services/mailer.service';
import { nextIdentifier } from '../../utils/counters';

const REFRESH_COOKIE = 'wt_refresh';

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function setRefreshCookie(res: Response, token: string, remember: boolean) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: `/api/${env.API_VERSION}/auth`,
    ...(remember ? { expires: refreshExpiryDate() } : {}), // session cookie unless remember-me
  });
}

async function issueSession(res: Response, req: Request, userId: Types.ObjectId, organizationId: Types.ObjectId | null, remember = false) {
  const { token, hash } = generateOpaqueToken();
  await Session.create({
    userId,
    organizationId,
    refreshTokenHash: hash,
    userAgent: (req.headers['user-agent'] as string) ?? '',
    ip: req.ip ?? '',
    expiresAt: refreshExpiryDate(),
  });
  setRefreshCookie(res, token, remember);
  return signAccessToken(String(userId), organizationId ? String(organizationId) : null);
}

function publicUser(user: Record<string, unknown>) {
  const { passwordHash, passwordResetTokenHash, emailVerifyTokenHash, ...rest } = user;
  return rest;
}

/** POST /auth/register — organization onboarding step 1: org + admin account. */
export async function register(req: Request, res: Response) {
  const { organizationName, industry, companySize, country, timezone, firstName, lastName, email, password } = req.body;

  const existing = await User.findOne({ email }).lean();
  if (existing) throw ApiError.conflict('An account with this email already exists.');

  let slug = slugify(organizationName);
  if (await Organization.exists({ slug })) slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;

  const organization = await Organization.create({
    name: organizationName, slug, industry, companySize, country, timezone,
  });

  const roles = await Role.insertMany(
    DEFAULT_ROLES.map((r) => ({ ...r, organizationId: organization._id }))
  );
  const adminRole = roles.find((r) => r.key === 'org_admin')!;

  const passwordHash = await bcrypt.hash(password, 12);
  const employeeCode = await nextIdentifier(organization._id, 'employee', 'EMP');
  const user = await User.create({
    organizationId: organization._id,
    email,
    passwordHash,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`.trim(),
    roleId: adminRole._id,
    employeeCode,
    status: 'active',
    joiningDate: new Date(),
    emailVerifiedAt: null,
  });
  await Organization.updateOne({ _id: organization._id }, { createdBy: user._id });

  audit({ req, organizationId: organization._id, actorId: user._id, action: 'auth.register', entityType: 'organization', entityId: organization._id });

  const accessToken = await issueSession(res, req, user._id, organization._id, true);
  return created(res, {
    accessToken,
    user: publicUser(user.toObject()),
    organization: organization.toObject(),
  }, 'Organization created. Welcome to WorkTrack!');
}

/** POST /auth/login */
export async function login(req: Request, res: Response) {
  const { email, password, rememberMe } = req.body;
  // Uniform error prevents user enumeration.
  const invalid = ApiError.unauthorized('Invalid email or password.');

  const user = await User.findOne({ email, deletedAt: null }).select('+passwordHash');
  if (!user) throw invalid;
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw invalid;
  if (['suspended', 'exited', 'inactive'].includes(user.status)) {
    throw ApiError.forbidden('This account has been deactivated. Contact your administrator.');
  }

  user.lastLoginAt = new Date();
  if (user.status === 'invited') user.status = 'active';
  await user.save();

  const organization = user.organizationId ? await Organization.findById(user.organizationId).lean() : null;
  const role = user.roleId ? await Role.findById(user.roleId).lean() : null;

  audit({ req, organizationId: user.organizationId, actorId: user._id, action: 'auth.login', entityType: 'user', entityId: user._id });

  const accessToken = await issueSession(res, req, user._id, user.organizationId ?? null, rememberMe);
  return ok(res, {
    accessToken,
    user: publicUser(user.toObject()),
    organization,
    permissions: role?.permissions ?? [],
    roleKey: role?.key ?? null,
  }, 'Signed in successfully.');
}

/** POST /auth/refresh — rotating refresh tokens. */
export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!token) throw ApiError.unauthorized('No refresh token.');

  const hash = hashToken(token);
  const session = await Session.findOne({ refreshTokenHash: hash });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    res.clearCookie(REFRESH_COOKIE, { path: `/api/${env.API_VERSION}/auth` });
    throw ApiError.unauthorized('Session expired. Please sign in again.');
  }

  const user = await User.findById(session.userId).lean();
  if (!user || user.deletedAt || ['suspended', 'exited', 'inactive'].includes(user.status)) {
    throw ApiError.unauthorized('Account unavailable.');
  }

  // Rotate: revoke current session, issue a replacement.
  const { token: newToken, hash: newHash } = generateOpaqueToken();
  session.revokedAt = new Date();
  session.replacedByHash = newHash;
  await session.save();
  await Session.create({
    userId: user._id,
    organizationId: user.organizationId ?? null,
    refreshTokenHash: newHash,
    userAgent: (req.headers['user-agent'] as string) ?? '',
    ip: req.ip ?? '',
    expiresAt: refreshExpiryDate(),
  });
  setRefreshCookie(res, newToken, true);

  const role = user.roleId ? await Role.findById(user.roleId).lean() : null;
  const organization = user.organizationId ? await Organization.findById(user.organizationId).lean() : null;
  const accessToken = signAccessToken(String(user._id), user.organizationId ? String(user.organizationId) : null);
  return ok(res, {
    accessToken,
    user: publicUser(user),
    organization,
    permissions: role?.permissions ?? [],
    roleKey: role?.key ?? null,
  }, 'Token refreshed.');
}

/** POST /auth/logout */
export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (token) {
    await Session.updateOne({ refreshTokenHash: hashToken(token) }, { revokedAt: new Date() });
  }
  res.clearCookie(REFRESH_COOKIE, { path: `/api/${env.API_VERSION}/auth` });
  return ok(res, null, 'Signed out.');
}

/** GET /auth/me */
export async function me(req: Request, res: Response) {
  const user = await User.findById(req.user!._id)
    .populate('departmentId', 'name')
    .populate('teamId', 'name')
    .populate('roleId', 'key name permissions')
    .lean();
  if (!user) throw ApiError.notFound('Account not found.');
  const organization = user.organizationId ? await Organization.findById(user.organizationId).lean() : null;
  return ok(res, {
    user: publicUser(user),
    organization,
    permissions: req.user!.permissions,
    roleKey: req.user!.roleKey,
  });
}

/** PATCH /auth/me */
export async function updateProfile(req: Request, res: Response) {
  const updates = req.body;
  const user = await User.findByIdAndUpdate(req.user!._id, { $set: updates }, { new: true }).lean();
  return ok(res, publicUser(user as Record<string, unknown>), 'Profile updated.');
}

/** POST /auth/forgot-password */
export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  const user = await User.findOne({ email, deletedAt: null });
  // Always respond identically to prevent enumeration.
  const message = 'If an account exists for that email, a reset link has been sent.';
  if (user) {
    const { token, hash } = generateOpaqueToken();
    await User.updateOne(
      { _id: user._id },
      {
        passwordResetTokenHash: hash,
        passwordResetExpiresAt: new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_MINUTES * 60_000),
      }
    );
    await sendMail({
      to: email,
      subject: 'Reset your WorkTrack password',
      text: `Reset your password: ${appLink(`/reset-password?token=${token}`)} (valid ${env.PASSWORD_RESET_EXPIRES_MINUTES} minutes)`,
    });
    audit({ req, organizationId: user.organizationId, actorId: user._id, action: 'auth.forgot_password', entityType: 'user', entityId: user._id });
  }
  return ok(res, null, message);
}

/** POST /auth/reset-password */
export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body;
  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
    deletedAt: null,
  }).select('+passwordResetTokenHash +passwordResetExpiresAt');
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired.');

  user.passwordHash = await bcrypt.hash(password, 12);
  user.passwordChangedAt = new Date();
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  await user.save();

  // Revoke every session after a password reset.
  await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
  audit({ req, organizationId: user.organizationId, actorId: user._id, action: 'auth.reset_password', entityType: 'user', entityId: user._id });
  return ok(res, null, 'Password reset. Please sign in with your new password.');
}

/** POST /auth/change-password */
export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user!._id).select('+passwordHash');
  if (!user) throw ApiError.notFound();
  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) throw ApiError.badRequest('Current password is incorrect.');
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  await user.save();
  await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
  res.clearCookie(REFRESH_COOKIE, { path: `/api/${env.API_VERSION}/auth` });
  audit({ req, action: 'auth.change_password', entityType: 'user', entityId: user._id });
  return ok(res, null, 'Password changed. Please sign in again.');
}

/** GET /auth/sessions — login activity history. */
export async function listSessions(req: Request, res: Response) {
  const sessions = await Session.find({ userId: req.user!._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('-refreshTokenHash -replacedByHash')
    .lean();
  return ok(res, sessions);
}

/** DELETE /auth/sessions/:id — revoke one session. */
export async function revokeSession(req: Request, res: Response) {
  const session = await Session.findOne({ _id: req.params.id, userId: req.user!._id });
  if (!session) throw ApiError.notFound('Session not found.');
  session.revokedAt = new Date();
  await session.save();
  audit({ req, action: 'auth.revoke_session', entityType: 'session', entityId: session._id });
  return ok(res, null, 'Session revoked.');
}

/** DELETE /auth/sessions — revoke all sessions. */
export async function revokeAllSessions(req: Request, res: Response) {
  await Session.updateMany({ userId: req.user!._id, revokedAt: null }, { revokedAt: new Date() });
  res.clearCookie(REFRESH_COOKIE, { path: `/api/${env.API_VERSION}/auth` });
  audit({ req, action: 'auth.revoke_all_sessions', entityType: 'user', entityId: req.user!._id });
  return ok(res, null, 'All sessions revoked.');
}

/** GET /auth/invitations/:token — public inspection of a pending invite. */
export async function getInvitation(req: Request, res: Response) {
  const invitation = await Invitation.findOne({
    tokenHash: hashToken(req.params.token),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .populate('organizationId', 'name logoUrl')
    .populate('roleId', 'name key')
    .lean();
  if (!invitation) throw ApiError.notFound('This invitation is invalid or has expired.');
  return ok(res, {
    email: invitation.email,
    name: invitation.name,
    organization: invitation.organizationId,
    role: invitation.roleId,
  });
}

/** POST /auth/accept-invitation */
export async function acceptInvitation(req: Request, res: Response) {
  const { token, firstName, lastName, password } = req.body;
  const invitation = await Invitation.findOne({
    tokenHash: hashToken(token),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
  if (!invitation) throw ApiError.badRequest('This invitation is invalid or has expired.');

  const existing = await User.findOne({ organizationId: invitation.organizationId, email: invitation.email }).lean();
  if (existing) throw ApiError.conflict('An account with this email already exists in the organization.');

  const passwordHash = await bcrypt.hash(password, 12);
  const employeeCode = await nextIdentifier(invitation.organizationId, 'employee', 'EMP');
  const user = await User.create({
    organizationId: invitation.organizationId,
    email: invitation.email,
    passwordHash,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`.trim(),
    roleId: invitation.roleId,
    departmentId: invitation.departmentId,
    teamId: invitation.teamId,
    jobTitle: invitation.jobTitle,
    employeeCode,
    status: 'active',
    joiningDate: new Date(),
    emailVerifiedAt: new Date(), // email ownership proven by the invitation link
  });

  invitation.status = 'accepted';
  invitation.acceptedAt = new Date();
  await invitation.save();

  audit({ req, organizationId: invitation.organizationId, actorId: user._id, action: 'auth.accept_invitation', entityType: 'user', entityId: user._id });

  const accessToken = await issueSession(res, req, user._id, invitation.organizationId, true);
  const organization = await Organization.findById(invitation.organizationId).lean();
  const role = await Role.findById(invitation.roleId).lean();
  return created(res, {
    accessToken,
    user: publicUser(user.toObject()),
    organization,
    permissions: role?.permissions ?? [],
    roleKey: role?.key ?? null,
  }, 'Welcome aboard!');
}
