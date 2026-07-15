/* Project Timeline — a read-only Gantt-lite view built from task start/due dates and milestones.
 * Drag/resize, dependency connectors, and critical-path highlighting are deferred to a later
 * release (they require the dependency graph work already in place, but the interaction layer
 * is a separate, larger effort — see docs/FEATURE_ANALYSIS.md Release 4).
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Diamond } from 'lucide-react';
import { get } from '@/lib/api';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui';
import { cn, fmtDate } from '@/lib/utils';
import type { Milestone, Task } from '@/types';

// Matches STATUS_TONES in constants/index.ts so a status reads the same color
// on a Kanban card, a StatusBadge, and here.
const STATUS_COLOR: Record<string, string> = {
  backlog: 'bg-neutral-main', todo: 'bg-info-main', planned: 'bg-info-main', in_progress: 'bg-primary-500',
  blocked: 'bg-error-main', under_review: 'bg-info-main', testing: 'bg-warning-main',
  changes_requested: 'bg-warning-main', completed: 'bg-success-main', cancelled: 'bg-neutral-main',
};

function dayMs(d: Date) { return d.getTime(); }

export default function ProjectTimeline({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data: taskData, isLoading, isError, refetch } = useQuery({
    queryKey: ['tasks', 'timeline', projectId],
    queryFn: () => get<Task[]>('/tasks', { projectId, limit: 500, includeSubtasks: 'true', sort: 'startDate' }),
  });
  const { data: milestoneData } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: () => get<Milestone[]>('/milestones', { projectId }),
  });

  const allTasks = taskData?.data ?? [];
  const milestones = milestoneData?.data ?? [];
  const scheduled = allTasks.filter((t) => t.startDate || t.dueDate);
  const unscheduled = allTasks.filter((t) => !t.startDate && !t.dueDate);

  const { rangeStart, rangeEnd, weeks } = useMemo(() => {
    const dates: Date[] = [];
    scheduled.forEach((t) => {
      if (t.startDate) dates.push(new Date(t.startDate));
      if (t.dueDate) dates.push(new Date(t.dueDate));
    });
    milestones.forEach((m) => { if (m.dueDate) dates.push(new Date(m.dueDate)); });
    const now = new Date();
    if (dates.length === 0) dates.push(new Date(now.getTime() - 14 * 86_400_000), new Date(now.getTime() + 14 * 86_400_000));
    dates.push(now);
    let min = new Date(Math.min(...dates.map(dayMs)));
    let max = new Date(Math.max(...dates.map(dayMs)));
    // Pad a few days on each side so bars don't touch the edges.
    min = new Date(min.getTime() - 3 * 86_400_000);
    max = new Date(max.getTime() + 3 * 86_400_000);
    const totalDays = Math.max(1, Math.round((dayMs(max) - dayMs(min)) / 86_400_000));
    const weekTicks: Date[] = [];
    for (let d = new Date(min); d <= max; d.setDate(d.getDate() + 7)) weekTicks.push(new Date(d));
    return { rangeStart: min, rangeEnd: max, weeks: weekTicks, totalDays };
  }, [scheduled, milestones]);

  function pct(date: Date) {
    const total = dayMs(rangeEnd) - dayMs(rangeStart);
    return total <= 0 ? 0 : ((dayMs(date) - dayMs(rangeStart)) / total) * 100;
  }

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (allTasks.length === 0) return <EmptyState title="No tasks yet" description="Timeline populates once tasks have start or due dates." />;

  const todayPct = pct(new Date());

  return (
    <div className="space-y-4">
      <section className="card overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Date axis */}
          <div className="relative h-8 border-b border-line">
            {weeks.map((w, i) => (
              <div key={i} className="absolute top-0 h-full border-l border-line/60 text-2xs text-ink-faint pl-1 pt-1" style={{ left: `${pct(w)}%` }}>
                {fmtDate(w, 'dd MMM')}
              </div>
            ))}
            {todayPct >= 0 && todayPct <= 100 && (
              <div className="absolute top-0 h-full border-l-2 border-primary-500 z-10" style={{ left: `${todayPct}%` }}>
                <span className="absolute -top-0.5 -left-4 text-2xs font-semibold text-primary-600 bg-surface-raised px-1">Today</span>
              </div>
            )}
          </div>

          {/* Milestone row */}
          {milestones.length > 0 && (
            <div className="relative h-8 border-b border-line/60">
              {milestones.filter((m) => m.dueDate).map((m) => (
                <div
                  key={m._id}
                  title={`${m.name} — due ${fmtDate(m.dueDate)}`}
                  className="absolute top-1 -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `${pct(new Date(m.dueDate!))}%` }}
                >
                  <Diamond className={cn('h-3.5 w-3.5 fill-current', m.status === 'completed' ? 'text-success-main' : new Date(m.dueDate!) < new Date() ? 'text-error-main' : 'text-info-main')} />
                </div>
              ))}
            </div>
          )}

          {/* Task rows */}
          <div className="divide-y divide-line/40">
            {scheduled.map((t) => {
              const start = t.startDate ? new Date(t.startDate) : t.dueDate ? new Date(t.dueDate) : rangeStart;
              const end = t.dueDate ? new Date(t.dueDate) : t.startDate ? new Date(new Date(t.startDate).getTime() + 86_400_000) : rangeEnd;
              const left = pct(start);
              const width = Math.max(1.5, pct(end) - left);
              const overdue = t.dueDate && new Date(t.dueDate) < new Date() && !['completed', 'cancelled'].includes(t.status);
              return (
                <div key={t._id} className="relative h-9 flex items-center hover:bg-surface-sunken/60 group">
                  <div className="absolute left-1 top-1 bottom-1 z-0 flex items-center text-2xs text-ink-faint font-mono opacity-0 group-hover:opacity-100 pointer-events-none">
                    {t.number}
                  </div>
                  <button
                    onClick={() => navigate(`/tasks/${t._id}`)}
                    title={`${t.number} ${t.title} · ${fmtDate(start)} → ${fmtDate(end)}`}
                    className={cn(
                      'absolute h-5 rounded-md overflow-hidden flex items-center px-1.5 text-2xs text-white font-medium truncate shadow-sm',
                      STATUS_COLOR[t.status] ?? 'bg-neutral-main',
                      overdue && 'ring-2 ring-error-main/60'
                    )}
                    style={{ left: `${left}%`, width: `${width}%`, minWidth: '24px' }}
                  >
                    <span className="truncate">{t.title}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {unscheduled.length > 0 && (
        <section className="card p-4">
          <h2 className="text-xs font-semibold mb-2">{unscheduled.length} task(s) without dates</h2>
          <p className="text-2xs text-ink-faint mb-2">These don't appear on the timeline. Add a start or due date to schedule them.</p>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.slice(0, 20).map((t) => (
              <button key={t._id} onClick={() => navigate(`/tasks/${t._id}`)} className="text-2xs font-mono px-2 py-1 rounded bg-surface-sunken hover:bg-line/60">
                {t.number}
              </button>
            ))}
            {unscheduled.length > 20 && <span className="text-2xs text-ink-faint self-center">+{unscheduled.length - 20} more</span>}
          </div>
        </section>
      )}
    </div>
  );
}
