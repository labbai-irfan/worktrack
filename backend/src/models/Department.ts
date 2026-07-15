import { Schema, model, Types, InferSchemaType } from 'mongoose';

const departmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    headId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

departmentSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export type DepartmentDoc = InferSchemaType<typeof departmentSchema>;
export const Department = model('Department', departmentSchema);
