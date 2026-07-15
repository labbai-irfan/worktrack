import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pin, SmilePlus, Trash2, CornerDownRight } from 'lucide-react';
import { get, post, del, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Avatar, Button, EmptyState, Skeleton, Textarea } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { fmtRelative } from '@/lib/utils';
import type { Comment } from '@/types';

const QUICK_EMOJI = ['👍', '🎉', '❤️', '👀'];

export default function CommentsSection({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const { user, can } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: () => get<Comment[]>('/comments', { entityType, entityId }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });

  const addComment = useMutation({
    mutationFn: () => post('/comments', { entityType, entityId, body: body.trim(), parentId: replyTo?._id ?? null }),
    onSuccess: () => {
      setBody('');
      setReplyTo(null);
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const react = useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) => post(`/comments/${id}/react`, { emoji }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/comments/${id}`),
    onSuccess: invalidate,
  });
  const pin = useMutation({
    mutationFn: (id: string) => post(`/comments/${id}/pin`),
    onSuccess: invalidate,
  });

  const comments = data?.data ?? [];
  const roots = comments.filter((c) => !c.parentId);
  const repliesFor = (id: string) => comments.filter((c) => c.parentId === id);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  const CommentRow = ({ c, isReply }: { c: Comment; isReply?: boolean }) => (
    <div className={isReply ? 'ml-8 mt-2' : ''}>
      <div className="flex gap-2.5">
        <Avatar name={c.authorId?.displayName} src={c.authorId?.avatarUrl} size="sm" />
        <div className="grow min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold">{c.authorId?.displayName}</span>
            <span className="text-2xs text-ink-faint">{fmtRelative(c.createdAt)}</span>
            {c.pinned && <Pin className="h-3 w-3 text-warning-main" aria-label="Pinned" />}
            {c.editedAt && <span className="text-2xs text-ink-faint">(edited)</span>}
          </div>
          <p className="text-xs mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {c.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => react.mutate({ id: c._id, emoji: r.emoji })}
                className="text-2xs rounded-full border border-line px-1.5 py-0.5 hover:bg-surface-sunken"
                aria-label={`React ${r.emoji}`}
              >
                {r.emoji} {r.userIds.length}
              </button>
            ))}
            <div className="relative group">
              <button className="p-1 text-ink-faint hover:text-ink" aria-label="Add reaction">
                <SmilePlus className="h-3.5 w-3.5" />
              </button>
              <div className="absolute bottom-full left-0 hidden group-hover:flex card px-1.5 py-1 gap-1 z-10">
                {QUICK_EMOJI.map((e) => (
                  <button key={e} onClick={() => react.mutate({ id: c._id, emoji: e })} className="hover:scale-110 text-sm" aria-label={`React ${e}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            {!isReply && (
              <button onClick={() => setReplyTo(c)} className="text-2xs text-ink-faint hover:text-ink flex items-center gap-0.5">
                <CornerDownRight className="h-3 w-3" /> Reply
              </button>
            )}
            {can('work_update.review', 'work_update.approve') && (
              <button onClick={() => pin.mutate(c._id)} className="text-2xs text-ink-faint hover:text-ink">
                {c.pinned ? 'Unpin' : 'Pin'}
              </button>
            )}
            {c.authorId?._id === user?._id && (
              <button onClick={() => remove.mutate(c._id)} className="text-2xs text-ink-faint hover:text-error-main" aria-label="Delete comment">
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
      {repliesFor(c._id).map((r) => (
        <CommentRow key={r._id} c={r} isReply />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {roots.length === 0 ? (
        <EmptyState title="No comments yet" description="Start the discussion — mention teammates with their name." />
      ) : (
        <div className="space-y-4">{roots.map((c) => <CommentRow key={c._id} c={c} />)}</div>
      )}
      <div className="border-t border-line pt-3">
        {replyTo && (
          <div className="flex items-center justify-between text-2xs text-ink-muted mb-1.5 bg-surface-sunken rounded px-2 py-1">
            <span>Replying to {replyTo.authorId?.displayName}</span>
            <button onClick={() => setReplyTo(null)} className="hover:text-ink">Cancel</button>
          </div>
        )}
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment…"
          rows={2}
          aria-label="Comment"
        />
        <div className="flex justify-end mt-2">
          <Button size="sm" disabled={!body.trim()} loading={addComment.isPending} onClick={() => addComment.mutate()}>
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
