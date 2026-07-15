import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  PointerSensor, TouchSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Ban, CheckSquare, UserX } from 'lucide-react';
import { get, patch, errorMessage } from '@/lib/api';
import { Avatar, ErrorState, PageLoader, StatusBadge } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { cn, fmtDate, titleCase } from '@/lib/utils';
import { BOARD_COLUMNS } from '@/constants';
import type { Task } from '@/types';

type Columns = Record<string, Task[]>;

function TaskCard({ task, overlay }: { task: Task; overlay?: boolean }) {
  const navigate = useNavigate();
  const now = new Date();
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const open = !['completed', 'cancelled'].includes(task.status);
  const overdue = due && due < now && open;
  const dueToday = due && !overdue && due.toDateString() === now.toDateString() && open;
  const blocked = task.status === 'blocked';
  const checklistTotal = task.checklist?.length ?? 0;
  const checklistDone = task.checklist?.filter((c) => c.done).length ?? 0;
  return (
    <div
      className={cn(
        'card p-2.5 text-left w-full cursor-grab active:cursor-grabbing',
        overlay && 'shadow-overlay rotate-2',
        blocked && 'border-error-main/50',
        overdue && !blocked && 'border-warning-main/50'
      )}
      onClick={() => !overlay && navigate(`/tasks/${task._id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/tasks/${task._id}`)}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-2xs font-mono text-ink-faint">{task.number}</span>
        <div className="flex items-center gap-1">
          {blocked && (
            <span title={task.blockedReason || 'Blocked'} aria-label="Blocked">
              <Ban className="h-3 w-3 text-error-main" />
            </span>
          )}
          <StatusBadge status={task.priority} />
        </div>
      </div>
      <div className="text-xs font-medium leading-snug line-clamp-2">{task.title}</div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5 text-2xs text-ink-faint">
          <span>{titleCase(task.type)}</span>
          {checklistTotal > 0 && (
            <span className="flex items-center gap-0.5 tabular-nums" title={`Checklist ${checklistDone}/${checklistTotal}`}>
              <CheckSquare className="h-3 w-3" />{checklistDone}/{checklistTotal}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {overdue && <span className="text-2xs text-error-main font-semibold">{fmtDate(task.dueDate, 'dd MMM')}</span>}
          {dueToday && <span className="text-2xs text-warning-main font-semibold">today</span>}
          {!overdue && !dueToday && task.dueDate && <span className="text-2xs text-ink-faint">{fmtDate(task.dueDate, 'dd MMM')}</span>}
          {task.assigneeId ? (
            <Avatar name={task.assigneeId.displayName} src={task.assigneeId.avatarUrl} size="xs" />
          ) : (
            <span title="Unassigned" aria-label="Unassigned">
              <UserX className="h-3 w-3 text-warning-main" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableTaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task._id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-40' : ''}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} />
    </div>
  );
}

function Column({ status, tasks }: { status: string; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  return (
    <div className="w-64 shrink-0 flex flex-col max-h-full">
      <div className="flex items-center gap-2 px-1 pb-2">
        <StatusBadge status={status} />
        <span className="text-2xs text-ink-faint tabular-nums">{tasks.length}</span>
      </div>
      <div ref={setNodeRef} className={cn('grow space-y-2 rounded-lg p-1.5 min-h-32 overflow-y-auto scrollbar-thin', isOver ? 'bg-primary-500/5 ring-1 ring-primary-500/30' : 'bg-surface-sunken/50')}>
        <SortableContext items={tasks.map((t) => t._id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableTaskCard key={t._id} task={t} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default function KanbanBoard({ projectId, moduleId }: { projectId: string; moduleId?: string }) {
  const queryClient = useQueryClient();
  const [columns, setColumns] = useState<Columns>({});
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tasks', 'board', projectId, moduleId],
    queryFn: () => get<Task[]>('/tasks', { projectId, ...(moduleId ? { moduleId } : {}), limit: 200, sort: 'order', includeSubtasks: 'true' }),
  });

  useEffect(() => {
    if (!data) return;
    const next: Columns = Object.fromEntries(BOARD_COLUMNS.map((c) => [c, []]));
    for (const task of data.data) {
      const col = BOARD_COLUMNS.includes(task.status as (typeof BOARD_COLUMNS)[number]) ? task.status : 'todo';
      next[col].push(task);
    }
    setColumns(next);
  }, [data]);

  const persist = useMutation({
    mutationFn: (items: { id: string; status: string; order: number }[]) => patch('/tasks/reorder', { items }),
    onError: (err) => {
      toast.error(errorMessage(err));
      queryClient.invalidateQueries({ queryKey: ['tasks', 'board', projectId] });
    },
  });

  const findColumn = useMemo(
    () => (taskId: string) => Object.keys(columns).find((c) => columns[c].some((t) => t._id === taskId)),
    [columns]
  );

  function onDragStart(e: DragStartEvent) {
    const col = findColumn(String(e.active.id));
    setActiveTask(col ? columns[col].find((t) => t._id === e.active.id) ?? null : null);
  }

  function onDragOver(e: DragOverEvent) {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const fromCol = findColumn(activeId);
    const toCol = overId.startsWith('col:') ? overId.slice(4) : findColumn(overId);
    if (!fromCol || !toCol || fromCol === toCol) return;
    setColumns((cols) => {
      const task = cols[fromCol].find((t) => t._id === activeId);
      if (!task) return cols;
      return {
        ...cols,
        [fromCol]: cols[fromCol].filter((t) => t._id !== activeId),
        [toCol]: [{ ...task, status: toCol as Task['status'] }, ...cols[toCol]],
      };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    const col = findColumn(activeId);
    if (!col) return;
    if (overId && !overId.startsWith('col:') && overId !== activeId) {
      // Reorder within the column.
      setColumns((cols) => {
        const list = [...cols[col]];
        const from = list.findIndex((t) => t._id === activeId);
        const to = list.findIndex((t) => t._id === overId);
        if (from < 0 || to < 0) return cols;
        const [moved] = list.splice(from, 1);
        list.splice(to, 0, moved);
        const next = { ...cols, [col]: list };
        queuePersist(next);
        return next;
      });
    } else {
      setColumns((cols) => {
        queuePersist(cols);
        return cols;
      });
    }
  }

  function queuePersist(cols: Columns) {
    const items = Object.entries(cols).flatMap(([status, tasks]) =>
      tasks.map((t, order) => ({ id: t._id, status, order }))
    );
    if (items.length) persist.mutate(items);
  }

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin items-start" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        {BOARD_COLUMNS.map((c) => (
          <Column key={c} status={c} tasks={columns[c] ?? []} />
        ))}
      </div>
      <DragOverlay>{activeTask && <div className="w-64"><TaskCard task={activeTask} overlay /></div>}</DragOverlay>
    </DndContext>
  );
}
