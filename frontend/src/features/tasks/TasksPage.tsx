import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, LayoutList, Columns3 } from 'lucide-react';
import { get, post, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Avatar, Button, EmptyState, ErrorState, Field, Input, Modal, PageLoader, Pagination, Select, StatusBadge, Textarea } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { cn, fmtDate, refId, titleCase } from '@/lib/utils';
import { PRIORITIES, TASK_STATUSES, TASK_TYPES } from '@/constants';
import KanbanBoard from './KanbanBoard';
import type { Module, Project, Task, User } from '@/types';

const createSchema = z.object({
  projectId: z.string().min(1, 'Select a project.'),
  moduleId: z.string().optional(),
  title: z.string().min(2, 'Title is required.'),
  description: z.string().optional(),
  type: z.enum(TASK_TYPES).default('feature'),
  priority: z.enum(PRIORITIES).default('medium'),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

export default function TasksPage() {
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuthStore();

  const view = params.get('view') ?? 'list';
  const page = parseInt(params.get('page') ?? '1', 10);
  const filters = {
    projectId: params.get('projectId') ?? '',
    moduleId: params.get('moduleId') ?? '',
    status: params.get('status') ?? '',
    priority: params.get('priority') ?? '',
    assigneeId: params.get('assigneeId') ?? (params.get('projectId') ? '' : 'me'),
    overdue: params.get('overdue') ?? '',
    q: params.get('q') ?? '',
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tasks', 'list', filters, page],
    queryFn: () =>
      get<Task[]>('/tasks', {
        page, limit: 25,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      }),
    enabled: view === 'list',
  });

  const { data: projects } = useQuery({
    queryKey: ['projects', 'options'],
    queryFn: () => get<Project[]>('/projects', { limit: 100, sort: 'name' }),
  });
  const { data: modules } = useQuery({
    queryKey: ['modules', filters.projectId],
    queryFn: () => get<Module[]>('/modules', { projectId: filters.projectId }),
    enabled: Boolean(filters.projectId),
  });
  const { data: employees } = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => get<User[]>('/employees', { limit: 100 }),
    enabled: can('employee.view'),
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { projectId: filters.projectId || undefined },
  });
  const formProjectId = watch('projectId');
  const { data: formModules } = useQuery({
    queryKey: ['modules', formProjectId],
    queryFn: () => get<Module[]>('/modules', { projectId: formProjectId }),
    enabled: Boolean(formProjectId),
  });

  const createTask = useMutation({
    mutationFn: (v: CreateValues) =>
      post<Task>('/tasks', {
        ...v,
        moduleId: v.moduleId || null,
        assigneeId: v.assigneeId || null,
        dueDate: v.dueDate || null,
        estimatedHours: v.estimatedHours ? Number(v.estimatedHours) : null,
      }),
    onSuccess: (res) => {
      toast.success(`Task ${res.data.number} created.`);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setCreateOpen(false);
      reset();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const tasks = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Tasks</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-line overflow-hidden" role="group" aria-label="View">
            <button onClick={() => setParam('view', 'list')} className={cn('px-2.5 py-1.5 text-xs flex items-center gap-1', view === 'list' ? 'bg-surface-sunken font-medium' : 'text-ink-muted')} aria-pressed={view === 'list'}>
              <LayoutList className="h-3.5 w-3.5" /> List
            </button>
            <button
              onClick={() => setParam('view', 'board')}
              disabled={!filters.projectId}
              title={filters.projectId ? '' : 'Select a project to open the board'}
              className={cn('px-2.5 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40', view === 'board' ? 'bg-surface-sunken font-medium' : 'text-ink-muted')}
              aria-pressed={view === 'board'}
            >
              <Columns3 className="h-3.5 w-3.5" /> Board
            </button>
          </div>
          {can('task.create') && (
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
              New Task
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input value={filters.q} onChange={(e) => setParam('q', e.target.value)} placeholder="Search title or number…" className="h-8 text-xs max-w-52" aria-label="Search tasks" />
        <Select value={filters.projectId} onChange={(e) => setParam('projectId', e.target.value)} className="h-8 text-xs w-44" aria-label="Filter by project">
          <option value="">All projects</option>
          {(projects?.data ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>
        {filters.projectId && (
          <Select value={filters.moduleId} onChange={(e) => setParam('moduleId', e.target.value)} className="h-8 text-xs w-40" aria-label="Filter by module">
            <option value="">All modules</option>
            {(modules?.data ?? []).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
          </Select>
        )}
        <Select value={filters.status} onChange={(e) => setParam('status', e.target.value)} className="h-8 text-xs w-40" aria-label="Filter by status">
          <option value="">All statuses</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
        <Select value={filters.priority} onChange={(e) => setParam('priority', e.target.value)} className="h-8 text-xs w-36" aria-label="Filter by priority">
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
        </Select>
        {can('employee.view') && (
          <Select value={filters.assigneeId} onChange={(e) => setParam('assigneeId', e.target.value)} className="h-8 text-xs w-44" aria-label="Filter by assignee">
            <option value="me">My tasks</option>
            <option value="">Everyone</option>
            {(employees?.data ?? []).map((u) => <option key={u._id} value={u._id}>{u.displayName}</option>)}
          </Select>
        )}
        {(filters.q || filters.status || filters.priority || filters.projectId || filters.overdue) && (
          <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams({ view }), { replace: true })}>
            Clear all
          </Button>
        )}
      </div>

      {view === 'board' && filters.projectId ? (
        <KanbanBoard projectId={filters.projectId} moduleId={filters.moduleId || undefined} />
      ) : isLoading ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : tasks.length === 0 ? (
        <EmptyState
          kind={filters.q || filters.status ? 'search' : 'empty'}
          title={filters.q || filters.status ? 'No matching tasks' : 'No tasks'}
          description={filters.q || filters.status ? 'Try different filters.' : 'Tasks assigned to you will appear here.'}
        />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="table-base min-w-[720px]">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Project</th>
                  <th>Type</th>
                  <th>Assignee</th>
                  <th>Due</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const overdue = t.dueDate && new Date(t.dueDate) < new Date() && !['completed', 'cancelled'].includes(t.status);
                  return (
                    <tr key={t._id} className="hover:bg-surface-sunken cursor-pointer" onClick={() => navigate(`/tasks/${t._id}`)}>
                      <td>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-2xs font-mono text-ink-faint shrink-0">{t.number}</span>
                          <span className="text-xs font-medium truncate max-w-72">{t.title}</span>
                        </div>
                      </td>
                      <td className="text-xs text-ink-muted whitespace-nowrap">
                        {(t.projectId as { name?: string })?.name}
                        {refId(t.moduleId) && <span className="text-ink-faint"> / {(t.moduleId as { name?: string })?.name}</span>}
                      </td>
                      <td className="text-2xs text-ink-muted whitespace-nowrap">{titleCase(t.type)}</td>
                      <td>
                        {t.assigneeId ? (
                          <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                            <Avatar name={t.assigneeId.displayName} src={t.assigneeId.avatarUrl} size="xs" />
                            {t.assigneeId.displayName}
                          </span>
                        ) : (
                          <span className="text-2xs text-ink-faint">Unassigned</span>
                        )}
                      </td>
                      <td className={cn('text-2xs whitespace-nowrap', overdue ? 'text-error-main font-semibold' : 'text-ink-muted')}>
                        {t.dueDate ? fmtDate(t.dueDate, 'dd MMM') : '—'}
                      </td>
                      <td><StatusBadge status={t.priority} /></td>
                      <td><StatusBadge status={t.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={(p) => setParam('page', String(p))} />
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New task" wide footer={
        <>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button loading={createTask.isPending} onClick={handleSubmit((v) => createTask.mutate(v))}>Create task</Button>
        </>
      }>
        <form className="space-y-4" noValidate>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Project" error={errors.projectId?.message} required htmlFor="tproj">
              <Select id="tproj" {...register('projectId')}>
                <option value="">Select project…</option>
                {(projects?.data ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Module" htmlFor="tmod">
              <Select id="tmod" {...register('moduleId')} disabled={!formProjectId}>
                <option value="">No module</option>
                {(formModules?.data ?? []).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Title" error={errors.title?.message} required htmlFor="ttitle">
            <Input id="ttitle" placeholder="Build the check-in API" {...register('title')} />
          </Field>
          <Field label="Description" htmlFor="tdesc">
            <Textarea id="tdesc" rows={3} {...register('description')} />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Type" htmlFor="ttype">
              <Select id="ttype" {...register('type')}>
                {TASK_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
              </Select>
            </Field>
            <Field label="Priority" htmlFor="tprio">
              <Select id="tprio" {...register('priority')}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
              </Select>
            </Field>
            <Field label="Due date" htmlFor="tdue">
              <Input id="tdue" type="date" {...register('dueDate')} />
            </Field>
            <Field label="Estimate (hours)" htmlFor="test">
              <Input id="test" type="number" min="0" step="0.5" {...register('estimatedHours')} />
            </Field>
          </div>
          {can('task.assign') && (
            <Field label="Assignee" htmlFor="tassign">
              <Select id="tassign" {...register('assigneeId')}>
                <option value="">Unassigned</option>
                {(employees?.data ?? []).map((u) => <option key={u._id} value={u._id}>{u.displayName}</option>)}
              </Select>
            </Field>
          )}
        </form>
      </Modal>
    </div>
  );
}
