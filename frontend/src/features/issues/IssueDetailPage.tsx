import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { get, post, patch, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Avatar, Badge, Button, ErrorState, Field, Modal, PageLoader, Select, StatusBadge, Textarea } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { fmtDate, fmtDateTime, titleCase, refId } from '@/lib/utils';
import { RESOLUTION_CODES } from '@/constants';
import CommentsSection from '@/components/CommentsSection';
import { AttachmentGallery } from '@/components/attachments';
import type { Issue, User, UserRef } from '@/types';

/** Mirrors the backend lifecycle so the UI only offers valid transitions. */
const TRANSITIONS: Record<string, string[]> = {
  open: ['triaged', 'assigned', 'in_progress', 'duplicate', 'wont_fix', 'closed'],
  triaged: ['assigned', 'in_progress', 'duplicate', 'wont_fix', 'closed'],
  assigned: ['in_progress', 'blocked', 'triaged', 'duplicate', 'wont_fix'],
  in_progress: ['blocked', 'fix_implemented', 'assigned', 'wont_fix'],
  blocked: ['in_progress', 'assigned'],
  fix_implemented: ['under_review', 'testing', 'in_progress'],
  under_review: ['testing', 'in_progress', 'resolved'],
  testing: ['resolved', 'in_progress', 'reopened'],
  resolved: ['closed', 'reopened'],
  closed: ['reopened'],
  reopened: ['assigned', 'in_progress', 'triaged'],
  duplicate: ['reopened'],
  wont_fix: ['reopened'],
};

