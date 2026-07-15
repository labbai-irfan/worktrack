import { Schema, model, Types, InferSchemaType } from 'mongoose';
import {
  WORK_TYPES,
  WORK_UPDATE_STATUSES,
  WORK_PROGRESS_STATUSES,
  ENVIRONMENTS,
} from '../constants/enums';

const reviewEventSchema = new Schema(
  {
    action: {
      type: String,
      enum: ['submitted', 'review_started', 'changes_requested', 'approved', 'rejected', 'resubmitted'],
      required: true,
    },
    byId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: String, default: '' },
    at: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const workUpdateSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', default: null, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', default: null },
    milestoneId: { type: Schema.Types.ObjectId, ref: 'Milestone', default: null },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // author
    number: { type: String, required: true }, // e.g. "UPD-2051"
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: '' },
    workType: { type: String, enum: WORK_TYPES, default: 'feature' },
    progressStatus: { type: String, enum: WORK_PROGRESS_STATUSES, default: 'in_progress' },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    workDate: { type: Date, required: true, index: true },

    // Structured detail
    planned: { type: String, default: '' },
    implemented: { type: String, default: '' },
    changed: { type: String, default: '' },
    remaining: { type: String, default: '' },
    outcome: { type: String, default: '' },
    blockers: { type: String, default: '' },
    dependencies: { type: String, default: '' },
    assistanceRequired: { type: String, default: '' },
    nextAction: { type: String, default: '' },

    time: {
      startTime: { type: String, default: '' }, // "HH:mm" in org timezone
      endTime: { type: String, default: '' },
      breakMinutes: { type: Number, default: 0 },
      minutesSpent: { type: Number, default: 0 },
      billable: { type: Boolean, default: false },
      source: { type: String, enum: ['manual', 'timer'], default: 'manual' },
    },

    technical: {
      environment: { type: String, enum: ENVIRONMENTS, default: 'development' },
      repository: { type: String, default: '' },
      branch: { type: String, default: '' },
      commitHash: { type: String, default: '' },
      pullRequestUrl: { type: String, default: '' },
      deploymentUrl: { type: String, default: '' },
      apiEndpoint: { type: String, default: '' },
      httpMethod: { type: String, default: '' },
      httpStatus: { type: String, default: '' },
      databaseChanges: { type: String, default: '' },
      migrationNotes: { type: String, default: '' },
      notes: { type: String, default: '' },
    },

    attachmentIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }], default: [] },
    beforeAfter: {
      type: [
        {
          beforeAttachmentId: { type: Schema.Types.ObjectId, ref: 'Attachment', required: true },
          afterAttachmentId: { type: Schema.Types.ObjectId, ref: 'Attachment', required: true },
          caption: { type: String, default: '' },
        },
      ],
      default: [],
    },

    status: { type: String, enum: WORK_UPDATE_STATUSES, default: 'draft', index: true },
    submittedAt: { type: Date, default: null },
    review: {
      reviewerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      comment: { type: String, default: '' },
      reviewedAt: { type: Date, default: null },
      approvedAt: { type: Date, default: null },
    },
    reviewHistory: { type: [reviewEventSchema], default: [] },
    watcherIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    editCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

workUpdateSchema.index({ organizationId: 1, number: 1 }, { unique: true });
workUpdateSchema.index({ organizationId: 1, userId: 1, workDate: -1 });
workUpdateSchema.index({ organizationId: 1, projectId: 1, status: 1, workDate: -1 });
workUpdateSchema.index({ title: 'text', description: 'text', implemented: 'text', blockers: 'text' });

export type WorkUpdateDoc = InferSchemaType<typeof workUpdateSchema>;
export const WorkUpdate = model('WorkUpdate', workUpdateSchema);
