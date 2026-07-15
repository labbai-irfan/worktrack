import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { verifyAccessToken } from '../utils/tokens';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Permission } from '../constants/permissions';

export interface AuthUser {
  id: string;
  _id: Types.ObjectId;
  organizationId: Types.ObjectId | null;
  email: string;
  displayName: string;
  roleKey: string;
  permissions: Permission[];
  isSuperAdmin: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/**
 * Resolves identity, organization scope, and permissions on the server for
 * every request. Never trusts client-provided ids, roles, or permissions.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw ApiError.unauthorized();

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new ApiError(401, 'Session expired. Please sign in again.', 'TOKEN_EXPIRED');
    }

    const user = await User.findById(payload.sub).lean();
    if (!user || user.deletedAt) throw ApiError.unauthorized('Account not found.');
    if (user.status === 'suspended' || user.status === 'exited' || user.status === 'inactive') {
      throw ApiError.forbidden('This account has been deactivated.');
    }

    const role = user.roleId ? await Role.findById(user.roleId).lean() : null;

    req.user = {
      id: String(user._id),
      _id: user._id,
      organizationId: user.organizationId ?? null,
      email: user.email,
      displayName: user.displayName,
      roleKey: role?.key ?? (user.isSuperAdmin ? 'super_admin' : 'none'),
      permissions: (role?.permissions ?? []) as Permission[],
      isSuperAdmin: Boolean(user.isSuperAdmin),
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Requires at least one of the given permission keys. */
export function authorize(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return next(ApiError.unauthorized());
    if (user.isSuperAdmin) return next();
    if (required.length === 0) return next();
    if (required.some((p) => user.permissions.includes(p))) return next();
    return next(ApiError.forbidden());
  };
}

/** Every organization-owned query must be scoped through this. */
export function orgScope(req: Request): { organizationId: Types.ObjectId } {
  const orgId = req.user?.organizationId;
  if (!orgId) throw ApiError.forbidden('No organization scope for this account.');
  return { organizationId: orgId };
}
