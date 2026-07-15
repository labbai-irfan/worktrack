import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Send, Save } from 'lucide-react';
import { get, post, patch, errorMessage } from '@/lib/api';
import { Button, ErrorState, Field, Input, PageLoader, Select, Textarea } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { titleCase, todayStr, refId } from '@/lib/utils';
import { ENVIRONMENTS, WORK_PROGRESS_STATUSES, WORK_TYPES } from '@/constants';
import { AttachmentUploader } from '@/components/attachments';
import type { Attachment, Module, Project, Task, WorkUpdate } from '@/types';

const schema = z.object({
  projectId: z.string().min(1, 'Select a project.'),
  moduleId: z.string().optional(),
  taskId: z.string().optional(),
  title: z.string().min(3, 'Title is required (3+ characters).'),
  description: z.string().optional(),
  workType: z.enum(WORK_TYPES).default('feature'),
  progressStatus: z.enum(WORK_PROGRESS_STATUSES).default('in_progress'),
  progress: z.coerce.number().min(0).max(100).default(0),
  workDate: z.string().min(1, 'Work date is required.'),
  planned: z.string().optional(),
  implemented: z.string().optional(),
  changed: z.string().optional(),
  remaining: z.string().optional(),
  outcome: z.string().optional(),
  blockers: z.string().optional(),
  dependencies: z.string().optional(),
  assistanceRequired: z.string().optional(),
  nextAction: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  breakMinutes: z.coerce.number().min(0).max(1440).optional(),
  minutesSpent: z.coerce.number().min(0).max(1440).optional(),
  billable: z.boolean().default(false),
  environment: z.enum(ENVIRONMENTS).default('development'),
  repository: z.string().optional(),
  branch: z.string().optional(),
  commitHash: z.string().optional(),
  pullRequestUrl: z.string().url('Must be a valid URL.').or(z.literal('')).optional(),
  deploymentUrl: z.string().url('Must be a valid URL.').or(z.literal('')).optional(),
  apiEndpoint: z.string().optional(),
  httpMethod: z.string().optional(),
  httpStatus: z.string().optional(),
  databaseChanges: z.string().optional(),
  technicalNotes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function toPayload(v: FormValues, attachments: Attachment[]) {
  return {
    projectId: v.projectId,
    moduleId: v.moduleId || null,
    taskId: v.taskId || null,
    title: v.title,
    description: v.description ?? '',
    workType: v.workType,
    progressStatus: v.progressStatus,
    progress: v.progress,
    workDate: new Date(v.workDate).toISOString(),
    planned: v.planned ?? '',
    implemented: v.implemented ?? '',
    changed: v.changed ?? '',
    remaining: v.remaining ?? '',
    outcome: v.outcome ?? '',
    blockers: v.blockers ?? '',
    dependencies: v.dependencies ?? '',
    assistanceRequired: v.assistanceRequired ?? '',
    nextAction: v.nextAction ?? '',
    time: {
      startTime: v.startTime ?? '',
      endTime: v.endTime ?? '',
      breakMinutes: v.breakMinutes ?? 0,
      minutesSpent: v.minutesSpent ?? 0,
      billable: v.billable,
      source: 'manual' as const,
    },
    technical: {
      environment: v.environment,
      repository: v.repository ?? '',
      branch: v.branch ?? '',
      commitHash: v.commitHash ?? '',
      pullRequestUrl: v.pullRequestUrl ?? '',
      deploymentUrl: v.deploymentUrl ?? '',
      apiEndpoint: v.apiEndpoint ?? '',
      httpMethod: v.httpMethod ?? '',
      httpStatus: v.httpStatus ?? '',
      databaseChanges: v.databaseChanges ?? '',
      notes: v.technicalNotes ?? '',
    },
    attachmentIds: attachments.map((a) => a._id),
  };
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description && <p className="text-2xs text-ink-faint mt-0.5">{description}</p>}
      <div className="mt-3.5 space-y-3.5">{children}</div>
    </section>
  );
}

