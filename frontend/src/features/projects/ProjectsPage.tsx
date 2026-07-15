import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search } from 'lucide-react';
import { get, post, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Avatar, Button, EmptyState, ErrorState, Field, Input, Modal, PageLoader, Pagination, Progress, Select, StatusBadge, Textarea, Badge } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { fmtDate } from '@/lib/utils';
import type { Project } from '@/types';

const createSchema = z.object({
  name: z.string().min(2, 'Project name is required.'),
  key: z.string().min(2, '2-10 characters.').max(10).regex(/^[a-zA-Z][a-zA-Z0-9]*$/, 'Letters/numbers, starting with a letter.'),
  description: z.string().optional(),
  client: z.string().optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).default('medium'),
  status: z.enum(['draft', 'planned', 'active']).default('active'),
});
type CreateValues = z.infer<typeof createSchema>;

export default function ProjectsPage() {
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuthStore();
  const page = parseInt(params.get('page') ?? '1', 10);
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['projects', { page, q, status }],
    queryFn: () => get<Project[]>('/projects', { page, limit: 24, ...(q ? { q } : {}), ...(status ? { status } : {}) }),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateValues>({ resolver: zodResolver(createSchema) });

  const createProject = useMutation({
    mutationFn: (values: CreateValues) => post<Project>('/projects', {
      ...values,
      startDate: values.startDate || null,
      targetDate: values.targetDate || null,
    }),
    onSuccess: (res) => {
      toast.success('Project created.');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCreateOpen(false);
      reset();
      navigate(`/projects/${res.data._id}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Projects</h1>
        {can('project.create') && (
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
            New Project
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative grow max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint" />
          <Input value={q} onChange={(e) => setParam('q', e.target.value)} placeholder="Search projects…" className="pl-8 h-8 text-xs" aria-label="Search projects" />
        </div>
        <Select value={status} onChange={(e) => setParam('status', e.target.value)} className="h-8 text-xs w-40" aria-label="Filter by status">
          <option value="">All statuses</option>
          {['active', 'planned', 'on_hold', 'at_risk', 'completed', 'archived'].map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (data?.data ?? []).length === 0 ? (
        q || status ? (
          <EmptyState kind="search" title="No matching projects" description="Try adjusting the search or filters." />
        ) : (
          <EmptyState
            title="No projects yet"
            description="Create your first project to start tracking work."
            action={can('project.create') && <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>New Project</Button>}
          />
        )
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data?.data ?? []).map((p) => (
              <button key={p._id} onClick={() => navigate(`/projects/${p._id}`)} className="card p-4 text-left hover:border-ink-faint transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="h-8 w-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: p.color }}>
                      {p.key.slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{p.name}</div>
                      <div className="text-2xs text-ink-faint">{p.key}{p.client && ` · ${p.client}`}</div>
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Progress value={p.progress} className="grow" />
                  <span className="text-2xs text-ink-muted tabular-nums">{p.progress}%</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex -space-x-1.5">
                    {p.members.slice(0, 4).map((m, i) => {
                      const u = m.userId as { _id?: string; displayName?: string; avatarUrl?: string };
                      return <Avatar key={u._id ?? i} name={u.displayName} src={u.avatarUrl} size="sm" className="ring-2 ring-surface-raised" />;
                    })}
                    {p.members.length > 4 && <span className="h-6 w-6 rounded-full bg-surface-sunken text-2xs flex items-center justify-center ring-2 ring-surface-raised text-ink-muted">+{p.members.length - 4}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-2xs text-ink-faint">
                    {p.targetDate && <span>Due {fmtDate(p.targetDate, 'dd MMM')}</span>}
                    <Badge tone={p.health === 'healthy' ? 'success' : p.health === 'attention' ? 'warning' : 'danger'}>{p.health.replace('_', ' ')}</Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={(p) => setParam('page', String(p))} />
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New project" footer={
        <>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button loading={createProject.isPending} onClick={handleSubmit((v) => createProject.mutate(v))}>Create project</Button>
        </>
      }>
        <form className="space-y-4" onSubmit={handleSubmit((v) => createProject.mutate(v))} noValidate>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Project name" error={errors.name?.message} required className="col-span-2" htmlFor="pname">
              <Input id="pname" placeholder="Customer Portal" {...register('name')} />
            </Field>
            <Field label="Key" error={errors.key?.message} required hint="e.g. CP" htmlFor="pkey">
              <Input id="pkey" placeholder="CP" className="uppercase" maxLength={10} {...register('key')} />
            </Field>
          </div>
          <Field label="Description" htmlFor="pdesc">
            <Textarea id="pdesc" rows={3} placeholder="What is this project about?" {...register('description')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client" htmlFor="pclient">
              <Input id="pclient" {...register('client')} />
            </Field>
            <Field label="Priority" htmlFor="pprio">
              <Select id="pprio" {...register('priority')}>
                {['urgent', 'high', 'medium', 'low', 'none'].map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Start date" htmlFor="pstart">
              <Input id="pstart" type="date" {...register('startDate')} />
            </Field>
            <Field label="Target date" htmlFor="ptarget">
              <Input id="ptarget" type="date" {...register('targetDate')} />
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}
