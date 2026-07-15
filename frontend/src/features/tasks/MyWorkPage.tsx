/* My Work — the personal command center: what needs attention right now. */
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CalendarDays, Ban, Eye, CheckCircle2 } from 'lucide-react';
import { get } from '@/lib/api';
import { EmptyState, ErrorState, PageLoader, Progress, StatusBadge } from '@/components/ui';
import { cn, fmtDate } from '@/lib/utils';
import type { MyWork, Task } from '@/types';

function TaskRow({ task, showDue }: { task: Task; showDue?: boolean }) {
  const navigate = useNavigate();
  const checklistDone = task.checklist?.filter((c) => c.done).length ?? 0;
  return (
    <button
      onClick={() => navigate(`/tasks/${task._id}`)}
      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-interactive-hover transition-colors"
    >
      <span className="text-xs font-mono text-text-tertiary shrink-0">{task.number}</span>
      <div className="min-w-0 grow">
        <div className="text-sm font-medium text-text-primary truncate">{task.title}</div>
        <div className="text-xs text-text-tertiary truncate mt-0.5">
          {(task.projectId as { name?: string })?.name}
          {task.blockedReason && task.status === 'blocked' && <span className="text-error-main"> · {task.blockedReason}</span>}
          {task.checklist?.length > 0 && ` · ${checklistDone}/${task.checklist.length} checklist`}
        </div>
      </div>
      {task.progress > 0 && (
        <div className="hidden sm:block w-20 shrink-0">
          <Progress value={task.progress} />
        </div>
      )}
      {showDue && task.dueDate && (
        <span className="text-xs text-text-tertiary shrink-0 whitespace-nowrap">{fmtDate(task.dueDate, 'dd MMM')}</span>
      )}
      <StatusBadge status={task.priority} />
      <StatusBadge status={task.status} className="hidden sm:inline-flex" />
    </button>
  );
}

function Section({
  title, icon, tone, tasks, emptyText, showDue,
}: {
  title: string;
  icon: ReactNode;
  tone?: 'danger' | 'warning' | 'default';
  tasks: Task[];
  emptyText: string;
  showDue?: boolean;
}) {
  if (tasks.length === 0 && tone !== 'danger') {
    // Hide empty non-critical sections to keep the page focused.
    return null;
  }
  const toneCls = tone === 'danger' ? 'text-error-main' : tone === 'warning' ? 'text-warning-main' : 'text-text-secondary';
  return (
    <section className="bg-surface-primary border border-border-primary rounded-lg overflow-hidden">
      <header className="flex items-center gap-2 px-5 py-3.5 border-b border-border-primary bg-surface-secondary">
        <span className={toneCls}>{icon}</span>
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        <span className={cn('text-xs tabular-nums font-semibold ml-1', tone === 'danger' && tasks.length > 0 ? 'text-error-main' : 'text-text-tertiary')}>
          {tasks.length}
        </span>
      </header>
      {tasks.length === 0 ? (
        <div className="flex items-center gap-2 px-5 py-4 text-xs text-text-tertiary">
          <CheckCircle2 className="h-4 w-4 text-success-main" /> {emptyText}
        </div>
      ) : (
        <div className="divide-y divide-border-primary/50">
          {tasks.map((t) => <TaskRow key={t._id} task={t} showDue={showDue} />)}
        </div>
      )}
    </section>
  );
}

export default function MyWorkPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tasks', 'my-work'],
    queryFn: () => get<MyWork>('/tasks/my-work'),
    refetchInterval: 120_000,
  });

  if (isLoading) return <PageLoader />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;
  const w = data.data;
  const total = w.counts.overdue + w.counts.today + w.counts.blocked + w.counts.inReview;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">My Work</h1>
        <p className="text-sm text-text-secondary mt-1">
          {total === 0
            ? 'Nothing urgent — check upcoming work below.'
            : `${total} item${total === 1 ? '' : 's'} need${total === 1 ? 's' : ''} your attention.`}
          {w.counts.noDueDate > 0 && ` ${w.counts.noDueDate} of your open tasks have no due date.`}
        </p>
      </div>

      <Section title="Overdue" icon={<AlertTriangle className="h-4 w-4" />} tone="danger" tasks={w.overdue} emptyText="Nothing overdue." showDue />
      <Section title="Blocked" icon={<Ban className="h-4 w-4" />} tone="danger" tasks={w.blocked} emptyText="Nothing blocked." />
      <Section title="Waiting for my review" icon={<Eye className="h-4 w-4" />} tone="warning" tasks={w.inReview} emptyText="No reviews waiting." />
      <Section title="Due today" icon={<CalendarClock className="h-4 w-4" />} tone="warning" tasks={w.today} emptyText="Nothing due today." />
      <Section title="Coming up (7 days)" icon={<CalendarDays className="h-4 w-4" />} tasks={w.upcoming} emptyText="Nothing scheduled this week." showDue />

      {total === 0 && w.upcoming.length === 0 && (
        <EmptyState title="All clear" description="No overdue, blocked, or scheduled work. Pick something from the backlog or your task list." />
      )}
    </div>
  );
}
