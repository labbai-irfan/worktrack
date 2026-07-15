import { Schema, model, Types, InferSchemaType } from 'mongoose';
import { PROJECT_STATUSES, PROJECT_HEALTH, PRIORITIES } from '../constants/enums';

const projectSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    key: { type: String, required: true, uppercase: true, trim: true, maxlength: 10 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    coverImageUrl: { type: String, default: '' },
    icon: { type: String, default: 'folder' },
    color: { type: String, default: '#4f46e5' },
    client: { type: String, default: '' },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    members: {
      type: [
        {
          userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          role: { type: String, enum: ['manager', 'lead', 'member', 'viewer'], default: 'member' },
          addedAt: { type: Date, default: () => new Date() },
        },
      ],
      default: [],
    },
    startDate: { type: Date, default: null },
    targetDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    status: { type: String, enum: PROJECT_STATUSES, default: 'planned', index: true },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    health: { type: String, enum: PROJECT_HEALTH, default: 'healthy' },
    tags: { type: [String], default: [] },
    repositoryUrl: { type: String, default: '' },
    stagingUrl: { type: String, default: '' },
    productionUrl: { type: String, default: '' },
    documentationUrl: { type: String, default: '' },
    visibility: { type: String, enum: ['private', 'organization'], default: 'organization' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

projectSchema.index({ organizationId: 1, key: 1 }, { unique: true });
projectSchema.index({ organizationId: 1, status: 1 });
projectSchema.index({ organizationId: 1, 'members.userId': 1 });
projectSchema.index({ name: 'text', description: 'text' });

export type ProjectDoc = InferSchemaType<typeof projectSchema>;
export const Project = model('Project', projectSchema);
