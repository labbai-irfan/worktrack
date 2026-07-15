import { Counter } from '../models/Counter';
import { Types } from 'mongoose';

/**
 * Atomic organization-scoped sequence generator.
 * Never derives identifiers from collection counts.
 */
export async function nextSequence(organizationId: Types.ObjectId | string, key: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { organizationId, key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

export async function nextIdentifier(
  organizationId: Types.ObjectId | string,
  key: string,
  prefix: string
): Promise<string> {
  const seq = await nextSequence(organizationId, key);
  return `${prefix}-${seq}`;
}
