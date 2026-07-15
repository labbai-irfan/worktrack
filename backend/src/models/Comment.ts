import { Schema, model, Types, InferSchemaType } from 'mongoose';

const commentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    entityType: {
      type: String,
      enum: ['project', 'module', 'task', 'work_update', 'issue', 'release', 'daily_report'],
      required: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 10_000 },
    mentionIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    parentId: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
    reactions: {
      type: [
        {
          emoji: { type: String, required: true },
          userIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
        },
      ],
      default: [],
    },
    pinned: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

commentSchema.index({ organizationId: 1, entityType: 1, entityId: 1, createdAt: 1 });

export type CommentDoc = InferSchemaType<typeof commentSchema>;
export const Comment = model('Comment', commentSchema);
