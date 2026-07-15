import { Schema, model, Types, InferSchemaType } from 'mongoose';
import { MILESTONE_STATUSES } from '../constants/enums';

const milestoneSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    status: { type: String, enum: MILESTONE_STATUSES, default: 'planned' },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export type MilestoneDoc = InferSchemaType<typeof milestoneSchema>;
export const Milestone = model('Milestone', milestoneSchema);
