import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, XCircle, MessageSquareWarning, Pencil, GitBranch, Link2, Send } from 'lucide-react';
import { get, post, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Avatar, Badge, Button, ErrorState, Modal, PageLoader, Progress, StatusBadge, Textarea } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { fmtDate, fmtDateTime, fmtMinutes, refId, titleCase } from '@/lib/utils';
import CommentsSection from '@/components/CommentsSection';
import { AttachmentGallery, BeforeAfterSlider } from '@/components/attachments';
import type { WorkUpdate, Attachment, UserRef } from '@/types';

const DETAIL_FIELDS: { key: keyof WorkUpdate; label: string }[] = [
  { key: 'planned', label: 'What was planned' },
  { key: 'implemented', label: 'What was implemented' },
  { key: 'changed', label: 'What changed' },
  { key: 'remaining', label: 'What remains' },
  { key: 'outcome', label: 'Result / outcome' },
  { key: 'nextAction', label: 'Next action' },
];

export default function WorkUpdateDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, can } = useAuthStore();
  const [reviewModal, setReviewModal] = useState<'request_changes' | 'reject' | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['work-updates', id],
    queryFn: () => get<WorkUpdate>(`/work-updates/${id}`),
  });

  const review = useMutation({
    mutationFn: ({ action, comment }: { action: string; comment?: string }) => post<WorkUpdate>(`/work-updates/${id}/review`, { action, comment }),
    onSuccess: (res) => {
      toast.success(res.message);
      setReviewModal(null);
      setReviewComment('');
      queryClient.invalidateQueries({ queryKey: ['work-updates'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const submit = useMutation({
    mutationFn: () => post(`/work-updates/${id}/submit`),
    onSuccess: () => {
      toast.success('Submitted for review.');
      queryClient.invalidateQueries({ queryKey: ['work-updates'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <PageLoader />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const u = data.data;
  const author = u.userId as UserRef;
  const isAuthor = author?._id === user?._id;
  const canReview = can('work_update.review', 'work_update.approve') && !isAuthor;
  const reviewable = ['submitted', 'under_review'].includes(u.status);
  const editable = isAuthor && ['draft', 'changes_requested'].includes(u.status);
  const attachmentById = new Map((u.attachmentIds ?? []).map((a) => [a._id, a]));
  const technical = u.technical ?? {};
  const hasTechnical = Object.values(technical).some((v) => v && v !== 'development');

  return (
    <div className="space-y-4 max-w-5xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xs font-mono text-ink-faint">
            {u.number} · {(u.projectId as { name?: string })?.name}
            {refId(u.moduleId) && ` / ${(u.moduleId as { name?: string })?.name}`}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <h1 className="text-lg font-bold leading-snug">{u.title}</h1>
            <StatusBadge status={u.status} />
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-ink-muted">
            <Avatar name={author?.displayName} src={author?.avatarUrl} size="xs" />
            {author?.displayName} · worked on {fmtDate(u.workDate)} · {titleCase(u.workType)}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {editable && (
            <>
              <Button size="sm" variant="outline" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => navigate(`/work-updates/${id}/edit`)}>
                Edit
              </Button>
              <Button size="sm" icon={<Send className="h-3.5 w-3.5" />} loading={submit.isPending} onClick={() => submit.mutate()}>
                {u.status === 'changes_requested' ? 'Resubmit' : 'Submit'}
              </Button>
            </>
          )}
          {canReview && reviewable && (
            <>
              {can('work_update.approve') && (
                <Button size="sm" icon={<CheckCircle2 className="h-3.5 w-3.5" />} loading={review.isPending} onClick={() => review.mutate({ action: 'approve' })}>
                  Approve
                </Button>
              )}
              <Button size="sm" variant="outline" icon={<MessageSquareWarning className="h-3.5 w-3.5" />} onClick={() => setReviewModal('request_changes')}>
                Request changes
              </Button>
              <Button size="sm" variant="danger" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => setReviewModal('reject')}>
                Reject
              </Button>
            </>
          )}
        </div>
      </div>

      {u.status === 'changes_requested' && u.review?.comment && (
        <div className="card border-warning-main/50 p-4">
          <div className="text-xs font-semibold text-warning-main">Changes requested by {u.review.reviewerId?.displayName}</div>
          <p className="text-xs text-ink-muted mt-1 whitespace-pre-wrap">{u.review.comment}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {u.description && (
            <section className="card p-4">
              <h2 className="text-xs font-semibold mb-1.5">Summary</h2>
              <p className="text-xs text-ink-muted whitespace-pre-wrap">{u.description}</p>
            </section>
          )}

          {DETAIL_FIELDS.some((f) => u[f.key]) && (
            <section className="card p-4 grid sm:grid-cols-2 gap-4">
              {DETAIL_FIELDS.filter((f) => u[f.key]).map((f) => (
                <div key={f.key}>
                  <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-faint mb-1">{f.label}</h3>
                  <p className="text-xs text-ink-muted whitespace-pre-wrap">{String(u[f.key])}</p>
                </div>
              ))}
            </section>
          )}

          {(u.blockers || u.assistanceRequired || u.dependencies) && (
            <section className="card p-4 border-error-main/30 space-y-3">
              {u.blockers && (
                <div>
                  <h3 className="text-2xs font-semibold uppercase tracking-wide text-error-main mb-1">Blockers</h3>
                  <p className="text-xs text-ink-muted whitespace-pre-wrap">{u.blockers}</p>
                </div>
              )}
              {u.dependencies && (
                <div>
                  <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-faint mb-1">Dependencies</h3>
                  <p className="text-xs text-ink-muted whitespace-pre-wrap">{u.dependencies}</p>
                </div>
              )}
              {u.assistanceRequired && (
                <div>
                  <h3 className="text-2xs font-semibold uppercase tracking-wide text-warning-main mb-1">Assistance required</h3>
                  <p className="text-xs text-ink-muted whitespace-pre-wrap">{u.assistanceRequired}</p>
                </div>
              )}
            </section>
          )}

          {(u.beforeAfter ?? []).length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold">Before & after</h2>
              {(u.beforeAfter ?? []).map((pair, i) => {
                const before = attachmentById.get(pair.beforeAttachmentId) as Attachment | undefined;
                const after = attachmentById.get(pair.afterAttachmentId) as Attachment | undefined;
                if (!before || !after) return null;
                return <BeforeAfterSlider key={i} before={before} after={after} caption={pair.caption} />;
              })}
            </section>
          )}

          {(u.attachmentIds ?? []).length > 0 && (
            <section>
              <h2 className="text-xs font-semibold mb-2">Attachments ({u.attachmentIds.length})</h2>
              <AttachmentGallery attachments={u.attachmentIds} />
            </section>
          )}

          {hasTechnical && (
            <section className="card p-4">
              <h2 className="text-xs font-semibold flex items-center gap-1.5 mb-3"><GitBranch className="h-3.5 w-3.5" /> Technical details</h2>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                {technical.environment && <div><dt className="text-ink-faint">Environment</dt><dd>{titleCase(technical.environment)}</dd></div>}
                {technical.repository && <div><dt className="text-ink-faint">Repository</dt><dd className="font-mono break-all">{technical.repository}</dd></div>}
                {technical.branch && <div><dt className="text-ink-faint">Branch</dt><dd className="font-mono break-all">{technical.branch}</dd></div>}
                {technical.commitHash && <div><dt className="text-ink-faint">Commit</dt><dd className="font-mono">{technical.commitHash}</dd></div>}
                {technical.apiEndpoint && <div><dt className="text-ink-faint">API</dt><dd className="font-mono break-all">{technical.httpMethod} {technical.apiEndpoint}</dd></div>}
                {technical.httpStatus && <div><dt className="text-ink-faint">HTTP status</dt><dd>{technical.httpStatus}</dd></div>}
                {technical.pullRequestUrl && (
                  <div className="col-span-2">
                    <dt className="text-ink-faint">Pull request</dt>
                    <dd><a href={technical.pullRequestUrl} className="text-primary-600 hover:underline flex items-center gap-1" target="_blank" rel="noreferrer"><Link2 className="h-3 w-3" />{technical.pullRequestUrl}</a></dd>
                  </div>
                )}
                {technical.deploymentUrl && (
                  <div className="col-span-2">
                    <dt className="text-ink-faint">Deployment</dt>
                    <dd><a href={technical.deploymentUrl} className="text-primary-600 hover:underline flex items-center gap-1" target="_blank" rel="noreferrer"><Link2 className="h-3 w-3" />{technical.deploymentUrl}</a></dd>
                  </div>
                )}
              </dl>
              {technical.databaseChanges && (
                <div className="mt-3">
                  <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-faint mb-1">Database changes</h3>
                  <p className="text-xs text-ink-muted whitespace-pre-wrap">{technical.databaseChanges}</p>
                </div>
              )}
              {technical.notes && (
                <div className="mt-3">
                  <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-faint mb-1">Notes</h3>
                  <p className="text-xs text-ink-muted whitespace-pre-wrap">{technical.notes}</p>
                </div>
              )}
            </section>
          )}

          <section className="card p-4">
            <h2 className="text-xs font-semibold mb-3">Discussion</h2>
            <CommentsSection entityType="work_update" entityId={u._id} />
          </section>
        </div>

        <aside className="space-y-3">
          <div className="card p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-ink-faint">Progress</span>
              <span className="tabular-nums font-medium">{u.progress}%</span>
            </div>
            <Progress value={u.progress} />
            <div className="flex justify-between pt-1"><span className="text-ink-faint">Progress status</span><StatusBadge status={u.progressStatus} /></div>
            <div className="flex justify-between"><span className="text-ink-faint">Work type</span><Badge>{titleCase(u.workType)}</Badge></div>
            {u.taskId && (
              <div className="flex justify-between gap-2">
                <span className="text-ink-faint">Task</span>
                <button onClick={() => navigate(`/tasks/${refId(u.taskId)}`)} className="text-primary-600 hover:underline truncate">
                  {(u.taskId as { number?: string })?.number}
                </button>
              </div>
            )}
            {u.time?.minutesSpent ? (
              <>
                <div className="flex justify-between"><span className="text-ink-faint">Time spent</span><span>{fmtMinutes(u.time.minutesSpent)}</span></div>
                {u.time.startTime && <div className="flex justify-between"><span className="text-ink-faint">Window</span><span>{u.time.startTime}–{u.time.endTime || '?'}</span></div>}
                <div className="flex justify-between"><span className="text-ink-faint">Billable</span><span>{u.time.billable ? 'Yes' : 'No'}</span></div>
              </>
            ) : null}
            <div className="flex justify-between"><span className="text-ink-faint">Submitted</span><span>{u.submittedAt ? fmtDateTime(u.submittedAt) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Edits</span><span>{(u as WorkUpdate & { editCount?: number }).editCount ?? 0}</span></div>
          </div>

          {/* Review timeline */}
          <div className="card p-4">
            <h2 className="text-xs font-semibold mb-2.5">Review history</h2>
            {u.reviewHistory.length === 0 ? (
              <p className="text-2xs text-ink-faint">Not submitted yet.</p>
            ) : (
              <ol className="space-y-2.5">
                {[...u.reviewHistory].reverse().map((e, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span
                      className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                        e.action === 'approved' ? 'bg-success-main' : e.action === 'rejected' ? 'bg-error-main' : e.action === 'changes_requested' ? 'bg-warning-main' : 'bg-info-main'
                      }`}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div>
                        <span className="font-medium">{(e.byId as UserRef)?.displayName ?? 'Someone'}</span>{' '}
                        <span className="text-ink-muted">{titleCase(e.action)}</span>
                      </div>
                      {e.comment && <p className="text-2xs text-ink-muted mt-0.5 whitespace-pre-wrap">{e.comment}</p>}
                      <div className="text-2xs text-ink-faint mt-0.5">{fmtDateTime(e.at)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>

      <Modal
        open={reviewModal !== null}
        onClose={() => setReviewModal(null)}
        title={reviewModal === 'reject' ? 'Reject update' : 'Request changes'}
        footer={
          <>
            <Button variant="outline" onClick={() => setReviewModal(null)}>Cancel</Button>
            <Button
              variant={reviewModal === 'reject' ? 'danger' : 'primary'}
              disabled={!reviewComment.trim()}
              loading={review.isPending}
              onClick={() => review.mutate({ action: reviewModal!, comment: reviewComment })}
            >
              {reviewModal === 'reject' ? 'Reject' : 'Request changes'}
            </Button>
          </>
        }
      >
        <p className="text-xs text-ink-muted mb-3">Explain what needs to change — the author will be notified.</p>
        <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={4} placeholder="Reason…" aria-label="Review comment" />
      </Modal>
    </div>
  );
}
