import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Timer, Bug, CalendarCheck, ArrowRight } from 'lucide-react';
import { get } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button, EmptyState, ErrorState, PageLoader, StatusBadge, Avatar, Progress } from '@/components/ui';
import { fmtDate, fmtMinutes, fmtRelative, refId, todayStr } from '@/lib/utils';
import type { Task, WorkUpdate, DailyReport } from '@/types';

interface DashboardKpis {
  kpis: {
    activeEmployees: number; activeProjects: number; updatesToday: number; pendingReviews: number;
    approvedToday: number; tasksInProgress: number; tasksCompleted30d: number; overdueTasks: number;
    openIssues: number; criticalIssues: number; blockedTasks: number; reportsExpected: number; reportsSubmitted: number;
  };
  projectHealth: Record<string, number>;
}

function KpiCard({ label, value, tone, onClick }: { label: string; value: number; tone?: 'danger' | 'warning' | 'success'; onClick?: () => void }) {
  const toneCls = {
    danger: value > 0 ? 'text-error-main' : 'text-text-primary',
    warning: value > 0 ? 'text-warning-main' : 'text-text-primary',
    success: 'text-success-main',
    default: 'text-text-primary',
  };
  return (
    <button
      onClick={onClick}
      className="bg-surface-primary border border-border-primary rounded-lg px-4 py-3 text-left hover:border-border-strong hover:bg-surface-secondary transition-all duration-200 min-w-0 disabled:opacity-50 disabled:cursor-default"
      disabled={!onClick}
    >
      <div className={`text-2xl font-bold tabular-nums ${toneCls[tone ?? 'default']}`}>{value}</div>
      <div className="text-xs text-text-secondary mt-0.5 truncate">{label}</div>
    </button>
  );
}

