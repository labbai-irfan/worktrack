import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, ExternalLink, Archive, AlertTriangle, CalendarClock, ShieldCheck, ShieldAlert, ShieldX, Info } from 'lucide-react';
import { get, post, patch, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Avatar, Badge, Button, EmptyState, ErrorState, Field, Input, Modal, PageLoader, Progress, Select, StatusBadge, Tabs, Textarea } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { cn, fmtDate, fmtRelative, titleCase } from '@/lib/utils';
import KanbanBoard from '@/features/tasks/KanbanBoard';
import ProjectTimeline from './ProjectTimeline';
import type { Activity, Milestone, MilestoneAlerts, Module, Project, ProjectHealth, Release, WorkUpdate, Issue } from '@/types';

const moduleSchema = z.object({
  name: z.string().min(2, 'Module name is required.'),
  key: z.string().min(2, '2-12 characters.').max(12).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Letters, numbers, underscore.'),
  description: z.string().optional(),
  color: z.string().default('#0891b2'),
});
type ModuleValues = z.infer<typeof moduleSchema>;

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'modules', label: 'Modules' },
  { key: 'board', label: 'Board' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'updates', label: 'Work Updates' },
  { key: 'issues', label: 'Issues' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'team', label: 'Team' },
  { key: 'releases', label: 'Releases' },
  { key: 'activity', label: 'Activity' },
];

