import { Types } from 'mongoose';
import { Activity } from '../models/Activity';
import { logger } from '../config/logger';

interface ActivityInput {
  organizationId: Types.ObjectId | string;
  projectId?: Types.ObjectId | string | null;
  actorId: Types.ObjectId | string;
  action: string;
  entityType: string;
  entityId: Types.ObjectId | string;
  entityLabel?: string;
  previousValue?: string;
  newValue?: string;
  context?: string;
  link?: string;
}

/** Fire-and-forget activity-timeline record. */
export function recordActivity(input: ActivityInput): void {
  Activity.create({
    organizationId: input.organizationId,
    projectId: input.projectId ?? null,
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel ?? '',
    previousValue: input.previousValue ?? '',
    newValue: input.newValue ?? '',
    context: input.context ?? '',
    link: input.link ?? '',
  }).catch((err) => logger.warn({ err, action: input.action }, 'activity write failed'));
}
