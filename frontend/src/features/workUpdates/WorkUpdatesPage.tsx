import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Paperclip, Timer } from 'lucide-react';
import { get } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Avatar, Button, EmptyState, ErrorState, Input, PageLoader, Pagination, Select, StatusBadge, Tabs, Progress } from '@/components/ui';
import { fmtDate, fmtMinutes, refId, titleCase } from '@/lib/utils';
import { WORK_TYPES } from '@/constants';
import type { Project, WorkUpdate } from '@/types';

export default function WorkUpdatesPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { can, user } = useAuthStore();
  const canReview = can('work_update.review', 'work_update.approve');

  const tab = params.get('tab') ?? 'mine';
  const page = parseInt(params.get('page') ?? '1', 10);
  const filters = {
    projectId: params.get('projectId') ?? '',
    status: params.get('status') ?? '',
    workType: params.get('workType') ?? '',
    q: params.get('q') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
  };

  const listQuery = useQuery({
    queryKey: ['work-updates', 'list', tab, filters, page],
    queryFn: () =>
      tab === 'pending'
        ? get<WorkUpdate[]>('/work-updates/pending-reviews', { page, limit: 20 })
        : get<WorkUpdate[]>('/work-updates', {
            page, limit: 20,
            ...(tab === 'mine' ? { userId: 'me' } : {}),
            ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
          }),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects', 'options'],
    queryFn: () => get<Project[]>('/projects', { limit: 100, sort: 'name' }),
  });

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const tabs = [
    { key: 'mine', label: 'My updates' },
    ...(canReview ? [{ key: 'team', label: 'Team' }, { key: 'pending', label: 'Pending review' }] : []),
  ];

  const items = listQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Work Updates</h1>
        <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => navigate('/work-updates/new')}>
          Add Work Update
        </Button>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={(t) => setParam('tab', t)} />

      {tab !== 'pending' && (
        <div className="flex flex-wrap gap-2">
          <Input value={filters.q} onChange={(e) => setParam('q', e.target.value)} placeholder="Search title or number…" className="h-8 text-xs max-w-52" aria-label="Search updates" />
          <Select value={filters.projectId} onChange={(e) => setParam('projectId', e.target.value)} className="h-8 text-xs w-44" aria-label="Filter by project">
            <option value="">All projects</option>
            {(projects?.data ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </Select>
          <Select value={filters.status} onChange={(e) => setParam('status', e.target.value)} className="h-8 text-xs w-44" aria-label="Filter by status">
            <option value="">All statuses</option>
            {['draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected'].map((s) => (
              <option key={s} value={s}>{titleCase(s)}</option>
            ))}
          </Select>
          <Select value={filters.workType} onChange={(e) => setParam('workType', e.target.value)} className="h-8 text-xs w-40" aria-label="Filter by work type">
            <option value="">All work types</option>
            {WORK_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
          </Select>
          <Input type="date" value={filters.from} onChange={(e) => setParam('from', e.target.value)} className="h-8 text-xs w-36" aria-label="From date" />
          <Input type="date" value={filters.to} onChange={(e) => setParam('to', e.target.value)} className="h-8 text-xs w-36" aria-label="To date" />
        </div>
      )}

      {listQuery.isLoading ? (
        <PageLoader />
      ) : listQuery.isError ? (
        <ErrorState onRetry={() => listQuery.refetch()} />
      ) : items.length === 0 ? (
        tab === 'pending' ? (
          <EmptyState title="Nothing waiting for review" description="Submitted updates from your team will appear here." />
        ) : (
          <EmptyState
            title="No work updates"
            description="Log what you worked on — progress, screenshots, blockers — and submit it for review."
            action={<Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => navigate('/work-updates/new')}>Add Work Update</Button>}
          />
        )
      ) : (
        <>
          <div className="space-y-2.5">
            {items.map((u) => {
              const author = u.userId as { _id?: string; displayName?: string; avatarUrl?: string };
              const isMine = author?._id === user?._id;
              return (
                <button key={u._id} onClick={() => navigate(`/work-updates/${u._id}`)} className="card w-full p-3.5 text-left hover:border-ink-faint transition-colors">
                  <div className="flex items-start gap-3">
                    <Avatar name={author?.displayName} src={author?.avatarUrl} size="md" />
                    <div className="min-w-0 grow">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold truncate">{u.title}</span>
                        <StatusBadge status={u.status} />
                      </div>
                      <div className="text-2xs text-ink-faint mt-0.5">
                        {u.number} · {!isMine && `${author?.displayName} · `}
                        {(u.projectId as { name?: string })?.name}
                        {refId(u.moduleId) && ` / ${(u.moduleId as { name?: string })?.name}`} · {fmtDate(u.workDate)} · {titleCase(u.workType)}
                      </div>
                      {u.blockers && (
                        <div className="mt-1.5 text-2xs text-error-main truncate">Blocker: {u.blockers}</div>
                      )}
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-2 text-2xs text-ink-faint">
                        {u.attachmentIds?.length > 0 && (
                          <span className="flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{u.attachmentIds.length}</span>
                        )}
                        {u.time?.minutesSpent ? (
                          <span className="flex items-center gap-0.5"><Timer className="h-3 w-3" />{fmtMinutes(u.time.minutesSpent)}</span>
                        ) : null}
                      </div>
                      <div className="w-24 flex items-center gap-1.5">
                        <Progress value={u.progress} className="grow" />
                        <span className="text-2xs text-ink-faint tabular-nums">{u.progress}%</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <Pagination page={page} totalPages={listQuery.data?.meta.totalPages ?? 1} onPage={(p) => setParam('page', String(p))} />
        </>
      )}
    </div>
  );
}
