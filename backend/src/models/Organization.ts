import { Schema, model, Types, InferSchemaType } from 'mongoose';

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logoUrl: { type: String, default: '' },
    industry: { type: String, default: '' },
    companySize: { type: String, default: '' },
    country: { type: String, default: '' },
    timezone: { type: String, default: 'UTC' },
    workingDays: { type: [String], default: ['mon', 'tue', 'wed', 'thu', 'fri'] },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '18:00' },
    },
    settings: {
      dateFormat: { type: String, default: 'dd MMM yyyy' },
      timeFormat: { type: String, default: 'hh:mm a' },
      weekStart: { type: String, default: 'mon' },
      dailyReportCutoff: { type: String, default: '20:00' },
      allowSelfApproval: { type: Boolean, default: false },
      allowMultipleTimers: { type: Boolean, default: false },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type OrganizationDoc = InferSchemaType<typeof organizationSchema>;
export const Organization = model('Organization', organizationSchema);
