import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { get } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useChartTheme } from '@/hooks/useChartTheme';
import { EmptyState, ErrorState, PageLoader, Select, Avatar, Badge } from '@/components/ui';
import { fmtMinutes, titleCase } from '@/lib/utils';
import type { Project } from '@/types';

interface TrendPoint { _id: string; count: number }
interface Trends { updates: TrendPoint[]; completedTasks: TrendPoint[]; issuesCreated: TrendPoint[]; issuesResolved: TrendPoint[] }
interface Distribution {
  byType: { _id: string; count: number; minutes: number }[];
  byProject: { _id: string; count: number; minutes: number; name: string; color: string }[];
  byModule: { _id: string; count: number; minutes: number; name: string; color: string }[];
}
interface WorkloadRow {
  _id: string; total: number; inProgress: number; blocked: number; overdue: number;
  displayName: string; avatarUrl?: string; jobTitle?: string;
  estimatedHours: number; capacityHours: number; estimateCoverage: number; hasReliableEstimate: boolean;
  utilization: number | null; capacityState: 'available' | 'balanced' | 'near_capacity' | 'over_capacity' | 'unknown';
}

const CAPACITY_META: Record<WorkloadRow['capacityState'], { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  available: { label: 'Available', tone: 'success' },
  balanced: { label: 'Balanced', tone: 'success' },
  near_capacity: { label: 'Near capacity', tone: 'warning' },
  over_capacity: { label: 'Over capacity', tone: 'danger' },
  unknown: { label: 'No estimates', tone: 'neutral' },
};

const RANGES = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
];