export default function WorkUpdateFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [savedId, setSavedId] = useState<string | null>(id ?? null);

  const existing = useQuery({
    queryKey: ['work-updates', id],
    queryFn: () => get<WorkUpdate>(`/work-updates/${id}`),
    enabled: isEdit,
  });

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      projectId: params.get('projectId') ?? '',
      taskId: params.get('taskId') ?? '',
      moduleId: params.get('moduleId') ?? '',
      workDate: todayStr(),
      progress: 0,
      billable: false,
    },
  });

  // Populate form when editing an existing draft.
  useEffect(() => {
    const u = existing.data?.data;
    if (!u) return;
    reset({
      projectId: refId(u.projectId),
      moduleId: refId(u.moduleId),
      taskId: refId(u.taskId),
      title: u.title,
      description: u.description ?? '',
      workType: u.workType as FormValues['workType'],
      progressStatus: u.progressStatus as FormValues['progressStatus'],
      progress: u.progress,
      workDate: u.workDate.slice(0, 10),
      planned: u.planned ?? '', implemented: u.implemented ?? '', changed: u.changed ?? '',
      remaining: u.remaining ?? '', outcome: u.outcome ?? '', blockers: u.blockers ?? '',
      dependencies: u.dependencies ?? '', assistanceRequired: u.assistanceRequired ?? '', nextAction: u.nextAction ?? '',
      startTime: u.time?.startTime ?? '', endTime: u.time?.endTime ?? '',
      breakMinutes: u.time?.breakMinutes ?? 0, minutesSpent: u.time?.minutesSpent ?? 0,
      billable: u.time?.billable ?? false,
      environment: (u.technical?.environment ?? 'development') as FormValues['environment'],
      repository: u.technical?.repository ?? '', branch: u.technical?.branch ?? '',
      commitHash: u.technical?.commitHash ?? '', pullRequestUrl: u.technical?.pullRequestUrl ?? '',
      deploymentUrl: u.technical?.deploymentUrl ?? '', apiEndpoint: u.technical?.apiEndpoint ?? '',
      httpMethod: u.technical?.httpMethod ?? '', httpStatus: u.technical?.httpStatus ?? '',
      databaseChanges: u.technical?.databaseChanges ?? '', technicalNotes: u.technical?.notes ?? '',
    });
    setAttachments(u.attachmentIds ?? []);
  }, [existing.data, reset]);

  const projectId = watch('projectId');
  const { data: projects } = useQuery({
    queryKey: ['projects', 'options'],
    queryFn: () => get<Project[]>('/projects', { limit: 100, sort: 'name' }),
  });
  const { data: modules } = useQuery({
    queryKey: ['modules', projectId],
    queryFn: () => get<Module[]>('/modules', { projectId }),
    enabled: Boolean(projectId),
  });
  const { data: tasks } = useQuery({
    queryKey: ['tasks', 'options', projectId],
    queryFn: () => get<Task[]>('/tasks', { projectId, limit: 100, sort: '-updatedAt' }),
    enabled: Boolean(projectId),
  });

  const saveDraft = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = toPayload(values, attachments);
      if (savedId) return patch<WorkUpdate>(`/work-updates/${savedId}`, payload);
      return post<WorkUpdate>('/work-updates', payload);
    },
    onSuccess: (res) => {
      setSavedId(res.data._id);
      toast.success('Draft saved.');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const submit = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = toPayload(values, attachments);
      const saved = savedId
        ? await patch<WorkUpdate>(`/work-updates/${savedId}`, payload)
        : await post<WorkUpdate>('/work-updates', payload);
      await post(`/work-updates/${saved.data._id}/submit`);
      return saved.data._id;
    },
    onSuccess: (updateId) => {
      toast.success('Update submitted for review.');
      navigate(`/work-updates/${updateId}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const moduleId = watch('moduleId');
  const uploaderContext = useMemo(() => ({ projectId, moduleId: moduleId || undefined }), [projectId, moduleId]);

  if (isEdit && existing.isLoading) return <PageLoader />;
  if (isEdit && existing.isError) return <ErrorState onRetry={() => existing.refetch()} />;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">{isEdit ? `Edit ${existing.data?.data.number ?? 'update'}` : 'Add Work Update'}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={<Save className="h-3.5 w-3.5" />} loading={saveDraft.isPending} onClick={handleSubmit((v) => saveDraft.mutate(v))}>
            Save draft
          </Button>
          <Button size="sm" icon={<Send className="h-3.5 w-3.5" />} loading={submit.isPending} onClick={handleSubmit((v) => submit.mutate(v))}>
            Submit for review
          </Button>
        </div>
      </div>

      <form className="space-y-4" noValidate>
        <Section title="Basics" description="What did you work on, and where does it belong?">
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Project" error={errors.projectId?.message} required htmlFor="wproj">
              <Select id="wproj" {...register('projectId')}>
                <option value="">Select project…</option>
                {(projects?.data ?? []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Module" htmlFor="wmod">
              <Select id="wmod" {...register('moduleId')} disabled={!projectId}>
                <option value="">No module</option>
                {(modules?.data ?? []).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Related task" htmlFor="wtask">
              <Select id="wtask" {...register('taskId')} disabled={!projectId}>
                <option value="">No task</option>
                {(tasks?.data ?? []).map((t) => <option key={t._id} value={t._id}>{t.number} — {t.title.slice(0, 40)}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Update title" error={errors.title?.message} required htmlFor="wtitle">
            <Input id="wtitle" placeholder="e.g. Implemented lead assignment rules with tests" {...register('title')} />
          </Field>
          <Field label="Description" htmlFor="wdesc">
            <Textarea id="wdesc" rows={3} placeholder="Overall summary of the work…" {...register('description')} />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Work type" htmlFor="wtype">
              <Select id="wtype" {...register('workType')}>
                {WORK_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
              </Select>
            </Field>
            <Field label="Progress status" htmlFor="wpstatus">
              <Select id="wpstatus" {...register('progressStatus')}>
                {WORK_PROGRESS_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
              </Select>
            </Field>
            <Field label="Progress %" error={errors.progress?.message} htmlFor="wprogress">
              <Input id="wprogress" type="number" min={0} max={100} {...register('progress')} />
            </Field>
            <Field label="Date of work" error={errors.workDate?.message} required htmlFor="wdate">
              <Input id="wdate" type="date" {...register('workDate')} />
            </Field>
          </div>
        </Section>

        <Section title="Details" description="Structured breakdown reviewers can scan quickly.">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="What was planned?" htmlFor="wplanned">
              <Textarea id="wplanned" rows={2} {...register('planned')} />
            </Field>
            <Field label="What was implemented?" htmlFor="wimpl">
              <Textarea id="wimpl" rows={2} {...register('implemented')} />
            </Field>
            <Field label="What changed?" htmlFor="wchanged">
              <Textarea id="wchanged" rows={2} {...register('changed')} />
            </Field>
            <Field label="What remains?" htmlFor="wremain">
              <Textarea id="wremain" rows={2} {...register('remaining')} />
            </Field>
            <Field label="Result / outcome" htmlFor="woutcome">
              <Textarea id="woutcome" rows={2} {...register('outcome')} />
            </Field>
            <Field label="Next action" htmlFor="wnext">
              <Textarea id="wnext" rows={2} {...register('nextAction')} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Blockers" hint="Anything stopping progress" htmlFor="wblock">
              <Textarea id="wblock" rows={2} {...register('blockers')} />
            </Field>
            <Field label="Dependencies" htmlFor="wdeps">
              <Textarea id="wdeps" rows={2} {...register('dependencies')} />
            </Field>
            <Field label="Assistance required" htmlFor="whelp">
              <Textarea id="whelp" rows={2} {...register('assistanceRequired')} />
            </Field>
          </div>
        </Section>

        <Section title="Time" description="How long did this take?">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
            <Field label="Start time" htmlFor="wstart">
              <Input id="wstart" type="time" {...register('startTime')} />
            </Field>
            <Field label="End time" htmlFor="wend">
              <Input id="wend" type="time" {...register('endTime')} />
            </Field>
            <Field label="Break (min)" htmlFor="wbreak">
              <Input id="wbreak" type="number" min={0} {...register('breakMinutes')} />
            </Field>
            <Field label="Time spent (min)" htmlFor="wspent">
              <Input id="wspent" type="number" min={0} {...register('minutesSpent')} />
            </Field>
            <label className="flex items-center gap-2 text-xs pb-2.5">
              <input type="checkbox" className="rounded border-line" {...register('billable')} /> Billable
            </label>
          </div>
        </Section>

        <Section title="Technical details" description="Optional — Git, deployment and API context.">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Environment" htmlFor="wenv">
              <Select id="wenv" {...register('environment')}>
                {ENVIRONMENTS.map((e) => <option key={e} value={e}>{titleCase(e)}</option>)}
              </Select>
            </Field>
            <Field label="Repository" htmlFor="wrepo">
              <Input id="wrepo" placeholder="org/repo" {...register('repository')} />
            </Field>
            <Field label="Branch" htmlFor="wbranch">
              <Input id="wbranch" placeholder="feat/…" {...register('branch')} />
            </Field>
            <Field label="Commit hash" htmlFor="wcommit">
              <Input id="wcommit" placeholder="a1b2c3d" {...register('commitHash')} />
            </Field>
            <Field label="Pull request URL" error={errors.pullRequestUrl?.message} className="col-span-2" htmlFor="wpr">
              <Input id="wpr" placeholder="https://github.com/…" {...register('pullRequestUrl')} />
            </Field>
            <Field label="Deployment URL" error={errors.deploymentUrl?.message} className="col-span-2" htmlFor="wdeploy">
              <Input id="wdeploy" placeholder="https://staging.…" {...register('deploymentUrl')} />
            </Field>
            <Field label="API endpoint" className="col-span-2" htmlFor="wapi">
              <Input id="wapi" placeholder="/api/v1/…" {...register('apiEndpoint')} />
            </Field>
            <Field label="HTTP method" htmlFor="wmethod">
              <Select id="wmethod" {...register('httpMethod')}>
                <option value="">—</option>
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
            <Field label="HTTP status" htmlFor="wstatus">
              <Input id="wstatus" placeholder="200" {...register('httpStatus')} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Database changes" htmlFor="wdb">
              <Textarea id="wdb" rows={2} placeholder="Schema/migration notes…" {...register('databaseChanges')} />
            </Field>
            <Field label="Technical notes" htmlFor="wnotes">
              <Textarea id="wnotes" rows={2} {...register('technicalNotes')} />
            </Field>
          </div>
        </Section>

        <Section title="Screenshots & attachments" description="Drag & drop, paste from clipboard, or browse. Label images as before/after to build comparisons.">
          {projectId ? (
            <AttachmentUploader attachments={attachments} onChange={setAttachments} projectId={uploaderContext.projectId} moduleId={uploaderContext.moduleId} />
          ) : (
            <p className="text-xs text-ink-faint">Select a project first to enable uploads.</p>
          )}
        </Section>

        <div className="flex justify-end gap-2 pb-8">
          <Button variant="outline" icon={<Save className="h-3.5 w-3.5" />} loading={saveDraft.isPending} onClick={handleSubmit((v) => saveDraft.mutate(v))} type="button">
            Save draft
          </Button>
          <Button icon={<Send className="h-3.5 w-3.5" />} loading={submit.isPending} onClick={handleSubmit((v) => submit.mutate(v))} type="button">
            Submit for review
          </Button>
        </div>
      </form>
    </div>
  );
}
