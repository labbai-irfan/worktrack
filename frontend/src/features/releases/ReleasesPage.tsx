import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Rocket, GitBranch } from 'lucide-react';
import { get, post, patch, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Badge, Button, EmptyState, ErrorState, Field, Input, Modal, PageLoader, Select, StatusBadge, Textarea } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { fmtDate, titleCase } from '@/lib/utils';
import { ENVIRONMENTS } from '@/constants';
import type { Project, Release } from '@/types';

const RELEASE_STATUSES = ['draft', 'planned', 'building', 'testing', 'ready', 'deploying', 'deployed', 'failed', 'rolled_back', 'cancelled'];

const createSchema = z.object({
  projectId: z.string().min(1, 'Select a project.'),
  version: z.string().min(1, 'Version is required.'),
  name: z.string().optional(),
  environment: z.enum(ENVIRONMENTS).default('production'),
  releaseDate: z.string().optional(),
  features: z.string().optional(),
  bugFixes: z.string().optional(),
  breakingChanges: z.string().optional(),
  rollbackPlan: z.string().optional(),
  branch: z.string().optional(),
  commitHash: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

export default function ReleasesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Release | null>(null);
  const queryClient = useQueryClient();
  const { can } = useAuthStore();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['releases'],
    queryFn: () => get<Release[]>('/releases'),
  });
  const { data: projects } = useQuery({
    queryKey: ['projects', 'options'],
    queryFn: () => get<Project[]>('/projects', { limit: 100, sort: 'name' }),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateValues>({ resolver: zodResolver(createSchema) });
  const createRelease = useMutation({
    mutationFn: (v: CreateValues) => post<Release>('/releases', {
      projectId: v.projectId,
      version: v.version,
      name: v.name ?? '',
      environment: v.environment,
      releaseDate: v.releaseDate || null,
      notes: { features: v.features ?? '', bugFixes: v.bugFixes ?? '', breakingChanges: v.breakingChanges ?? '', rollbackPlan: v.rollbackPlan ?? '' },
      git: { branch: v.branch ?? '', commitHash: v.commitHash ?? '' },
    }),
    onSuccess: () => {
      toast.success('Release created.');
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      setCreateOpen(false);
      reset();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => patch<Release>(`/releases/${id}`, { status }),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      setSelected(res.data);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Releases</h1>
        {can('release.create') && (
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
            New Release
          </Button>
        )}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="No releases yet" description="Track versions, deployments and release notes per project." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base min-w-[680px]">
            <thead>
              <tr>
                <th>Version</th>
                <th>Project</th>
                <th>Environment</th>
                <th>Release date</th>
                <th>Deployed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r._id} className="hover:bg-surface-sunken cursor-pointer" onClick={() => setSelected(r)}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Rocket className="h-3.5 w-3.5 text-ink-faint" />
                      <span className="text-xs font-mono font-semibold">{r.version}</span>
                      {r.name && <span className="text-xs text-ink-muted truncate max-w-44">{r.name}</span>}
                    </div>
                  </td>
                  <td className="text-xs text-ink-muted">{(r.projectId as { name?: string })?.name}</td>
                  <td><Badge tone={r.environment === 'production' ? 'danger' : 'info'}>{titleCase(r.environment)}</Badge></td>
                  <td className="text-2xs text-ink-muted whitespace-nowrap">{fmtDate(r.releaseDate)}</td>
                  <td className="text-2xs text-ink-muted whitespace-nowrap">{fmtDate(r.deployedAt)}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Release detail modal */}
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `${selected.version}${selected.name ? ` — ${selected.name}` : ''}` : ''} wide>
        {selected && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={selected.status} />
              <Badge tone={selected.environment === 'production' ? 'danger' : 'info'}>{titleCase(selected.environment)}</Badge>
              <span className="text-ink-faint">{(selected.projectId as { name?: string })?.name}</span>
              {selected.deployedAt && <span className="text-ink-faint">deployed {fmtDate(selected.deployedAt)}</span>}
            </div>
            {can('release.deploy') && (
              <div className="flex items-center gap-2">
                <span className="label mb-0">Move to</span>
                <Select
                  value={selected.status}
                  onChange={(e) => updateStatus.mutate({ id: selected._id, status: e.target.value })}
                  className="h-8 w-40 text-xs"
                  aria-label="Release status"
                >
                  {RELEASE_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                </Select>
              </div>
            )}
            {(selected.git?.branch || selected.git?.commitHash) && (
              <div className="card p-3 flex items-center gap-3 flex-wrap">
                <GitBranch className="h-3.5 w-3.5 text-ink-faint" />
                {selected.git.branch && <span className="font-mono">{selected.git.branch}</span>}
                {selected.git.commitHash && <span className="font-mono text-ink-faint">{selected.git.commitHash}</span>}
              </div>
            )}
            {(['features', 'improvements', 'bugFixes', 'breakingChanges', 'migrationNotes', 'rollbackPlan'] as const)
              .filter((k) => selected.notes?.[k])
              .map((k) => (
                <div key={k}>
                  <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-faint mb-1">{titleCase(k.replace(/([A-Z])/g, '_$1'))}</h3>
                  <p className="text-xs text-ink-muted whitespace-pre-wrap">{selected.notes![k]}</p>
                </div>
              ))}
          </div>
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New release" wide footer={
        <>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button loading={createRelease.isPending} onClick={handleSubmit((v) => createRelease.mutate(v))}>Create release</Button>
        </>
      }>
        <form className="space-y-4" noValidate>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Project" error={errors.projectId?.message} required htmlFor="rproj">
              <Select id="rproj" {...register('projectId')}>
                <option value="">Select project…</option>
                {(projects?.data ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Version" error={errors.version?.message} required htmlFor="rver">
              <Input id="rver" placeholder="v2.5.0" {...register('version')} />
            </Field>
            <Field label="Environment" htmlFor="renv">
              <Select id="renv" {...register('environment')}>
                {ENVIRONMENTS.map((e) => <option key={e} value={e}>{titleCase(e)}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Release name" htmlFor="rname">
              <Input id="rname" placeholder="Attendance & Holidays" {...register('name')} />
            </Field>
            <Field label="Planned release date" htmlFor="rdate">
              <Input id="rdate" type="date" {...register('releaseDate')} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Features" htmlFor="rfeat">
              <Textarea id="rfeat" rows={2} {...register('features')} />
            </Field>
            <Field label="Bug fixes" htmlFor="rbugs">
              <Textarea id="rbugs" rows={2} {...register('bugFixes')} />
            </Field>
            <Field label="Breaking changes" htmlFor="rbreak">
              <Textarea id="rbreak" rows={2} {...register('breakingChanges')} />
            </Field>
            <Field label="Rollback plan" htmlFor="rroll">
              <Textarea id="rroll" rows={2} {...register('rollbackPlan')} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Branch" htmlFor="rbranch">
              <Input id="rbranch" placeholder="release/2.5.0" {...register('branch')} />
            </Field>
            <Field label="Commit hash" htmlFor="rcommit">
              <Input id="rcommit" placeholder="a1b2c3d" {...register('commitHash')} />
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}
