import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, GitBranch, Link2, Plus, X, Ban, Network } from 'lucide-react';
import { get, patch, post, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Avatar, Button, ErrorState, Input, PageLoader, Progress, Select, StatusBadge, Badge, Textarea } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { fmtDate, fmtMinutes, titleCase, refId } from '@/lib/utils';
import { TASK_STATUSES, PRIORITIES } from '@/constants';
import CommentsSection from '@/components/CommentsSection';
import type { Task, User } from '@/types';

type TaskRef = { _id: string; number: string; title: string; status: Task['status'] };

export default function TaskDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuthStore();
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [blockPromptOpen, setBlockPromptOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [addDepOpen, setAddDepOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => get<Task>(`/tasks/${id}`),
  });
  const { data: employees } = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => get<User[]>('/employees', { limit: 100 }),
    enabled: can('task.assign'),
  });
  const projectId = refId(data?.data.projectId);
  const { data: projectTasks } = useQuery({
    queryKey: ['tasks', 'dep-options', projectId],
    queryFn: () => get<Task[]>('/tasks', { projectId, limit: 200, includeSubtasks: 'true', sort: '-updatedAt' }),
    enabled: addDepOpen && Boolean(projectId),
  });

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => patch<Task>(`/tasks/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const createSubtask = useMutation({
    mutationFn: (title: string) => post<Task>('/tasks', { projectId, parentTaskId: id, title }),
    onSuccess: (res) => {
      toast.success(`Subtask ${res.data.number} created.`);
      setSubtaskTitle('');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <PageLoader />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;
  const task = data.data;
  const checklistDone = task.checklist.filter((c) => c.done).length;
  const dependencies = (task.dependencyIds ?? []).filter((d): d is TaskRef => typeof d === 'object' && d !== null);
  const dependents = task.dependents ?? [];
  const canUpdate = can('task.update');

  function onStatusChange(status: string) {
    if (status === 'blocked') {
      setBlockReason(task.blockedReason ?? '');
      setBlockPromptOpen(true);
      return;
    }
    setBlockPromptOpen(false);
    update.mutate({ status });
  }

  function removeDependency(depId: string) {
    update.mutate({ dependencyIds: dependencies.filter((d) => d._id !== depId).map((d) => d._id) });
  }

  function addDependency(depId: string) {
    if (!depId) return;
    setAddDepOpen(false);
    update.mutate({ dependencyIds: [...dependencies.map((d) => d._id), depId] });
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xs font-mono text-ink-faint">{task.number} · {(task.projectId as { name?: string })?.name}{refId(task.moduleId) && ` / ${(task.moduleId as { name?: string })?.name}`}</div>
          <h1 className="text-lg font-bold leading-snug mt-0.5">{task.title}</h1>
        </div>
        <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => navigate(`/work-updates/new?projectId=${refId(task.projectId)}&taskId=${task._id}`)}>
          Log work on this task
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {task.description && (
            <section className="card p-4">
              <h2 className="text-xs font-semibold mb-1.5">Description</h2>
              <p className="text-xs text-ink-muted whitespace-pre-wrap">{task.description}</p>
            </section>
          )}
          {task.status === 'blocked' && !blockPromptOpen && (
            <section className="card p-4 border-error-main/40">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-xs font-semibold text-error-main mb-1 flex items-center gap-1.5"><Ban className="h-3.5 w-3.5" /> Blocked</h2>
                  <p className="text-xs text-ink-muted">{task.blockedReason || 'No reason recorded.'}</p>
                </div>
                {canUpdate && (
                  <Button size="sm" variant="ghost" onClick={() => { setBlockReason(task.blockedReason ?? ''); setBlockPromptOpen(true); }}>
                    Edit reason
                  </Button>
                )}
              </div>
            </section>
          )}
          {blockPromptOpen && (
            <section className="card p-4 border-error-main/40 space-y-2">
              <h2 className="text-xs font-semibold text-error-main flex items-center gap-1.5"><Ban className="h-3.5 w-3.5" /> Why is this task blocked?</h2>
              <Textarea
                rows={2}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Waiting on the payment-gateway sandbox credentials…"
                aria-label="Blocked reason"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setBlockPromptOpen(false)}>Cancel</Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={update.isPending}
                  onClick={() => {
                    update.mutate({ status: 'blocked', blockedReason: blockReason });
                    setBlockPromptOpen(false);
                  }}
                >
                  Mark blocked
                </Button>
              </div>
            </section>
          )}

          {(dependencies.length > 0 || dependents.length > 0 || canUpdate) && (
            <section className="card">
              <header className="flex items-center justify-between px-4 py-3 border-b border-line">
                <h2 className="text-xs font-semibold flex items-center gap-1.5"><Network className="h-3.5 w-3.5" /> Dependencies</h2>
                {canUpdate && (
                  <Button size="sm" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddDepOpen((o) => !o)}>
                    Add
                  </Button>
                )}
              </header>
              {addDepOpen && (
                <div className="px-4 py-3 border-b border-line">
                  <Select defaultValue="" onChange={(e) => addDependency(e.target.value)} aria-label="Add dependency">
                    <option value="">Select a task this one depends on…</option>
                    {(projectTasks?.data ?? [])
                      .filter((t) => t._id !== id && !dependencies.some((d) => d._id === t._id))
                      .map((t) => <option key={t._id} value={t._id}>{t.number} — {t.title}</option>)}
                  </Select>
                  <p className="mt-1 text-2xs text-ink-faint">Circular chains are rejected automatically.</p>
                </div>
              )}
              {dependencies.length === 0 && dependents.length === 0 && !addDepOpen && (
                <p className="px-4 py-3 text-xs text-ink-faint">No dependencies. This task can start any time.</p>
              )}
              {dependencies.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1 text-2xs font-semibold uppercase tracking-wide text-ink-faint">Depends on ({dependencies.length})</div>
                  <div className="divide-y divide-line/60">
                    {dependencies.map((d) => (
                      <div key={d._id} className="flex items-center gap-3 px-4 py-2">
                        <button onClick={() => navigate(`/tasks/${d._id}`)} className="flex items-center gap-2 min-w-0 grow text-left hover:underline">
                          <span className="text-2xs font-mono text-ink-faint">{d.number}</span>
                          <span className="text-xs font-medium truncate">{d.title}</span>
                        </button>
                        <StatusBadge status={d.status} />
                        {d.status !== 'completed' && <Badge tone="warning">waiting</Badge>}
                        {canUpdate && (
                          <button onClick={() => removeDependency(d._id)} className="p-1 text-ink-faint hover:text-error-main" aria-label={`Remove dependency ${d.number}`}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {dependents.length > 0 && (
                <div className="pb-1">
                  <div className="px-4 pt-3 pb-1 text-2xs font-semibold uppercase tracking-wide text-ink-faint">Blocks ({dependents.length})</div>
                  <div className="divide-y divide-line/60">
                    {dependents.map((d) => (
                      <button key={d._id} onClick={() => navigate(`/tasks/${d._id}`)} className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-surface-sunken">
                        <span className="text-2xs font-mono text-ink-faint">{d.number}</span>
                        <span className="text-xs font-medium truncate grow">{d.title}</span>
                        <StatusBadge status={d.status} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
          {task.checklist.length > 0 && (
            <section className="card p-4">
              <h2 className="text-xs font-semibold mb-2">Checklist ({checklistDone}/{task.checklist.length})</h2>
              <ul className="space-y-1.5">
                {task.checklist.map((c, i) => (
                  <li key={i}>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={c.done}
                        disabled={!can('task.update')}
                        onChange={() => {
                          const checklist = task.checklist.map((item, j) => (j === i ? { ...item, done: !item.done } : item));
                          update.mutate({ checklist });
                        }}
                        className="rounded border-line"
                      />
                      <span className={c.done ? 'line-through text-ink-faint' : ''}>{c.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {task.acceptanceCriteria && (
            <section className="card p-4">
              <h2 className="text-xs font-semibold mb-1.5">Acceptance criteria</h2>
              <p className="text-xs text-ink-muted whitespace-pre-wrap">{task.acceptanceCriteria}</p>
            </section>
          )}
          {(((task.subtasks ?? []).length > 0) || (can('task.create') && !task.parentTaskId)) && (
            <section className="card">
              <h2 className="text-xs font-semibold px-4 py-3 border-b border-line">
                Subtasks
                {(task.subtasks ?? []).length > 0 && (
                  <span className="ml-2 text-2xs font-normal text-ink-faint tabular-nums">
                    {(task.subtasks ?? []).filter((s) => s.status === 'completed').length}/{(task.subtasks ?? []).length} done
                  </span>
                )}
              </h2>
              <div className="divide-y divide-line/60">
                {(task.subtasks ?? []).map((s) => (
                  <button key={s._id} onClick={() => navigate(`/tasks/${s._id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-sunken">
                    <span className="text-2xs font-mono text-ink-faint">{s.number}</span>
                    <span className={`text-xs font-medium truncate grow ${s.status === 'completed' ? 'line-through text-ink-faint' : ''}`}>{s.title}</span>
                    {s.assigneeId && <Avatar name={s.assigneeId.displayName} src={s.assigneeId.avatarUrl} size="xs" />}
                    <StatusBadge status={s.status} />
                  </button>
                ))}
              </div>
              {can('task.create') && !task.parentTaskId && (
                <form
                  className="flex gap-2 px-4 py-3 border-t border-line"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (subtaskTitle.trim().length >= 2) createSubtask.mutate(subtaskTitle.trim());
                  }}
                >
                  <Input
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    placeholder="Add a subtask…"
                    className="h-8 text-xs"
                    aria-label="New subtask title"
                  />
                  <Button size="sm" type="submit" variant="outline" loading={createSubtask.isPending} disabled={subtaskTitle.trim().length < 2}>
                    Add
                  </Button>
                </form>
              )}
            </section>
          )}
          {(task.git?.branch || task.git?.pullRequestUrl || task.git?.commitHash) && (
            <section className="card p-4 space-y-1.5">
              <h2 className="text-xs font-semibold flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5" /> Git</h2>
              {task.git.repository && <div className="text-xs text-ink-muted">Repo: <span className="font-mono">{task.git.repository}</span></div>}
              {task.git.branch && <div className="text-xs text-ink-muted">Branch: <span className="font-mono">{task.git.branch}</span></div>}
              {task.git.commitHash && <div className="text-xs text-ink-muted">Commit: <span className="font-mono">{task.git.commitHash}</span></div>}
              {task.git.pullRequestUrl && (
                <a href={task.git.pullRequestUrl} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Pull request
                </a>
              )}
            </section>
          )}
          <section className="card p-4">
            <h2 className="text-xs font-semibold mb-3">Discussion</h2>
            <CommentsSection entityType="task" entityId={task._id} />
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-3">
          <div className="card p-4 space-y-3">
            <div>
              <span className="label">Status</span>
              {can('task.update') ? (
                <Select value={task.status} onChange={(e) => onStatusChange(e.target.value)} aria-label="Task status">
                  {TASK_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                </Select>
              ) : (
                <StatusBadge status={task.status} />
              )}
            </div>
            <div>
              <span className="label">Priority</span>
              {can('task.update') ? (
                <Select value={task.priority} onChange={(e) => update.mutate({ priority: e.target.value })} aria-label="Task priority">
                  {PRIORITIES.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
                </Select>
              ) : (
                <StatusBadge status={task.priority} />
              )}
            </div>
            <div>
              <span className="label">Assignee</span>
              {can('task.assign') ? (
                <Select value={task.assigneeId?._id ?? ''} onChange={(e) => update.mutate({ assigneeId: e.target.value || null })} aria-label="Assignee">
                  <option value="">Unassigned</option>
                  {(employees?.data ?? []).map((u) => <option key={u._id} value={u._id}>{u.displayName}</option>)}
                </Select>
              ) : task.assigneeId ? (
                <span className="flex items-center gap-1.5 text-xs">
                  <Avatar name={task.assigneeId.displayName} src={task.assigneeId.avatarUrl} size="xs" /> {task.assigneeId.displayName}
                </span>
              ) : (
                <span className="text-xs text-ink-faint">Unassigned</span>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="label mb-0">Progress</span>
                <span className="text-2xs text-ink-muted tabular-nums">{task.progress}%</span>
              </div>
              <Progress value={task.progress} />
            </div>
          </div>
          <div className="card p-4 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-ink-faint">Type</span><Badge>{titleCase(task.type)}</Badge></div>
            <div className="flex justify-between"><span className="text-ink-faint">Reporter</span><span>{task.reporterId?.displayName ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Start</span><span>{fmtDate(task.startDate)}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Due</span><span>{fmtDate(task.dueDate)}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Estimate</span><span>{task.estimatedHours ? `${task.estimatedHours}h` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Logged</span><span>{fmtMinutes(task.loggedMinutes)}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint">Environment</span><span>{titleCase(task.environment)}</span></div>
            {task.labels.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {task.labels.map((l) => <Badge key={l}>{l}</Badge>)}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