export default function IssueDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuthStore();
  const [resolveModal, setResolveModal] = useState<string | null>(null);
  const [resolution, setResolution] = useState({ code: 'fixed', fixSummary: '', rootCause: '', testingPerformed: '' });
  const [note, setNote] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['issues', id],
    queryFn: () => get<Issue>(`/issues/${id}`),
  });
  const { data: employees } = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => get<User[]>('/employees', { limit: 100 }),
    enabled: can('issue.assign'),
  });

  const transition = useMutation({
    mutationFn: (body: { status: string; note?: string; resolution?: typeof resolution }) => post<Issue>(`/issues/${id}/transition`, body),
    onSuccess: (res) => {
      toast.success(res.message);
      setResolveModal(null);
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => patch<Issue>(`/issues/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['issues'] }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <PageLoader />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;
  const issue = data.data;
  const nextStatuses = TRANSITIONS[issue.status] ?? [];
  const canManage = can('issue.manage', 'issue.create');

  function doTransition(status: string) {
    if (status === 'resolved' && !issue.resolution?.code) {
      setResolveModal(status);
    } else {
      transition.mutate({ status, note: note || undefined });
    }
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xs font-mono text-ink-faint">
            {issue.number} · {(issue.projectId as { name?: string })?.name}
            {refId(issue.moduleId) && ` / ${(issue.moduleId as { name?: string })?.name}`}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <h1 className="text-lg font-bold leading-snug">{issue.title}</h1>
            <StatusBadge status={issue.status} />
            <StatusBadge status={issue.severity} />
          </div>
          <div className="text-xs text-ink-muted mt-1">
            {titleCase(issue.type)} · {titleCase(issue.environment)} · reported by {issue.reporterId?.displayName} {fmtDate(issue.createdAt)}
          </div>
        </div>
        {canManage && nextStatuses.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {nextStatuses.slice(0, 4).map((s) => (
              <Button key={s} size="sm" variant={s === 'resolved' ? 'primary' : 'outline'} loading={transition.isPending} onClick={() => doTransition(s)}>
                {titleCase(s)} <ChevronRight className="h-3 w-3" />
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {issue.description && (
            <section className="card p-4">
              <h2 className="text-xs font-semibold mb-1.5">Description</h2>
              <p className="text-xs text-ink-muted whitespace-pre-wrap">{issue.description}</p>
            </section>
          )}

          {(issue.error?.message || issue.error?.stackTrace) && (
            <section className="card p-4 space-y-3">
              <h2 className="text-xs font-semibold text-error-main">Error details</h2>
              {issue.error.message && <p className="text-xs font-mono bg-surface-sunken rounded p-2 break-all">{issue.error.message}</p>}
              {issue.error.stackTrace && (
                <details>
                  <summary className="text-2xs text-ink-muted cursor-pointer">Stack trace</summary>
                  <pre className="text-2xs font-mono bg-surface-sunken rounded p-2 mt-1.5 overflow-x-auto scrollbar-thin max-h-64">{issue.error.stackTrace}</pre>
                </details>
              )}
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                {issue.error.apiEndpoint && <div><dt className="text-ink-faint">Endpoint</dt><dd className="font-mono break-all">{issue.error.httpMethod} {issue.error.apiEndpoint}</dd></div>}
                {issue.error.responseStatus && <div><dt className="text-ink-faint">Response</dt><dd>{issue.error.responseStatus}</dd></div>}
                {issue.error.browser && <div><dt className="text-ink-faint">Browser</dt><dd>{issue.error.browser} {issue.error.browserVersion}</dd></div>}
                {issue.error.os && <div><dt className="text-ink-faint">OS</dt><dd>{issue.error.os}</dd></div>}
                {issue.error.commitHash && <div><dt className="text-ink-faint">Commit</dt><dd className="font-mono">{issue.error.commitHash}</dd></div>}
                {issue.error.occurrenceCount != null && issue.error.occurrenceCount > 0 && (
                  <div><dt className="text-ink-faint">Occurrences</dt><dd>{issue.error.occurrenceCount}× {issue.error.lastSeenAt && `(last ${fmtDate(issue.error.lastSeenAt)})`}</dd></div>
                )}
              </dl>
            </section>
          )}

          {(issue.reproduction?.steps || issue.reproduction?.expected) && (
            <section className="card p-4 space-y-3">
              <h2 className="text-xs font-semibold">Reproduction</h2>
              {issue.reproduction.steps && (
                <div>
                  <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-faint mb-1">Steps</h3>
                  <p className="text-xs text-ink-muted whitespace-pre-wrap">{issue.reproduction.steps}</p>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                {issue.reproduction.expected && (
                  <div>
                    <h3 className="text-2xs font-semibold uppercase tracking-wide text-success-main mb-1">Expected</h3>
                    <p className="text-xs text-ink-muted whitespace-pre-wrap">{issue.reproduction.expected}</p>
                  </div>
                )}
                {issue.reproduction.actual && (
                  <div>
                    <h3 className="text-2xs font-semibold uppercase tracking-wide text-error-main mb-1">Actual</h3>
                    <p className="text-xs text-ink-muted whitespace-pre-wrap">{issue.reproduction.actual}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 text-2xs text-ink-faint">
                {issue.reproduction.frequency && <span>Frequency: {issue.reproduction.frequency}</span>}
                {issue.reproduction.reproducible && <span>Reproducible: {issue.reproduction.reproducible}</span>}
              </div>
            </section>
          )}

          {issue.resolution?.code && (
            <section className="card p-4 border-success-main/40 space-y-2">
              <h2 className="text-xs font-semibold text-success-main">Resolution — {titleCase(issue.resolution.code)}</h2>
              {issue.resolution.rootCause && <p className="text-xs"><span className="text-ink-faint">Root cause:</span> {issue.resolution.rootCause}</p>}
              {issue.resolution.fixSummary && <p className="text-xs"><span className="text-ink-faint">Fix:</span> {issue.resolution.fixSummary}</p>}
              {issue.resolution.testingPerformed && <p className="text-xs"><span className="text-ink-faint">Testing:</span> {issue.resolution.testingPerformed}</p>}
              {issue.resolution.regressionRisk && <p className="text-xs"><span className="text-ink-faint">Regression risk:</span> {issue.resolution.regressionRisk}</p>}
            </section>
          )}

          {(issue.attachmentIds ?? []).length > 0 && (
            <section>
              <h2 className="text-xs font-semibold mb-2">Attachments</h2>
              <AttachmentGallery attachments={issue.attachmentIds} />
            </section>
          )}

          <section className="card p-4">
            <h2 className="text-xs font-semibold mb-3">Discussion</h2>
            <CommentsSection entityType="issue" entityId={issue._id} />
          </section>
        </div>

        <aside className="space-y-3">
          <div className="card p-4 space-y-3">
            <div>
              <span className="label">Assignee</span>
              {can('issue.assign') ? (
                <Select value={issue.assigneeId?._id ?? ''} onChange={(e) => update.mutate({ assigneeId: e.target.value || null })} aria-label="Assignee">
                  <option value="">Unassigned</option>
                  {(employees?.data ?? []).map((u) => <option key={u._id} value={u._id}>{u.displayName}</option>)}
                </Select>
              ) : issue.assigneeId ? (
                <span className="flex items-center gap-1.5 text-xs">
                  <Avatar name={issue.assigneeId.displayName} src={issue.assigneeId.avatarUrl} size="xs" /> {issue.assigneeId.displayName}
                </span>
              ) : (
                <span className="text-xs text-ink-faint">Unassigned</span>
              )}
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-ink-faint">Priority</span><StatusBadge status={issue.priority} /></div>
              <div className="flex justify-between"><span className="text-ink-faint">Type</span><Badge>{titleCase(issue.type)}</Badge></div>
              <div className="flex justify-between"><span className="text-ink-faint">Environment</span><span>{titleCase(issue.environment)}</span></div>
              {issue.affectedVersion && <div className="flex justify-between"><span className="text-ink-faint">Affected</span><span>{issue.affectedVersion}</span></div>}
              {issue.fixedVersion && <div className="flex justify-between"><span className="text-ink-faint">Fixed in</span><span>{issue.fixedVersion}</span></div>}
              <div className="flex justify-between"><span className="text-ink-faint">Due</span><span>{fmtDate(issue.dueDate)}</span></div>
              {issue.resolvedAt && <div className="flex justify-between"><span className="text-ink-faint">Resolved</span><span>{fmtDate(issue.resolvedAt)}</span></div>}
            </div>
          </div>

          <div className="card p-4">
            <h2 className="text-xs font-semibold mb-2.5">History</h2>
            <ol className="space-y-2.5 max-h-80 overflow-y-auto scrollbar-thin">
              {[...issue.history].reverse().map((e, i) => (
                <li key={i} className="flex gap-2 text-xs">
                  <span className="mt-1 h-2 w-2 rounded-full bg-line shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <div>
                      <span className="font-medium">{(e.byId as UserRef)?.displayName ?? 'Someone'}</span>{' '}
                      <span className="text-ink-muted">{titleCase(e.action)}</span>
                      {e.from && e.to && <span className="text-ink-faint"> · {titleCase(e.from)} → {titleCase(e.to)}</span>}
                    </div>
                    {e.note && <p className="text-2xs text-ink-muted mt-0.5">{e.note}</p>}
                    <div className="text-2xs text-ink-faint mt-0.5">{fmtDateTime(e.at)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>

      <Modal open={resolveModal !== null} onClose={() => setResolveModal(null)} title="Resolve issue" footer={
        <>
          <Button variant="outline" onClick={() => setResolveModal(null)}>Cancel</Button>
          <Button loading={transition.isPending} disabled={!resolution.fixSummary.trim()} onClick={() => transition.mutate({ status: 'resolved', resolution })}>
            Resolve
          </Button>
        </>
      }>
        <div className="space-y-3">
          <Field label="Resolution code" required htmlFor="rescode">
            <Select id="rescode" value={resolution.code} onChange={(e) => setResolution((r) => ({ ...r, code: e.target.value }))}>
              {RESOLUTION_CODES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
            </Select>
          </Field>
          <Field label="Fix summary" required htmlFor="resfix">
            <Textarea id="resfix" rows={2} value={resolution.fixSummary} onChange={(e) => setResolution((r) => ({ ...r, fixSummary: e.target.value }))} />
          </Field>
          <Field label="Root cause" htmlFor="resroot">
            <Textarea id="resroot" rows={2} value={resolution.rootCause} onChange={(e) => setResolution((r) => ({ ...r, rootCause: e.target.value }))} />
          </Field>
          <Field label="Testing performed" htmlFor="restest">
            <Textarea id="restest" rows={2} value={resolution.testingPerformed} onChange={(e) => setResolution((r) => ({ ...r, testingPerformed: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
