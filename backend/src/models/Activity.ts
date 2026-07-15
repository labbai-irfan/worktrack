import { Schema, model, Types, InferSchemaType } from 'mongoose';

const activitySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true }, // e.g. "task.status_changed"
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    entityLabel: { type: String, default: '' },
    previousValue: { type: String, default: '' },
    newValue: { type: String, default: '' },
    context: { type: String, default: '' },
    link: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ organizationId: 1, projectId: 1, createdAt: -1 });
activitySchema.index({ organizationId: 1, actorId: 1, createdAt: -1 });

export type ActivityDoc = InferSchemaType<typeof activitySchema>;
export const Activity = model('Activity', activitySchema);
