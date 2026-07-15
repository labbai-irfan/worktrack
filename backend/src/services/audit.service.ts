import { Request } from 'express';
import { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog';
import { logger } from '../config/logger';

const SENSITIVE_KEYS = /password|token|secret|cookie|authorization|apikey|api_key/i;
// Masks sensitive values embedded in JSON-ish strings, e.g. request/response payloads.
const SENSITIVE_IN_STRING = /("?(?:password|token|secret|cookie|authorization|apikey|api_key)[\w-]*"?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,}&]+)/gi;

export function redact(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(SENSITIVE_IN_STRING, '$1"[REDACTED]"');
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : redact(v);
    }
    return out;
  }
  return value;
}

interface AuditInput {
  req?: Request;
  organizationId?: Types.ObjectId | string | null;
  actorId?: Types.ObjectId | string | null;
  action: string;
  entityType?: string;
  entityId?: Types.ObjectId | string | null;
  previousData?: unknown;
  newData?: unknown;
  metadata?: unknown;
}

/** Fire-and-forget immutable audit record. Never blocks or fails the request. */
export function audit(input: AuditInput): void {
  const { req } = input;
  AuditLog.create({
    organizationId: input.organizationId ?? req?.user?.organizationId ?? null,
    actorId: input.actorId ?? req?.user?._id ?? null,
    action: input.action,
    entityType: input.entityType ?? '',
    entityId: input.entityId ?? null,
    previousData: input.previousData != null ? redact(input.previousData) : null,
    newData: input.newData != null ? redact(input.newData) : null,
    metadata: input.metadata != null ? redact(input.metadata) : null,
    ip: req?.ip ?? '',
    userAgent: (req?.headers['user-agent'] as string) ?? '',
  }).catch((err) => logger.warn({ err, action: input.action }, 'audit log write failed'));
}