export default function DashboardPage() {
  const { user, can } = useAuthStore();
  const navigate = useNavigate();
  const isManager = can('work_update.review', 'analytics.team');

  const { data: myTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', 'mine-dash'],
    queryFn: () => get<Task[]>('/tasks', { assigneeId: 'me', status: 'todo,in_progress,blocked,changes_requested,under_review', limit: 8, sort: 'dueDate' }),
  });
  const { data: myUpdates } = useQuery({
    queryKey: ['work-updates', 'mine-dash'],
    queryFn: () => get<WorkUpdate[]>('/work-updates', { userId: 'me', limit: 5 }),
  });
  const { data: report } = useQuery({
    queryKey: ['daily-report', todayStr()],
    queryFn: () => get<DailyReport[]>('/reports/daily', { from: todayStr(), to: todayStr() }),
  });
  const { data: dash, isLoading: dashLoading, isError, refetch } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => get<DashboardKpis>('/analytics/dashboard'),
    enabled: isManager,
  });
  const { data: pending } = useQuery({
    queryKey: ['work-updates', 'pending'],
    queryFn: () => get<WorkUpdate[]>('/work-updates/pending-reviews', { limit: 6 }),
    enabled: isManager,
  });

  const todayReport = report?.data?.[0];
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';

  if (isManager && dashLoading) return <PageLoader />;
  if (isManager && isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {greeting}, {user?.firstName}
          </h1>
          <p className="text-sm text-text-secondary mt-1">{fmtDate(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => navigate('/work-updates/new')}>
            Add Work Update
          </Button>
          <Button size="sm" variant="outline" icon={<Bug className="h-3.5 w-3.5" />} onClick={() => navigate('/issues?create=1')}>
            Report Issue
          </Button>
          <Button size="sm" variant="outline" icon={<CalendarCheck className="h-3.5 w-3.5" />} onClick={() => navigate('/reports')}>
            Daily Report
          </Button>
        </div>
      </div>

      {/* Manager KPI grid */}
      {isManager && dash && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
          <KpiCard label="Active projects" value={dash.data.kpis.activeProjects} onClick={() => navigate('/projects')} />
          <KpiCard label="Updates today" value={dash.data.kpis.updatesToday} onClick={() => navigate('/work-updates')} />
          <KpiCard label="Pending reviews" value={dash.data.kpis.pendingReviews} tone="warning" onClick={() => navigate('/work-updates?tab=pending')} />
          <KpiCard label="Overdue tasks" value={dash.data.kpis.overdueTasks} tone="danger" onClick={() => navigate('/tasks?overdue=true')} />
          <KpiCard label="Open issues" value={dash.data.kpis.openIssues} onClick={() => navigate('/issues')} />
          <KpiCard label="Critical issues" value={dash.data.kpis.criticalIssues} tone="danger" onClick={() => navigate('/issues?severity=critical')} />
          <KpiCard label="Blocked tasks" value={dash.data.kpis.blockedTasks} tone="danger" onClick={() => navigate('/tasks?status=blocked')} />
          <KpiCard label="In progress" value={dash.data.kpis.tasksInProgress} onClick={() => navigate('/tasks')} />
          <KpiCard label="Done (30d)" value={dash.data.kpis.tasksCompleted30d} tone="success" />
          <KpiCard label="Approved today" value={dash.data.kpis.approvedToday} tone="success" />
          <KpiCard label="Active employees" value={dash.data.kpis.activeEmployees} onClick={() => navigate('/team')} />
          <KpiCard label={`Reports today (${dash.data.kpis.reportsSubmitted}/${dash.data.kpis.reportsExpected})`} value={dash.data.kpis.reportsSubmitted} onClick={() => navigate('/reports')} />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Pending reviews (managers) or daily report status */}
        {isManager ? (
          <section className="bg-surface-primary border border-border-primary rounded-lg overflow-hidden">
            <header className="flex items-center justify-between px-5 py-4 border-b border-border-primary bg-surface-secondary">
              <h2 className="text-sm font-semibold text-text-primary">Pending approvals</h2>
              <button onClick={() => navigate('/work-updates?tab=pending')} className="text-xs text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1 transition-colors">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </header>
            <div className="divide-y divide-border-primary/50">
              {(pending?.data ?? []).length === 0 && <EmptyState title="Nothing waiting for review" description="Submitted work updates will appear here." />}
              {(pending?.data ?? []).map((u) => (
                <button key={u._id} onClick={() => navigate(`/work-updates/${u._id}`)} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-interactive-hover transition-colors">
                  <Avatar name={(u.userId as { displayName?: string })?.displayName} src={(u.userId as { avatarUrl?: string })?.avatarUrl} size="sm" />
                  <div className="min-w-0 grow">
                    <div className="text-sm font-medium text-text-primary truncate">{u.title}</div>
                    <div className="text-xs text-text-tertiary mt-0.5">
                      {u.number} · {(u.projectId as { name?: string })?.name} · {fmtRelative(u.submittedAt)}
                    </div>
                  </div>
                  <StatusBadge status={u.status} />
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="bg-surface-primary border border-border-primary rounded-lg p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Today's daily report</h2>
            {todayReport ? (
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-text-secondary flex items-center gap-2">
                  <StatusBadge status={todayReport.status} />
                  <span>{fmtMinutes(todayReport.totalMinutes)} logged</span>
                  <span>·</span>
                  <span>{Array.isArray(todayReport.workUpdateIds) ? todayReport.workUpdateIds.length : 0} updates</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate('/reports')}>
                  Open
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-text-secondary">Not started yet — it auto-fills from your work updates.</p>
                <Button size="sm" onClick={() => navigate('/reports')}>
                  Prepare
                </Button>
              </div>
            )}
          </section>
        )}

        {/* My tasks */}
        <section className="bg-surface-primary border border-border-primary rounded-lg overflow-hidden">
          <header className="flex items-center justify-between px-5 py-4 border-b border-border-primary bg-surface-secondary">
            <h2 className="text-sm font-semibold text-text-primary">My open tasks</h2>
            <button onClick={() => navigate('/tasks')} className="text-xs text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1 transition-colors">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </header>
          {tasksLoading ? (
            <div className="p-5">
              <PageLoader rows={3} />
            </div>
          ) : (myTasks?.data ?? []).length === 0 ? (
            <EmptyState title="No open tasks" description="Tasks assigned to you will appear here." />
          ) : (
            <div className="divide-y divide-border-primary/50">
              {(myTasks?.data ?? []).map((t) => {
                const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed';
                return (
                  <button key={t._id} onClick={() => navigate(`/tasks/${t._id}`)} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-interactive-hover transition-colors">
                    <span className="text-xs font-mono text-text-tertiary shrink-0">{t.number}</span>
                    <span className="text-sm font-medium text-text-primary truncate grow">{t.title}</span>
                    {t.dueDate && (
                      <span className={`text-xs shrink-0 font-medium ${overdue ? 'text-error-main font-semibold' : 'text-text-tertiary'}`}>{fmtDate(t.dueDate, 'dd MMM')}</span>
                    )}
                    <StatusBadge status={t.status} />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent updates */}
        <section className="bg-surface-primary border border-border-primary rounded-lg overflow-hidden lg:col-span-2">
          <header className="flex items-center justify-between px-5 py-4 border-b border-border-primary bg-surface-secondary">
            <h2 className="text-sm font-semibold text-text-primary">My recent work updates</h2>
            <button onClick={() => navigate('/work-updates')} className="text-xs text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1 transition-colors">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </header>
          {(myUpdates?.data ?? []).length === 0 ? (
            <EmptyState
              title="No work updates yet"
              description="Log what you worked on — screenshots, progress, blockers — and submit it for review."
              action={<Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => navigate('/work-updates/new')}>Add your first update</Button>}
            />
          ) : (
            <div className="divide-y divide-border-primary/50">
              {(myUpdates?.data ?? []).map((u) => (
                <button key={u._id} onClick={() => navigate(`/work-updates/${u._id}`)} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-interactive-hover transition-colors">
                  <span className="text-xs font-mono text-text-tertiary shrink-0">{u.number}</span>
                  <div className="min-w-0 grow">
                    <div className="text-sm font-medium text-text-primary truncate">{u.title}</div>
                    <div className="text-xs text-text-tertiary truncate mt-0.5">
                      {(u.projectId as { name?: string })?.name}
                      {refId(u.moduleId) && ` · ${(u.moduleId as { name?: string })?.name}`} · {fmtDate(u.workDate)}
                    </div>
                  </div>
                  <div className="hidden sm:block w-24 shrink-0">
                    <Progress value={u.progress} />
                  </div>
                  {u.time?.minutesSpent ? <span className="text-xs text-text-tertiary shrink-0 flex items-center gap-1"><Timer className="h-3.5 w-3.5" />{fmtMinutes(u.time.minutesSpent)}</span> : null}
                  <StatusBadge status={u.status} />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
