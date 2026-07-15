import { Schema, model, Types, InferSchemaType } from 'mongoose';
import { MODULE_STATUSES, PRIORITIES } from '../constants/enums';

/** Dynamic, configurable project module (e.g. Leads, Salary, Attendance, custom). */
const moduleSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    key: { type: String, required: true, uppercase: true, trim: true, maxlength: 12 },
    description: { type: String, default: '' },
    icon: { type: String, default: 'puzzle' },
    color: { type: String, default: '#0891b2' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    memberIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    status: { type: String, enum: MODULE_STATUSES, default: 'active' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    startDate: { type: Date, default: null },
    targetDate: { type: Date, default: null },
    tags: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

moduleSchema.index({ organizationId: 1, projectId: 1, key: 1 }, { unique: true });

export type ModuleDoc = InferSchemaType<typeof moduleSchema>;
export const ProjectModule = model('Module', moduleSchema);
