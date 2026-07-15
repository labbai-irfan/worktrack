import { Schema, model, Types, InferSchemaType } from 'mongoose';
import { TASK_TYPES, TASK_STATUSES, PRIORITIES, ENVIRONMENTS } from '../constants/enums';

const taskSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', default: null, index: true },
    milestoneId: { type: Schema.Types.ObjectId, ref: 'Milestone', default: null },
    parentTaskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null, index: true },
    number: { type: String, required: true }, // e.g. "WTH-1024"
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: '' },
    type: { type: String, enum: TASK_TYPES, default: 'feature' },
    status: { type: String, enum: TASK_STATUSES, default: 'todo', index: true },
    priority: { type: String, enum: PRIORITIES, default: 'medium', index: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    collaboratorIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null, index: true },
    estimatedHours: { type: Number, default: null },
    loggedMinutes: { type: Number, default: 0 },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    labels: { type: [String], default: [] },
    checklist: {
      type: [{ text: { type: String, required: true }, done: { type: Boolean, default: false } }],
      default: [],
    },
    dependencyIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Task' }], default: [] },
    acceptanceCriteria: { type: String, default: '' },
    environment: { type: String, enum: ENVIRONMENTS, default: 'development' },
    git: {
      repository: { type: String, default: '' },
      branch: { type: String, default: '' },
      commitHash: { type: String, default: '' },
      pullRequestUrl: { type: String, default: '' },
    },
    watcherIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    order: { type: Number, default: 0 }, // kanban ordering within a status column
    blockedReason: { type: String, default: '' },
    completedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

taskSchema.index({ organizationId: 1, number: 1 }, { unique: true });
taskSchema.index({ organizationId: 1, projectId: 1, status: 1, order: 1 });
taskSchema.index({ organizationId: 1, assigneeId: 1, status: 1 });
taskSchema.index({ title: 'text', description: 'text' });

export type TaskDoc = InferSchemaType<typeof taskSchema>;
export const Task = model('Task', taskSchema);
