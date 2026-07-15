import { Schema, model, Types, InferSchemaType } from 'mongoose';

const counterSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  key: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

counterSchema.index({ organizationId: 1, key: 1 }, { unique: true });

export type CounterDoc = InferSchemaType<typeof counterSchema>;
export const Counter = model('Counter', counterSchema);
