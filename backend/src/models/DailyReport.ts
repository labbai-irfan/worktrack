import { Schema, model, Types, InferSchemaType } from 'mongoose';
import { DAILY_REPORT_STATUSES } from '../constants/enums';

const dailyReportSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true }, // "YYYY-MM-DD" in org timezone
    projectIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Project' }], default: [] },
    moduleIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Module' }], default: [] },
    workUpdateIds: { type: [{ type: Schema.Types.ObjectId, ref: 'WorkUpdate' }], default: [] },
    taskIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Task' }], default: [] },
    issuesCreated: { type: Number, default: 0 },
    issuesResolved: { type: Number, default: 0 },
    completedSummary: { type: String, default: '' },
    inProgressSummary: { type: String, default: '' },
    blockers: { type: String, default: '' },
    assistanceRequired: { type: String, default: '' },
    nextDayPlan: { type: String, default: '' },
    totalMinutes: { type: Number, default: 0 },
    employeeNotes: { type: String, default: '' },
    managerNotes: { type: String, default: '' },
    status: { type: String, enum: DAILY_REPORT_STATUSES, default: 'draft', index: true },
    submittedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One report per employee per day — prevents duplicates at the database level.
dailyReportSchema.index({ organizationId: 1, userId: 1, date: 1 }, { unique: true });
dailyReportSchema.index({ organizationId: 1, date: 1, status: 1 });

export type DailyReportDoc = InferSchemaType<typeof dailyReportSchema>;
export const DailyReport = model('DailyReport', dailyReportSchema);
