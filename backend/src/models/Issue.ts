import { Schema, model, Types, InferSchemaType } from 'mongoose';
import { ISSUE_TYPES, ISSUE_STATUSES, SEVERITIES, PRIORITIES, RESOLUTION_CODES, ENVIRONMENTS } from '../constants/enums';

const issueEventSchema = new Schema(
  {
    action: { type: String, required: true },
    byId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    from: { type: String, default: '' },
    to: { type: String, default: '' },
    note: { type: String, default: '' },
    at: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const issueSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', default: null, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    workUpdateId: { type: Schema.Types.ObjectId, ref: 'WorkUpdate', default: null },
    number: { type: String, required: true }, // e.g. "BUG-482"
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: '' },
    type: { type: String, enum: ISSUE_TYPES, default: 'bug' },
    severity: { type: String, enum: SEVERITIES, default: 'medium', index: true },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    status: { type: String, enum: ISSUE_STATUSES, default: 'open', index: true },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    collaboratorIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    environment: { type: String, enum: ENVIRONMENTS, default: 'production' },
    affectedVersion: { type: String, default: '' },
    fixedVersion: { type: String, default: '' },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    labels: { type: [String], default: [] },
    watcherIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },

    error: {
      message: { type: String, default: '' },
      stackTrace: { type: String, default: '' },
      consoleLog: { type: String, default: '' },
      apiEndpoint: { type: String, default: '' },
      httpMethod: { type: String, default: '' },
      requestPayload: { type: String, default: '' }, // redacted before persistence
      responseStatus: { type: String, default: '' },
      responseBody: { type: String, default: '' }, // redacted before persistence
      browser: { type: String, default: '' },
      browserVersion: { type: String, default: '' },
      os: { type: String, default: '' },
      device: { type: String, default: '' },
      appVersion: { type: String, default: '' },
      buildVersion: { type: String, default: '' },
      commitHash: { type: String, default: '' },
      firstSeenAt: { type: Date, default: null },
      lastSeenAt: { type: Date, default: null },
      occurrenceCount: { type: Number, default: 1 },
    },

    reproduction: {
      steps: { type: String, default: '' },
      expected: { type: String, default: '' },
      actual: { type: String, default: '' },
      frequency: { type: String, enum: ['always', 'often', 'sometimes', 'rare', 'once', ''], default: '' },
      reproducible: { type: String, enum: ['yes', 'no', 'intermittent', 'unknown', ''], default: '' },
    },

    resolution: {
      rootCause: { type: String, default: '' },
      fixSummary: { type: String, default: '' },
      solution: { type: String, default: '' },
      testingPerformed: { type: String, default: '' },
      regressionRisk: { type: String, default: '' },
      code: { type: String, enum: [...RESOLUTION_CODES, ''], default: '' },
    },

    attachmentIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }], default: [] },
    history: { type: [issueEventSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

issueSchema.index({ organizationId: 1, number: 1 }, { unique: true });
issueSchema.index({ organizationId: 1, projectId: 1, status: 1 });
issueSchema.index({ organizationId: 1, assigneeId: 1, status: 1 });
issueSchema.index({ title: 'text', description: 'text', 'error.message': 'text' });

export type IssueDoc = InferSchemaType<typeof issueSchema>;
export const Issue = model('Issue', issueSchema);
