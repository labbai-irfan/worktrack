import { Schema, model, Types, InferSchemaType } from 'mongoose';

const invitationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, default: '' },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    jobTitle: { type: String, default: '' },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'expired', 'revoked'], default: 'pending' },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

invitationSchema.index({ organizationId: 1, email: 1, status: 1 });

export type InvitationDoc = InferSchemaType<typeof invitationSchema>;
export const Invitation = model('Invitation', invitationSchema);
