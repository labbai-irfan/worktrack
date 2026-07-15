import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { get, post, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Avatar, Button, EmptyState, ErrorState, Field, Input, Modal, PageLoader, Pagination, Select, StatusBadge, Textarea } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { fmtRelative, titleCase } from '@/lib/utils';
import { ENVIRONMENTS, ISSUE_TYPES, PRIORITIES, SEVERITIES } from '@/constants';
import type { Issue, Module, Project, User } from '@/types';

const createSchema = z.object({
  projectId: z.string().min(1, 'Select a project.'),
  moduleId: z.string().optional(),
  title: z.string().min(3, 'Title is required.'),
  description: z.string().optional(),
  type: z.enum(ISSUE_TYPES).default('bug'),
  severity: z.enum(SEVERITIES).default('medium'),
  priority: z.enum(PRIORITIES).default('medium'),
  environment: z.enum(ENVIRONMENTS).default('production'),
  assigneeId: z.string().optional(),
  errorMessage: z.string().optional(),
  stackTrace: z.string().optional(),
  apiEndpoint: z.string().optional(),
  steps: z.string().optional(),
  expected: z.string().optional(),
  actual: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

export default function IssuesPage() {
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuthStore();

  useEffect(() => {
    if (params.get('create') === '1') {
      setCreateOpen(true);
      const next = new URLSearchParams(params);
      next.delete('create');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const page = parseInt(params.get('page') ?? '1', 10);
  const filters = {
    projectId: params.get('projectId') ?? '',
    status: params.get('status') ?? '',
    severity: params.get('severity') ?? '',
    type: params.get('type') ?? '',
    open: params.get('open') ?? '',
    assigneeId: params.get('assigneeId') ?? '',
    q: params.get('q') ?? '',
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['issues', 'list', filters, page],
    queryFn: () => get<Issue[]>('/issues', { page, limit: 25, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }),
  });
  const { data: projects } = useQuery({
    queryKey: ['projects', 'options'],
    queryFn: () => get<Project[]>('/projects', { limit: 100, sort: 'name' }),
  });
  const { data: employees } = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => get<User[]>('/employees', { limit: 100 }),
    enabled: can('employee.view'),
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<CreateValues>({ resolver: zodResolver(createSchema) });
  const formProjectId = watch('projectId');
  const { data: formModules } = useQuery({
    queryKey: ['modules', formProjectId],
    queryFn: () => get<Module[]>('/modules', { projectId: formProjectId }),
    enabled: Boolean(formProjectId),
  });

  const createIssue = useMutation({
    mutationFn: (v: CreateValues) =>
      post<Issue>('/issues', {
        projectId: v.projectId,
        moduleId: v.moduleId || null,
        title: v.title,
        description: v.description ?? '',
        type: v.type,
        severity: v.severity,
        priority: v.priority,
        environment: v.environment,
        assigneeId: v.assigneeId || null,
        error: v.errorMessage || v.stackTrace || v.apiEndpoint ? { message: v.errorMessage ?? '', stackTrace: v.stackTrace ?? '', apiEndpoint: v.apiEndpoint ?? '' } : undefined,
        reproduction: v.steps || v.expected || v.actual ? { steps: v.steps ?? '', expected: v.expected ?? '', actual: v.actual ?? '' } : undefined,
      }),
    onSuccess: (res) => {
      toast.success(`Issue ${res.data.number} created.`);
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      setCreateOpen(false);
      reset();
      navigate(`/issues/${res.data._id}`);
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

  const items = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Issues</h1>
        {can('issue.create') && (
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
            Report Issue
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input value={filters.q} onChange={(e) => setParam('q', e.target.value)} placeholder="Search title, number, error…" className="h-8 text-xs max-w-56" aria-label="Search issues" />
        <Select value={filters.projectId} onChange={(e) => setParam('projectId', e.target.value)} className="h-8 text-xs w-44" aria-label="Filter by project">
          <option value="">All projects</option>
          {(projects?.data ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>
        <Select value={filters.open || filters.status} onChange={(e) => {
          if (e.target.value === 'open-only') {
            setParam('status', '');
            setParam('open', 'true');
          } else {
            setParam('open', '');
            setParam('status', e.target.value);
          }
        }} className="h-8 text-xs w-44" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="open-only">Open only</option>
          {['open', 'triaged', 'assigned', 'in_progress', 'blocked', 'fix_implemented', 'testing', 'resolved', 'closed', 'reopened'].map((s) => (
            <option key={s} value={s}>{titleCase(s)}</option>
          ))}
        </Select>
        <Select value={filters.severity} onChange={(e) => setParam('severity', e.target.value)} className="h-8 text-xs w-36" aria-label="Filter by severity">
          <option value="">All severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
        <Select value={filters.assigneeId} onChange={(e) => setParam('assigneeId', e.target.value)} className="h-8 text-xs w-40" aria-label="Filter by assignee">
          <option value="">All assignees</option>
          <option value="me">Assigned to me</option>
          {(employees?.data ?? []).map((u) => <option key={u._id} value={u._id}>{u.displayName}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          kind={Object.values(filters).some(Boolean) ? 'search' : 'empty'}
          title={Object.values(filters).some(Boolean) ? 'No matching issues' : 'No issues reported'}
          description={Object.values(filters).some(Boolean) ? 'Try different filters.' : 'Report bugs and errors so nothing is lost in chat threads.'}
        />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="table-base min-w-[760px]">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Project</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Assignee</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i._id} className="hover:bg-surface-sunken cursor-pointer" onClick={() => navigate(`/issues/${i._id}`)}>
                    <td>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-2xs font-mono text-ink-faint shrink-0">{i.number}</span>
                        <span className="text-xs font-medium truncate max-w-80">{i.title}</span>
                      </div>
                    </td>
                    <td className="text-xs text-ink-muted whitespace-nowrap">{(i.projectId as { name?: string })?.name}</td>
                    <td className="text-2xs text-ink-muted whitespace-nowrap">{titleCase(i.type)}</td>
                    <td><StatusBadge status={i.severity} /></td>
                    <td>
                      {i.assigneeId ? (
                        <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                          <Avatar name={i.assigneeId.displayName} src={i.assigneeId.avatarUrl} size="xs" />
                          {i.assigneeId.displayName}
                        </span>
                      ) : (
                        <span className="text-2xs text-ink-faint">Unassigned</span>
                      )}
                    </td>
                    <td><StatusBadge status={i.status} /></td>
                    <td className="text-2xs text-ink-faint whitespace-nowrap">{fmtRelative(i.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={(p) => setParam('page', String(p))} />
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Report an issue" wide footer={
        <>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button loading={createIssue.isPending} onClick={handleSubmit((v) => createIssue.mutate(v))}>Create issue</Button>
        </>
      }>
        <form className="space-y-4" noValidate>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Project" error={errors.projectId?.message} required htmlFor="iproj">
              <Select id="iproj" {...register('projectId')}>
                <option value="">Select project…</option>
                {(projects?.data ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Module" htmlFor="imod">
              <Select id="imod" {...register('moduleId')} disabled={!formProjectId}>
                <option value="">No module</option>
                {(formModules?.data ?? []).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Title" error={errors.title?.message} required htmlFor="ititle">
            <Input id="ititle" placeholder="e.g. Payroll run fails for mid-month joiners" {...register('title')} />
          </Field>
          <Field label="Description" htmlFor="idesc">
            <Textarea id="idesc" rows={3} {...register('description')} />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Type" htmlFor="itype">
              <Select id="itype" {...register('type')}>
                {ISSUE_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
              </Select>
            </Field>
            <Field label="Severity" htmlFor="isev">
              <Select id="isev" {...register('severity')}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
              </Select>
            </Field>
            <Field label="Priority" htmlFor="iprio">
              <Select id="iprio" {...register('priority')}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
              </Select>
            </Field>
            <Field label="Environment" htmlFor="ienv">
              <Select id="ienv" {...register('environment')}>
                {ENVIRONMENTS.map((e) => <option key={e} value={e}>{titleCase(e)}</option>)}
              </Select>
            </Field>
          </div>
          {can('issue.assign') && (
            <Field label="Assignee" htmlFor="iassign">
              <Select id="iassign" {...register('assigneeId')}>
                <option value="">Unassigned</option>
                {(employees?.data ?? []).map((u) => <option key={u._id} value={u._id}>{u.displayName}</option>)}
              </Select>
            </Field>
          )}
          <details className="card p-3">
            <summary className="text-xs font-medium cursor-pointer">Technical error details (optional)</summary>
            <div className="mt-3 space-y-3">
              <Field label="Error message" htmlFor="ierr">
                <Input id="ierr" placeholder="TypeError: …" {...register('errorMessage')} />
              </Field>
              <Field label="Stack trace / console log" htmlFor="istack">
                <Textarea id="istack" rows={4} className="font-mono text-2xs" {...register('stackTrace')} />
              </Field>
              <Field label="API endpoint" htmlFor="iapi">
                <Input id="iapi" placeholder="/api/v1/…" {...register('apiEndpoint')} />
              </Field>
            </div>
          </details>
          <details className="card p-3">
            <summary className="text-xs font-medium cursor-pointer">Reproduction (optional)</summary>
            <div className="mt-3 space-y-3">
              <Field label="Steps to reproduce" htmlFor="isteps">
                <Textarea id="isteps" rows={3} placeholder={'1. …\n2. …'} {...register('steps')} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Expected behavior" htmlFor="iexp">
                  <Textarea id="iexp" rows={2} {...register('expected')} />
                </Field>
                <Field label="Actual behavior" htmlFor="iact">
                  <Textarea id="iact" rows={2} {...register('actual')} />
                </Field>
              </div>
            </div>
          </details>
        </form>
      </Modal>
    </div>
  );
}
