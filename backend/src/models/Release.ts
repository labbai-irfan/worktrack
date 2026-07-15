import { Schema, model, Types, InferSchemaType } from 'mongoose';
import { RELEASE_STATUSES, ENVIRONMENTS } from '../constants/enums';

const releaseSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    version: { type: String, required: true, trim: true },
    name: { type: String, default: '' },
    environment: { type: String, enum: ENVIRONMENTS, default: 'production' },
    status: { type: String, enum: RELEASE_STATUSES, default: 'draft', index: true },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    releaseDate: { type: Date, default: null },
    deployedAt: { type: Date, default: null },
    taskIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Task' }], default: [] },
    issueIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Issue' }], default: [] },
    workUpdateIds: { type: [{ type: Schema.Types.ObjectId, ref: 'WorkUpdate' }], default: [] },
    notes: {
      features: { type: String, default: '' },
      improvements: { type: String, default: '' },
      bugFixes: { type: String, default: '' },
      breakingChanges: { type: String, default: '' },
      migrationNotes: { type: String, default: '' },
      rollbackPlan: { type: String, default: '' },
    },
    git: {
      repository: { type: String, default: '' },
      branch: { type: String, default: '' },
      commitHash: { type: String, default: '' },
      buildUrl: { type: String, default: '' },
      deploymentUrl: { type: String, default: '' },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

releaseSchema.index({ organizationId: 1, projectId: 1, version: 1 }, { unique: true });

export type ReleaseDoc = InferSchemaType<typeof releaseSchema>;
export const Release = model('Release', releaseSchema);
