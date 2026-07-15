import { Types } from 'mongoose';
import { Notification } from '../models/Notification';
import { logger } from '../config/logger';
import { emitToUser } from '../sockets';

interface NotifyInput {
  organizationId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  actorId?: Types.ObjectId | string | null;
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: Types.ObjectId | string | null;
  link?: string;
}

/** Persists an in-app notification and pushes it over Socket.IO. Never notifies the actor about their own action. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    if (input.actorId && String(input.actorId) === String(input.userId)) return;
    const doc = await Notification.create({
      organizationId: input.organizationId,
      userId: input.userId,
      actorId: input.actorId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? '',
      entityType: input.entityType ?? '',
      entityId: input.entityId ?? null,
      link: input.link ?? '',
    });
    emitToUser(String(input.userId), 'notification:new', doc.toObject());
  } catch (err) {
    logger.warn({ err, type: input.type }, 'notification write failed');
  }
}

export async function notifyMany(userIds: (Types.ObjectId | string)[], input: Omit<NotifyInput, 'userId'>): Promise<void> {
  const unique = [...new Set(userIds.map(String))];
  await Promise.all(unique.map((userId) => notify({ ...input, userId })));
}
