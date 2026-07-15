import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldOff, ShieldCheck } from 'lucide-react';
import { get, post, patch, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Avatar, Badge, Button, EmptyState, ErrorState, PageLoader, Select, StatusBadge, Tabs } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { fmtDate, fmtMinutes, refId, titleCase } from '@/lib/utils';
import type { Issue, Role, Task, User, WorkUpdate, DailyReport } from '@/types';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'updates', label: 'Work Updates' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'issues', label: 'Issues' },
  { key: 'reports', label: 'Reports' },
];

export default function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, user: me } = useAuthStore();
  const canManage = can('employee.manage');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['employees', id],
    queryFn: () => get<User>(`/employees/${id}`),
  });
  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => get<Role[]>('/organizations/roles'),
    enabled: canManage,
  });
  const { data: updates } = useQuery({
    queryKey: ['work-updates', 'employee', id],
    queryFn: () => get<WorkUpdate[]>('/work-updates', { userId: id, limit: 20 }),
    enabled: tab === 'updates' || tab === 'overview',
  });
  const { data: tasks } = useQuery({
    queryKey: ['tasks', 'employee', id],
    queryFn: () => get<Task[]>('/tasks', { assigneeId: id, limit: 20 }),
    enabled: tab === 'tasks',
  });
  const { data: issues } = useQuery({
    queryKey: ['issues', 'employee', id],
    queryFn: () => get<Issue[]>('/issues', { assigneeId: id, limit: 20 }),
    enabled: tab === 'issues',
  });
  const { data: reports } = useQuery({
    queryKey: ['daily-reports', 'employee', id],
    queryFn: () => get<DailyReport[]>('/reports/daily', { userId: id, limit: 20 }),
    enabled: tab === 'reports' && can('report.review'),
  });

  const setActive = useMutation({
    mutationFn: (activate: boolean) => post(`/employees/${id}/${activate ? 'activate' : 'deactivate'}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee status updated.');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const updateRole = useMutation({
    mutationFn: (roleId: string) => patch(`/employees/${id}`, { roleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Role updated.');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <PageLoader />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;
  const employee = data.data;
  const isSelf = employee._id === me?._id;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/team')} className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Team
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={employee.displayName} src={employee.avatarUrl} size="lg" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold">{employee.displayName}</h1>
              <StatusBadge status={employee.status} />
            </div>
            <p className="text-xs text-ink-muted">
              {employee.jobTitle || 'No title'} · {employee.employeeCode} · {employee.email}
            </p>
          </div>
        </div>
        {canManage && !isSelf && (
          <div className="flex gap-2 items-center">
            <Select
              value={refId(employee.roleId)}
              onChange={(e) => updateRole.mutate(e.target.value)}
              className="h-8 text-xs w-44"
              aria-label="Change role"
            >
              {(roles?.data ?? []).map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
            </Select>
            {employee.status === 'active' ? (
              <Button size="sm" variant="danger" icon={<ShieldOff className="h-3.5 w-3.5" />} loading={setActive.isPending} onClick={() => setActive.mutate(false)}>
                Deactivate
              </Button>
            ) : (
              <Button size="sm" icon={<ShieldCheck className="h-3.5 w-3.5" />} loading={setActive.isPending} onClick={() => setActive.mutate(true)}>
                Activate
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs tabs={TABS} value={tab} onChange={(t) => {
        const next = new URLSearchParams(params);
        next.set('tab', t);
        setParams(next, { replace: true });
      }} />

      {tab === 'overview' && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="card p-4 space-y-2 text-xs">
            <h2 className="text-xs font-semibold mb-1">Profile</h2>
            <div className="flex justify-between"><span className="text-ink-faint">Department</span><span>{(employee.departmentId as { name?: string })?.name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Team</span><span>{(employee.teamId as { name?: string })?.name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Manager</span><span>{(employee.managerId as { displayName?: string })?.displayName ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Joined</span><span>{fmtDate(employee.joiningDate)}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Location</span><span>{employee.workLocation || '—'}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Last login</span><span>{fmtDate(employee.lastLoginAt)}</span></div>
            {employee.skills.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2">
                {employee.skills.map((s) => <Badge key={s}>{s}</Badge>)}
              </div>
            )}
          </div>
          <div className="lg:col-span-2 card">
            <h2 className="text-xs font-semibold px-4 py-3 border-b border-line">Recent work</h2>
            {(updates?.data ?? []).length === 0 ? (
              <EmptyState title="No recent work updates" />
            ) : (
              <div className="divide-y divide-line/60">
                {(updates?.data ?? []).slice(0, 8).map((u) => (
                  <button key={u._id} onClick={() => navigate(`/work-updates/${u._id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-sunken">
                    <span className="text-2xs font-mono text-ink-faint">{u.number}</span>
                    <span className="text-xs font-medium truncate grow">{u.title}</span>
                    <span className="text-2xs text-ink-faint whitespace-nowrap">{fmtDate(u.workDate, 'dd MMM')}</span>
                    <StatusBadge status={u.status} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'updates' && (
        <div className="card divide-y divide-line/60">
          {(updates?.data ?? []).length === 0 && <EmptyState title="No work updates" />}
          {(updates?.data ?? []).map((u) => (
            <button key={u._id} onClick={() => navigate(`/work-updates/${u._id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-sunken">
              <span className="text-2xs font-mono text-ink-faint">{u.number}</span>
              <div className="min-w-0 grow">
                <div className="text-xs font-medium truncate">{u.title}</div>
                <div className="text-2xs text-ink-faint">{(u.projectId as { name?: string })?.name} · {fmtDate(u.workDate)} · {titleCase(u.workType)}</div>
              </div>
              {u.time?.minutesSpent ? <span className="text-2xs text-ink-faint">{fmtMinutes(u.time.minutesSpent)}</span> : null}
              <StatusBadge status={u.status} />
            </button>
          ))}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="card divide-y divide-line/60">
          {(tasks?.data ?? []).length === 0 && <EmptyState title="No assigned tasks" />}
          {(tasks?.data ?? []).map((t) => (
            <button key={t._id} onClick={() => navigate(`/tasks/${t._id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-sunken">
              <span className="text-2xs font-mono text-ink-faint">{t.number}</span>
              <span className="text-xs font-medium truncate grow">{t.title}</span>
              <StatusBadge status={t.priority} />
              <StatusBadge status={t.status} />
            </button>
          ))}
        </div>
      )}

      {tab === 'issues' && (
        <div className="card divide-y divide-line/60">
          {(issues?.data ?? []).length === 0 && <EmptyState title="No assigned issues" />}
          {(issues?.data ?? []).map((i) => (
            <button key={i._id} onClick={() => navigate(`/issues/${i._id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-sunken">
              <span className="text-2xs font-mono text-ink-faint">{i.number}</span>
              <span className="text-xs font-medium truncate grow">{i.title}</span>
              <StatusBadge status={i.severity} />
              <StatusBadge status={i.status} />
            </button>
          ))}
        </div>
      )}

      {tab === 'reports' && (
        can('report.review') ? (
          <div className="card divide-y divide-line/60">
            {(reports?.data ?? []).length === 0 && <EmptyState title="No reports" />}
            {(reports?.data ?? []).map((r) => (
              <div key={r._id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xs font-medium">{fmtDate(r.date + 'T00:00:00')}</span>
                <span className="text-2xs text-ink-faint grow">
                  {Array.isArray(r.workUpdateIds) ? r.workUpdateIds.length : 0} updates · {fmtMinutes(r.totalMinutes)}
                </span>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState kind="denied" title="You don't have permission to view reports" />
        )
      )}
    </div>
  );
}
