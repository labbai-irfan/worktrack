import { Schema, model, Types, InferSchemaType } from 'mongoose';

/**
 * Immutable audit trail. No update/delete API exists for this collection,
 * and the schema forbids modification at the application layer.
 */
const auditLogSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true, index: true },
    entityType: { type: String, default: '' },
    entityId: { type: Schema.Types.ObjectId, default: null },
    previousData: { type: Schema.Types.Mixed, default: null },
    newData: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ organizationId: 1, createdAt: -1 });

auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany', 'deleteOne', 'deleteMany', 'findOneAndDelete'], function () {
  throw new Error('Audit logs are immutable.');
});

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;
export const AuditLog = model('AuditLog', auditLogSchema);
