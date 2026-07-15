import { Schema, model, Types, InferSchemaType } from 'mongoose';
import { PERMISSIONS } from '../constants/permissions';

const roleSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    permissions: { type: [String], enum: PERMISSIONS, default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

roleSchema.index({ organizationId: 1, key: 1 }, { unique: true });

export type RoleDoc = InferSchemaType<typeof roleSchema>;
export const Role = model('Role', roleSchema);
