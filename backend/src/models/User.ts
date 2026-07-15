import { Schema, model, Types, InferSchemaType } from 'mongoose';
import { USER_STATUSES } from '../constants/enums';

const userSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true, default: null },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    employeeCode: { type: String, default: '' },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, default: '', trim: true },
    displayName: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: '' },
    phone: { type: String, default: '' },
    jobTitle: { type: String, default: '' },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', default: null },
    isSuperAdmin: { type: Boolean, default: false },
    status: { type: String, enum: USER_STATUSES, default: 'active', index: true },
    joiningDate: { type: Date, default: null },
    workLocation: { type: String, default: '' },
    timezone: { type: String, default: '' },
    skills: { type: [String], default: [] },
    emailVerifiedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    // Single-use, hashed recovery/verification tokens
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
    emailVerifyTokenHash: { type: String, default: null, select: false },
    emailVerifyExpiresAt: { type: Date, default: null, select: false },
    notificationPreferences: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ organizationId: 1, email: 1 }, { unique: true });
userSchema.index({ organizationId: 1, employeeCode: 1 });
userSchema.index({ organizationId: 1, status: 1 });

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);
