import { Schema, model, Types, InferSchemaType } from 'mongoose';
import { ATTACHMENT_TYPES } from '../constants/enums';

/** Cloudinary metadata only — binaries are never stored in MongoDB. */
const attachmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', default: null },
    entityType: {
      type: String,
      enum: ['work_update', 'task', 'issue', 'comment', 'project', 'release', 'organization', 'none'],
      default: 'none',
    },
    entityId: { type: Schema.Types.ObjectId, default: null, index: true },
    secureUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'video', 'raw'], default: 'image' },
    format: { type: String, default: '' },
    originalFilename: { type: String, default: '' },
    bytes: { type: Number, default: 0 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    duration: { type: Number, default: null },
    caption: { type: String, default: '' },
    altText: { type: String, default: '' },
    attachmentType: { type: String, enum: ATTACHMENT_TYPES, default: 'screenshot' },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

attachmentSchema.index({ organizationId: 1, entityType: 1, entityId: 1 });

export type AttachmentDoc = InferSchemaType<typeof attachmentSchema>;
export const Attachment = model('Attachment', attachmentSchema);
