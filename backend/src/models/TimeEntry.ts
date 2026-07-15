import { Schema, model, Types, InferSchemaType } from 'mongoose';

const timeEntrySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', default: null },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', default: null },
    workUpdateId: { type: Schema.Types.ObjectId, ref: 'WorkUpdate', default: null },
    startedAt: { type: Date, required: true }, // UTC timestamps set on the server
    endedAt: { type: Date, default: null },
    minutes: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    billable: { type: Boolean, default: false },
    source: { type: String, enum: ['manual', 'timer'], default: 'manual' },
    running: { type: Boolean, default: false, index: true },
    corrections: {
      type: [
        {
          byId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          reason: { type: String, required: true },
          previousMinutes: { type: Number, required: true },
          newMinutes: { type: Number, required: true },
          at: { type: Date, default: () => new Date() },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

timeEntrySchema.index({ organizationId: 1, userId: 1, startedAt: -1 });

export type TimeEntryDoc = InferSchemaType<typeof timeEntrySchema>;
export const TimeEntry = model('TimeEntry', timeEntrySchema);
