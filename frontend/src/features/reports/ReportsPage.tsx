import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, RefreshCw, CheckCircle2, MessageSquareWarning } from 'lucide-react';
import { get, post, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Avatar, Button, EmptyState, ErrorState, Field, Input, Modal, PageLoader, Pagination, StatusBadge, Tabs, Textarea } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { fmtDate, fmtMinutes, todayStr } from '@/lib/utils';
import type { DailyReport, WorkUpdate } from '@/types';

interface DayAggregate {
  aggregate: {
    projectIds: string[]; moduleIds: string[]; workUpdateIds: string[]; taskIds: string[];
    issuesCreated: number; issuesResolved: number; totalMinutes: number; blockersDetected: string;
  };
  existing: DailyReport | null;
}

export default function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const { can } = useAuthStore();
  const canReview = can('report.review');
  const tab = params.get('tab') ?? 'today';
  const page = parseInt(params.get('page') ?? '1', 10);

  const tabs = [
    { key: 'today', label: "Today's report" },
    { key: 'history', label: 'My history' },
    ...(canReview ? [{ key: 'team', label: 'Team reports' }] : []),
  ];

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Daily Reports</h1>
      <Tabs tabs={tabs} value={tab} onChange={(t) => setParam('tab', t)} />
      {tab === 'today' && <TodayReport />}
      {tab === 'history' && <ReportList mine page={page} onPage={(p) => setParam('page', String(p))} />}
      {tab === 'team' && canReview && <ReportList mine={false} page={page} onPage={(p) => setParam('page', String(p))} />}
    </div>
  );
}