export default function ProjectDetailPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  const [moduleOpen, setModuleOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuthStore();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => get<Project>(`/projects/${id}`),
  });
  const { data: modules } = useQuery({
    queryKey: ['modules', id],
    queryFn: () => get<Module[]>('/modules', { projectId: id }),
    enabled: Boolean(id),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ModuleValues>({ resolver: zodResolver(moduleSchema) });
  const createModule = useMutation({
    mutationFn: (v: ModuleValues) => post('/modules', { ...v, projectId: id }),
    onSuccess: () => {
      toast.success('Module created.');
      queryClient.invalidateQueries({ queryKey: ['modules', id] });
      setModuleOpen(false);
      reset();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const archiveProject = useMutation({
    mutationFn: () => post(`/projects/${id}/archive`),
    onSuccess: () => {
      toast.success('Project archived.');
      navigate('/projects');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <PageLoader />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;
  const project = data.data;
  const stats = project.stats;
  const setTab = (t: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', t);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: project.color }}>
            {project.key.slice(0, 2)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold truncate">{project.name}</h1>
              <StatusBadge status={project.status} />
              <Badge tone={project.health === 'healthy' ? 'success' : project.health === 'attention' ? 'warning' : 'danger'}>{titleCase(project.health)}</Badge>
            </div>
            <p className="text-xs text-ink-muted">
              {project.key} · Manager: {project.managerId?.displayName ?? '—'}
              {project.targetDate && ` · Target ${fmtDate(project.targetDate)}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {project.repositoryUrl && (
            <a href={project.repositoryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
              Repository <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {can('project.archive') && project.status !== 'archived' && (
            <Button size="sm" variant="outline" icon={<Archive className="h-3.5 w-3.5" />} onClick={() => archiveProject.mutate()} loading={archiveProject.isPending}>
              Archive
            </Button>
          )}
        </div>
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="card px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-2xs text-ink-muted">Progress</span>
                <span className="text-xs font-semibold tabular-nums">{project.progress}%</span>
              </div>
              <Progress value={project.progress} />
            </div>
            <div className="card px-4 py-3">
              <div className="text-xl font-bold tabular-nums">{stats ? Object.values(stats.tasksByStatus).reduce((a, b) => a + b, 0) : 0}</div>
              <div className="text-2xs text-ink-muted">Tasks ({stats?.tasksByStatus.completed ?? 0} completed)</div>
            </div>
            <div className="card px-4 py-3">
              <div className={`text-xl font-bold tabular-nums ${stats && stats.criticalIssues > 0 ? 'text-error-main' : ''}`}>{stats?.openIssues ?? 0}</div>
              <div className="text-2xs text-ink-muted">Open issues ({stats?.criticalIssues ?? 0} critical)</div>
            </div>
            <div className="card px-4 py-3">
              <div className="text-xl font-bold tabular-nums">{stats?.workUpdates ?? 0}</div>
              <div className="text-2xs text-ink-muted">Work updates</div>
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ProjectHealthCard projectId={id} />
            <MilestoneAlertsCard projectId={id} />
          </div>
          {project.description && (
            <div className="card p-4">
              <h2 className="text-xs font-semibold mb-1.5">About</h2>
              <p className="text-xs text-ink-muted whitespace-pre-wrap">{project.description}</p>
            </div>
          )}
          <ProjectActivity projectId={id} limit={8} />
        </div>
      )}

      {tab === 'timeline' && <ProjectTimeline projectId={id} />}

      {tab === 'modules' && (
        <div className="space-y-3">
          {can('module.create') && (
            <div className="flex justify-end">
              <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setModuleOpen(true)}>New Module</Button>
            </div>
          )}
          {(modules?.data ?? []).length === 0 ? (
            <EmptyState title="No modules" description="Modules group work inside a project — e.g. Leads, Attendance, Billing." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(modules?.data ?? []).map((m) => (
                <button key={m._id} onClick={() => navigate(`/tasks?projectId=${id}&moduleId=${m._id}`)} className="card p-4 text-left hover:border-ink-faint transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} aria-hidden />
                      <span className="text-sm font-semibold truncate">{m.name}</span>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                  {m.description && <p className="text-2xs text-ink-muted mt-1 line-clamp-2">{m.description}</p>}
                  <div className="mt-3 flex items-center gap-2">
                    <Progress value={m.progress} className="grow" />
                    <span className="text-2xs text-ink-muted tabular-nums">{m.progress}%</span>
                  </div>
                  {m.ownerId && (
                    <div className="mt-2 flex items-center gap-1.5 text-2xs text-ink-faint">
                      <Avatar name={m.ownerId.displayName} src={m.ownerId.avatarUrl} size="xs" /> {m.ownerId.displayName}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'board' && <KanbanBoard projectId={id} />}

      {tab === 'updates' && <ProjectWorkUpdates projectId={id} />}
      {tab === 'issues' && <ProjectIssues projectId={id} />}
      {tab === 'milestones' && <ProjectMilestones projectId={id} canManage={can('milestone.manage')} />}

      {tab === 'team' && (
        <div className="card divide-y divide-line/60">
          {project.members.map((m, i) => {
            const u = m.userId as { _id?: string; displayName?: string; avatarUrl?: string; jobTitle?: string };
            return (
              <div key={u._id ?? i} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={u.displayName} src={u.avatarUrl} size="md" />
                <div className="min-w-0 grow">
                  <div className="text-xs font-medium">{u.displayName}</div>
                  <div className="text-2xs text-ink-faint">{u.jobTitle}</div>
                </div>
                <Badge tone={m.role === 'manager' ? 'success' : m.role === 'lead' ? 'info' : 'neutral'}>{m.role}</Badge>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'releases' && <ProjectReleases projectId={id} />}
      {tab === 'activity' && <ProjectActivity projectId={id} limit={30} />}

      <Modal open={moduleOpen} onClose={() => setModuleOpen(false)} title="New module" footer={
        <>
          <Button variant="outline" onClick={() => setModuleOpen(false)}>Cancel</Button>
          <Button loading={createModule.isPending} onClick={handleSubmit((v) => createModule.mutate(v))}>Create module</Button>
        </>
      }>
        <form className="space-y-4" onSubmit={handleSubmit((v) => createModule.mutate(v))} noValidate>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Module name" error={errors.name?.message} required className="col-span-2" htmlFor="mname">
              <Input id="mname" placeholder="Leads" {...register('name')} />
            </Field>
            <Field label="Key" error={errors.key?.message} required htmlFor="mkey">
              <Input id="mkey" placeholder="LEADS" className="uppercase" maxLength={12} {...register('key')} />
            </Field>
          </div>
          <Field label="Description" htmlFor="mdesc">
            <Textarea id="mdesc" rows={2} {...register('description')} />
          </Field>
          <Field label="Color" htmlFor="mcolor">
            <Input id="mcolor" type="color" className="h-9 w-20 p-1" {...register('color')} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function ProjectWorkUpdates({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['work-updates', { projectId }],
    queryFn: () => get<WorkUpdate[]>('/work-updates', { projectId, limit: 30 }),
  });
  if (isLoading) return <PageLoader rows={4} />;
  const items = data?.data ?? [];
  if (items.length === 0) return <EmptyState title="No work updates in this project yet" />;
  return (
    <div className="card divide-y divide-line/60">
      {items.map((u) => (
        <button key={u._id} onClick={() => navigate(`/work-updates/${u._id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-sunken">
          <Avatar name={(u.userId as { displayName?: string })?.displayName} src={(u.userId as { avatarUrl?: string })?.avatarUrl} size="sm" />
          <div className="min-w-0 grow">
            <div className="text-xs font-medium truncate">{u.title}</div>
            <div className="text-2xs text-ink-faint">{u.number} · {fmtDate(u.workDate)} · {titleCase(u.workType)}</div>
          </div>
          <StatusBadge status={u.status} />
        </button>
      ))}
    </div>
  );
}

function ProjectIssues({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['issues', { projectId }],
    queryFn: () => get<Issue[]>('/issues', { projectId, limit: 30 }),
  });
  if (isLoading) return <PageLoader rows={4} />;
  const items = data?.data ?? [];
  if (items.length === 0) return <EmptyState title="No issues in this project" description="That's a good sign." />;
  return (
    <div className="card divide-y divide-line/60">
      {items.map((i) => (
        <button key={i._id} onClick={() => navigate(`/issues/${i._id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-sunken">
          <span className="text-2xs font-mono text-ink-faint shrink-0">{i.number}</span>
          <span className="text-xs font-medium truncate grow">{i.title}</span>
          <StatusBadge status={i.severity} />
          <StatusBadge status={i.status} />
        </button>
      ))}
    </div>
  );
}

const HEALTH_META: Record<string, { icon: typeof ShieldCheck; tone: 'success' | 'warning' | 'danger'; label: string }> = {
  healthy: { icon: ShieldCheck, tone: 'success', label: 'Healthy' },
  attention: { icon: ShieldAlert, tone: 'warning', label: 'Needs Attention' },
  at_risk: { icon: ShieldAlert, tone: 'danger', label: 'At Risk' },
  critical: { icon: ShieldX, tone: 'danger', label: 'Critical' },
};

/** Rule-based project health: every verdict shows the metrics and reasons behind it. */
function ProjectHealthCard({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['projects', projectId, 'health'],
    queryFn: () => get<ProjectHealth>(`/projects/${projectId}/health`),
  });
  if (isLoading) return <PageLoader rows={3} />;
  const h = data?.data;
  if (!h) return null;
  const meta = HEALTH_META[h.health] ?? HEALTH_META.healthy;
  const Icon = meta.icon;
  return (
    <section className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Badge tone={meta.tone} className="!text-xs !px-2.5 !py-1">
          <Icon className="h-3.5 w-3.5" /> {meta.label}
        </Badge>
      </div>
      <ul className="space-y-1 mb-3">
        {h.reasons.map((r, i) => (
          <li key={i} className="text-2xs text-ink-muted flex items-start gap-1.5">
            <Info className="h-3 w-3 mt-0.5 shrink-0 text-ink-faint" /> {r}
          </li>
        ))}
      </ul>
      <div className="text-2xs bg-surface-sunken rounded-md px-3 py-2 mb-3">
        <span className="font-semibold">Recommended: </span>{h.recommendedAction}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-sm font-bold tabular-nums">{h.metrics.overdueTasks}/{h.metrics.openTasks}</div>
          <div className="text-2xs text-ink-faint">Overdue tasks</div>
        </div>
        <div>
          <div className={cn('text-sm font-bold tabular-nums', h.metrics.blockedTasks > 0 && 'text-error-main')}>{h.metrics.blockedTasks}</div>
          <div className="text-2xs text-ink-faint">Blocked</div>
        </div>
        <div>
          <div className="text-sm font-bold tabular-nums">{h.metrics.daysSinceActivity ?? '—'}</div>
          <div className="text-2xs text-ink-faint">Days since activity</div>
        </div>
      </div>
    </section>
  );
}

/** Upcoming and overdue milestones for this project — surfaced so delays aren't discovered too late. */
function MilestoneAlertsCard({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['milestones', 'alerts', projectId],
    queryFn: () => get<MilestoneAlerts>('/milestones/alerts', { projectId }),
  });
  if (isLoading) return <PageLoader rows={3} />;
  const overdue = data?.data.overdue ?? [];
  const upcoming = data?.data.upcoming ?? [];
  return (
    <section className="card p-4">
      <h2 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Milestone alerts</h2>
      {overdue.length === 0 && upcoming.length === 0 ? (
        <EmptyState title="No milestone alerts" description="Nothing overdue or due within 7 days." />
      ) : (
        <div className="space-y-1.5">
          {overdue.map((m) => (
            <button key={m._id} onClick={() => navigate(`/projects/${projectId}?tab=milestones`)} className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-md hover:bg-surface-sunken">
              <AlertTriangle className="h-3.5 w-3.5 text-error-main shrink-0" />
              <span className="text-xs font-medium truncate grow">{m.name}</span>
              <span className="text-2xs text-error-main font-semibold whitespace-nowrap">Overdue · {fmtDate(m.dueDate)}</span>
            </button>
          ))}
          {upcoming.map((m) => (
            <button key={m._id} onClick={() => navigate(`/projects/${projectId}?tab=milestones`)} className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-md hover:bg-surface-sunken">
              <CalendarClock className="h-3.5 w-3.5 text-warning-main shrink-0" />
              <span className="text-xs font-medium truncate grow">{m.name}</span>
              <span className="text-2xs text-ink-faint whitespace-nowrap">Due {fmtDate(m.dueDate)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectMilestones({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: () => get<Milestone[]>('/milestones', { projectId }),
  });
  const { register, handleSubmit, reset } = useForm<{ name: string; dueDate?: string; description?: string }>();
  const create = useMutation({
    mutationFn: (v: { name: string; dueDate?: string; description?: string }) => post('/milestones', { ...v, projectId, dueDate: v.dueDate || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => patch(`/milestones/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['milestones', projectId] }),
  });
  if (isLoading) return <PageLoader rows={3} />;
  const items = data?.data ?? [];
  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>New Milestone</Button>
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState title="No milestones" description="Milestones mark major delivery targets." />
      ) : (
        <div className="card divide-y divide-line/60">
          {items.map((m) => (
            <div key={m._id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 grow">
                <div className="text-xs font-semibold">{m.name}</div>
                {m.description && <div className="text-2xs text-ink-muted truncate">{m.description}</div>}
                <div className="text-2xs text-ink-faint mt-0.5">{m.dueDate ? `Due ${fmtDate(m.dueDate)}` : 'No due date'}</div>
              </div>
              <div className="w-28 hidden sm:block"><Progress value={m.progress} /></div>
              {canManage ? (
                <Select value={m.status} onChange={(e) => update.mutate({ id: m._id, status: e.target.value })} className="h-7 w-32 text-2xs" aria-label="Milestone status">
                  {['planned', 'in_progress', 'completed', 'missed'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                </Select>
              ) : (
                <StatusBadge status={m.status} />
              )}
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New milestone" footer={
        <>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={create.isPending} onClick={handleSubmit((v) => create.mutate(v))}>Create</Button>
        </>
      }>
        <form className="space-y-4" noValidate>
          <Field label="Name" required htmlFor="msname">
            <Input id="msname" {...register('name', { required: true })} />
          </Field>
          <Field label="Description" htmlFor="msdesc">
            <Textarea id="msdesc" rows={2} {...register('description')} />
          </Field>
          <Field label="Due date" htmlFor="msdue">
            <Input id="msdue" type="date" {...register('dueDate')} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function ProjectReleases({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['releases', { projectId }],
    queryFn: () => get<Release[]>('/releases', { projectId }),
  });
  if (isLoading) return <PageLoader rows={3} />;
  const items = data?.data ?? [];
  if (items.length === 0) return <EmptyState title="No releases yet" description="Track deployments and version history here." />;
  return (
    <div className="card divide-y divide-line/60">
      {items.map((r) => (
        <button key={r._id} onClick={() => navigate('/releases')} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-sunken">
          <span className="text-xs font-mono font-semibold shrink-0">{r.version}</span>
          <span className="text-xs text-ink-muted truncate grow">{r.name}</span>
          <span className="text-2xs text-ink-faint">{titleCase(r.environment)}</span>
          <StatusBadge status={r.status} />
        </button>
      ))}
    </div>
  );
}

function ProjectActivity({ projectId, limit }: { projectId: string; limit: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['activities', projectId, limit],
    queryFn: () => get<Activity[]>('/activities', { projectId, limit }),
  });
  if (isLoading) return <PageLoader rows={3} />;
  const items = data?.data ?? [];
  return (
    <section className="card">
      <header className="px-4 py-3 border-b border-line">
        <h2 className="text-xs font-semibold">Activity</h2>
      </header>
      {items.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <div className="divide-y divide-line/60">
          {items.map((a) => (
            <div key={a._id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar name={a.actorId?.displayName} src={a.actorId?.avatarUrl} size="sm" />
              <div className="min-w-0 grow text-xs">
                <span className="font-medium">{a.actorId?.displayName}</span>{' '}
                <span className="text-ink-muted">{titleCase(a.action.split('.')[1] ?? a.action)}</span>{' '}
                <span className="font-medium truncate">{a.entityLabel}</span>
                {a.previousValue && a.newValue && (
                  <span className="text-ink-faint"> · {titleCase(a.previousValue)} → {titleCase(a.newValue)}</span>
                )}
              </div>
              <span className="text-2xs text-ink-faint shrink-0">{fmtRelative(a.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