export default function AnalyticsPage() {
  const { can } = useAuthStore();
  const ct = useChartTheme();
  const [days, setDays] = useState('30');
  const [projectId, setProjectId] = useState('');
  const from = useMemo(() => new Date(Date.now() - parseInt(days, 10) * 86_400_000).toISOString(), [days]);
  const isTeamScope = can('analytics.team', 'analytics.organization');

  const { data: projects } = useQuery({
    queryKey: ['projects', 'options'],
    queryFn: () => get<Project[]>('/projects', { limit: 100, sort: 'name' }),
  });
  const trends = useQuery({
    queryKey: ['analytics', 'trends', from, projectId],
    queryFn: () => get<Trends>('/analytics/trends', { from, ...(projectId ? { projectId } : {}) }),
  });
  const distribution = useQuery({
    queryKey: ['analytics', 'distribution', from, projectId],
    queryFn: () => get<Distribution>('/analytics/work-distribution', { from, ...(projectId ? { projectId } : {}) }),
  });
  const workload = useQuery({
    queryKey: ['analytics', 'workload'],
    queryFn: () => get<WorkloadRow[]>('/analytics/workload'),
    enabled: isTeamScope,
  });

  if (trends.isLoading || distribution.isLoading) return <PageLoader />;
  if (trends.isError) return <ErrorState onRetry={() => trends.refetch()} />;

  const t = trends.data?.data;
  const d = distribution.data?.data;

  const dates = [...new Set([...(t?.updates ?? []), ...(t?.completedTasks ?? []), ...(t?.issuesCreated ?? []), ...(t?.issuesResolved ?? [])].map((p) => p._id))].sort();
  const series = (points: TrendPoint[] = []) => dates.map((day) => points.find((p) => p._id === day)?.count ?? 0);

  // ECharts renders to canvas, so it can't resolve CSS variables — ct holds the
  // live-resolved theme colors and updates when the user toggles light/dark.
  const axisStyle = { axisLabel: { color: ct.textMuted, fontSize: 10 }, axisLine: { lineStyle: { color: ct.border } } };
  const tooltip = { backgroundColor: ct.tooltipBg, borderColor: ct.tooltipBorder, borderWidth: 1, textStyle: { color: ct.primary, fontSize: 11 } };
  const trendOption = {
    tooltip: { trigger: 'axis', ...tooltip },
    legend: { textStyle: { color: ct.textMuted, fontSize: 10 } },
    grid: { left: 32, right: 12, top: 32, bottom: 24 },
    xAxis: { type: 'category', data: dates.map((day) => day.slice(5)), ...axisStyle },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: ct.splitLine } }, ...axisStyle },
    series: [
      { name: 'Work updates', type: 'line', smooth: true, data: series(t?.updates), color: '#6366f1' },
      { name: 'Tasks completed', type: 'line', smooth: true, data: series(t?.completedTasks), color: '#10b981' },
      { name: 'Issues created', type: 'line', smooth: true, data: series(t?.issuesCreated), color: '#f59e0b' },
      { name: 'Issues resolved', type: 'line', smooth: true, data: series(t?.issuesResolved), color: '#0891b2' },
    ],
  };

  const typeOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} updates ({d}%)', ...tooltip },
    series: [{
      type: 'pie',
      radius: ['45%', '72%'],
      itemStyle: { borderRadius: 4, borderColor: 'transparent', borderWidth: 2 },
      label: { color: ct.textMuted, fontSize: 10, formatter: '{b}' },
      data: (d?.byType ?? []).map((row) => ({ name: titleCase(row._id), value: row.count })),
    }],
  };

  const projectOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...tooltip },
    grid: { left: 100, right: 24, top: 8, bottom: 24 },
    xAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: ct.splitLine } }, ...axisStyle },
    yAxis: { type: 'category', data: (d?.byProject ?? []).map((p) => p.name).reverse(), ...axisStyle },
    series: [{
      type: 'bar',
      barMaxWidth: 18,
      data: (d?.byProject ?? []).map((p) => ({ value: p.count, itemStyle: { color: p.color || '#6366f1', borderRadius: [0, 3, 3, 0] } })).reverse(),
    }],
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Analytics</h1>
        <div className="flex gap-2">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-8 text-xs w-44" aria-label="Project filter">
            <option value="">All projects</option>
            {(projects?.data ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </Select>
          <Select value={days} onChange={(e) => setDays(e.target.value)} className="h-8 text-xs w-36" aria-label="Date range">
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </Select>
        </div>
      </div>

      {dates.length === 0 && (d?.byType ?? []).length === 0 ? (
        <EmptyState title="No activity in this period" description="Analytics populate as work updates, tasks, and issues are logged." />
      ) : (
        <>
          <section className="card p-4">
            <h2 className="text-xs font-semibold mb-2">Activity trends</h2>
            <ReactECharts option={trendOption} style={{ height: 280 }} notMerge />
          </section>

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="card p-4">
              <h2 className="text-xs font-semibold mb-2">Work by category</h2>
              {(d?.byType ?? []).length === 0 ? (
                <EmptyState title="No data" />
              ) : (
                <ReactECharts option={typeOption} style={{ height: 260 }} notMerge />
              )}
              {/* Accessible table alternative */}
              <details className="mt-2">
                <summary className="text-2xs text-ink-faint cursor-pointer">View as table</summary>
                <table className="table-base mt-2">
                  <thead><tr><th>Category</th><th>Updates</th><th>Time</th></tr></thead>
                  <tbody>
                    {(d?.byType ?? []).map((row) => (
                      <tr key={row._id}>
                        <td className="text-xs">{titleCase(row._id)}</td>
                        <td className="text-xs tabular-nums">{row.count}</td>
                        <td className="text-xs">{fmtMinutes(row.minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </section>

            <section className="card p-4">
              <h2 className="text-xs font-semibold mb-2">Work by project</h2>
              {(d?.byProject ?? []).length === 0 ? (
                <EmptyState title="No data" />
              ) : (
                <ReactECharts option={projectOption} style={{ height: 260 }} notMerge />
              )}
            </section>
          </div>

          {isTeamScope && (
            <section className="card">
              <header className="px-4 py-3 border-b border-line">
                <h2 className="text-xs font-semibold">Current workload by employee</h2>
                <p className="text-2xs text-ink-faint mt-0.5">
                  Capacity is estimate-based (assumes a 40h week) and only shown once at least 60% of an employee's open tasks carry an hour estimate — otherwise open-task counts are shown for context instead of a fabricated percentage.
                </p>
              </header>
              {(workload.data?.data ?? []).length === 0 ? (
                <EmptyState title="No open assigned tasks" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-base min-w-[680px]">
                    <thead>
                      <tr><th>Employee</th><th>Open tasks</th><th>Blocked</th><th>Overdue</th><th>Capacity</th></tr>
                    </thead>
                    <tbody>
                      {(workload.data?.data ?? []).map((row) => {
                        const meta = CAPACITY_META[row.capacityState];
                        return (
                          <tr key={row._id}>
                            <td>
                              <span className="flex items-center gap-2 text-xs">
                                <Avatar name={row.displayName} src={row.avatarUrl} size="sm" />
                                <span>
                                  <span className="font-medium">{row.displayName}</span>
                                  <span className="text-2xs text-ink-faint ml-1.5">{row.jobTitle}</span>
                                </span>
                              </span>
                            </td>
                            <td className="text-xs tabular-nums">{row.total}</td>
                            <td className={`text-xs tabular-nums ${row.blocked > 0 ? 'text-error-main font-semibold' : ''}`}>{row.blocked}</td>
                            <td className={`text-xs tabular-nums ${row.overdue > 0 ? 'text-warning-main font-semibold' : ''}`}>{row.overdue}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <Badge tone={meta.tone}>{meta.label}</Badge>
                                {row.hasReliableEstimate ? (
                                  <span className="text-2xs text-ink-faint tabular-nums">{row.estimatedHours}h / {row.capacityHours}h</span>
                                ) : (
                                  <span className="text-2xs text-ink-faint">{Math.round(row.estimateCoverage * 100)}% estimated</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