function TodayReport() {
  const date = todayStr();
  const queryClient = useQueryClient();
  const [fields, setFields] = useState({ blockers: '', assistanceRequired: '', nextDayPlan: '', employeeNotes: '' });
  const [loadedExisting, setLoadedExisting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['daily-report', 'preview', date],
    queryFn: async () => {
      const res = await get<DayAggregate>('/reports/daily/preview', { date });
      return res;
    },
  });

  const existing = data?.data.existing ?? null;
  const aggregate = data?.data.aggregate;

  // Populate editable fields once from the existing report.
  if (existing && !loadedExisting) {
    setFields({
      blockers: existing.blockers ?? '',
      assistanceRequired: existing.assistanceRequired ?? '',
      nextDayPlan: existing.nextDayPlan ?? '',
      employeeNotes: existing.employeeNotes ?? '',
    });
    setLoadedExisting(true);
  }

  const save = useMutation({
    mutationFn: () => post<DailyReport>('/reports/daily', { date, ...fields }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-report'] });
      toast.success('Report saved.');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const submit = useMutation({
    mutationFn: async () => {
      const saved = await post<DailyReport>('/reports/daily', { date, ...fields });
      return post(`/reports/daily/${saved.data._id}/submit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-report'] });
      toast.success('Daily report submitted.');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <PageLoader />;
  if (isError || !aggregate) return <ErrorState onRetry={() => refetch()} />;

  const locked = existing && ['submitted', 'reviewed', 'approved'].includes(existing.status);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-ink-muted">
          {fmtDate(new Date(), 'EEEE, dd MMMM yyyy')} · aggregated automatically from your submitted work updates.
          {existing && <span className="ml-2"><StatusBadge status={existing.status} /></span>}
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="card px-4 py-3"><div className="text-xl font-bold tabular-nums">{aggregate.workUpdateIds.length}</div><div className="text-2xs text-ink-muted">Work updates</div></div>
        <div className="card px-4 py-3"><div className="text-xl font-bold tabular-nums">{aggregate.taskIds.length}</div><div className="text-2xs text-ink-muted">Tasks touched</div></div>
        <div className="card px-4 py-3"><div className="text-xl font-bold tabular-nums">{aggregate.issuesResolved}</div><div className="text-2xs text-ink-muted">Issues resolved</div></div>
        <div className="card px-4 py-3"><div className="text-xl font-bold tabular-nums">{fmtMinutes(aggregate.totalMinutes)}</div><div className="text-2xs text-ink-muted">Time logged</div></div>
      </div>

      {aggregate.workUpdateIds.length === 0 && (
        <div className="card p-4 text-xs text-ink-muted">
          No submitted work updates today yet. The report never fabricates activity — add and submit work updates first, then refresh.
        </div>
      )}

      {existing?.managerNotes && (
        <div className="card p-4 border-warning-main/40">
          <div className="text-xs font-semibold mb-1">Manager feedback</div>
          <p className="text-xs text-ink-muted whitespace-pre-wrap">{existing.managerNotes}</p>
        </div>
      )}

      <div className="card p-4 sm:p-5 space-y-3.5">
        <Field label="Blockers" htmlFor="rblockers">
          <Textarea id="rblockers" rows={2} disabled={Boolean(locked)} value={fields.blockers} onChange={(e) => setFields((f) => ({ ...f, blockers: e.target.value }))} placeholder="Anything blocking you (auto-detected from updates when left empty)…" />
        </Field>
        <Field label="Assistance required" htmlFor="rhelp">
          <Textarea id="rhelp" rows={2} disabled={Boolean(locked)} value={fields.assistanceRequired} onChange={(e) => setFields((f) => ({ ...f, assistanceRequired: e.target.value }))} />
        </Field>
        <Field label="Plan for tomorrow" htmlFor="rplan">
          <Textarea id="rplan" rows={2} disabled={Boolean(locked)} value={fields.nextDayPlan} onChange={(e) => setFields((f) => ({ ...f, nextDayPlan: e.target.value }))} />
        </Field>
        <Field label="Notes" htmlFor="rnotes">
          <Textarea id="rnotes" rows={2} disabled={Boolean(locked)} value={fields.employeeNotes} onChange={(e) => setFields((f) => ({ ...f, employeeNotes: e.target.value }))} />
        </Field>
        {!locked && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" loading={save.isPending} onClick={() => save.mutate()}>Save draft</Button>
            <Button size="sm" icon={<Send className="h-3.5 w-3.5" />} loading={submit.isPending} onClick={() => submit.mutate()}>Submit report</Button>
          </div>
        )}
        {locked && <p className="text-2xs text-ink-faint">This report has been {existing!.status.replace('_', ' ')} and can no longer be edited.</p>}
      </div>
    </div>
  );
}

function ReportList({ mine, page, onPage }: { mine: boolean; page: number; onPage: (p: number) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState<DailyReport | null>(null);
  const [managerNotes, setManagerNotes] = useState('');
  void navigate;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['daily-reports', mine ? 'mine' : 'team', page],
    queryFn: () => get<DailyReport[]>('/reports/daily', { page, limit: 20, ...(mine ? {} : { all: 'true' }) }),
  });

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => post(`/reports/daily/${id}/review`, { action, managerNotes }),
    onSuccess: () => {
      toast.success('Report reviewed.');
      setReviewing(null);
      setManagerNotes('');
      queryClient.invalidateQueries({ queryKey: ['daily-reports'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  const items = data?.data ?? [];
  if (items.length === 0) return <EmptyState title="No reports yet" description={mine ? 'Submit your first daily report from the Today tab.' : 'Team reports will appear once submitted.'} />;

  return (
    <>
      <div className="card overflow-x-auto">
        <table className="table-base min-w-[640px]">
          <thead>
            <tr>
              <th>Date</th>
              {!mine && <th>Employee</th>}
              <th>Updates</th>
              <th>Issues resolved</th>
              <th>Time</th>
              <th>Blockers</th>
              <th>Status</th>
              {!mine && <th></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((r) => {
              const author = r.userId as { displayName?: string; avatarUrl?: string };
              return (
                <tr key={r._id}>
                  <td className="text-xs whitespace-nowrap">{fmtDate(r.date + 'T00:00:00')}</td>
                  {!mine && (
                    <td>
                      <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                        <Avatar name={author?.displayName} src={author?.avatarUrl} size="xs" /> {author?.displayName}
                      </span>
                    </td>
                  )}
                  <td className="text-xs tabular-nums">{Array.isArray(r.workUpdateIds) ? r.workUpdateIds.length : 0}</td>
                  <td className="text-xs tabular-nums">{r.issuesResolved}</td>
                  <td className="text-xs whitespace-nowrap">{fmtMinutes(r.totalMinutes)}</td>
                  <td className="text-2xs max-w-44 truncate">{r.blockers || <span className="text-ink-faint">—</span>}</td>
                  <td><StatusBadge status={r.status} /></td>
                  {!mine && (
                    <td>
                      {r.status === 'submitted' && (
                        <Button size="sm" variant="outline" onClick={() => setReviewing(r)}>Review</Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={onPage} />

      <Modal open={Boolean(reviewing)} onClose={() => setReviewing(null)} title={`Review report — ${reviewing ? fmtDate(reviewing.date + 'T00:00:00') : ''}`} footer={
        <>
          <Button variant="outline" icon={<MessageSquareWarning className="h-3.5 w-3.5" />} loading={review.isPending} onClick={() => reviewing && review.mutate({ id: reviewing._id, action: 'request_changes' })}>
            Request changes
          </Button>
          <Button icon={<CheckCircle2 className="h-3.5 w-3.5" />} loading={review.isPending} onClick={() => reviewing && review.mutate({ id: reviewing._id, action: 'approve' })}>
            Approve
          </Button>
        </>
      }>
        {reviewing && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="card px-3 py-2"><div className="font-bold tabular-nums">{Array.isArray(reviewing.workUpdateIds) ? reviewing.workUpdateIds.length : 0}</div><div className="text-2xs text-ink-muted">Updates</div></div>
              <div className="card px-3 py-2"><div className="font-bold tabular-nums">{reviewing.issuesResolved}</div><div className="text-2xs text-ink-muted">Issues resolved</div></div>
              <div className="card px-3 py-2"><div className="font-bold tabular-nums">{fmtMinutes(reviewing.totalMinutes)}</div><div className="text-2xs text-ink-muted">Time</div></div>
            </div>
            {Array.isArray(reviewing.workUpdateIds) && (reviewing.workUpdateIds as WorkUpdate[]).some((u) => typeof u === 'object') && (
              <div>
                <div className="font-semibold mb-1">Work updates</div>
                <ul className="space-y-1">
                  {(reviewing.workUpdateIds as WorkUpdate[]).map((u) => (
                    <li key={u._id} className="flex items-center gap-2">
                      <span className="font-mono text-2xs text-ink-faint">{u.number}</span>
                      <span className="truncate">{u.title}</span>
                      <StatusBadge status={u.status} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {reviewing.blockers && <p><span className="font-semibold">Blockers:</span> {reviewing.blockers}</p>}
            {reviewing.nextDayPlan && <p><span className="font-semibold">Next day:</span> {reviewing.nextDayPlan}</p>}
            <Field label="Manager notes" htmlFor="mnotes">
              <Textarea id="mnotes" rows={3} value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} placeholder="Feedback for the employee…" />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
