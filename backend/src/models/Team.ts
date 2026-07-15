import { Schema, model, Types, InferSchemaType } from 'mongoose';

const teamSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    leadId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    memberIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

teamSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export type TeamDoc = InferSchemaType<typeof teamSchema>;
export const Team = model('Team', teamSchema);
