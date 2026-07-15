import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';
import { get, post } from '@/lib/api';
import { Avatar, Button, EmptyState, ErrorState, PageLoader, Pagination, Tabs } from '@/components/ui';
import { cn, fmtRelative } from '@/lib/utils';
import type { Notification } from '@/types';

export default function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tab = params.get('tab') ?? 'all';
  const page = parseInt(params.get('page') ?? '1', 10);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications', tab, page],
    queryFn: () => get<Notification[]>('/notifications', { page, limit: 30, ...(tab === 'unread' ? { unread: 'true' } : {}) }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAllRead = useMutation({
    mutationFn: () => post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  function open(n: Notification) {
    if (!n.readAt) markRead.mutate(n._id);
    if (n.link) navigate(n.link);
  }

  const unreadCount = data?.meta.unreadCount ?? 0;
  const items = data?.data ?? [];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Notifications</h1>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" icon={<CheckCheck className="h-3.5 w-3.5" />} loading={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
            Mark all as read
          </Button>
        )}
      </div>

      <Tabs
        tabs={[{ key: 'all', label: 'All' }, { key: 'unread', label: 'Unread', count: unreadCount }]}
        value={tab}
        onChange={(t) => {
          const next = new URLSearchParams(params);
          next.set('tab', t);
          next.delete('page');
          setParams(next, { replace: true });
        }}
      />

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={tab === 'unread' ? 'All caught up' : 'No notifications yet'} description="Task assignments, reviews, mentions and more will show up here." />
      ) : (
        <>
          <div className="card divide-y divide-line/60">
            {items.map((n) => (
              <button
                key={n._id}
                onClick={() => open(n)}
                className={cn('w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-sunken', !n.readAt && 'bg-primary-500/5')}
              >
                <Avatar name={n.actorId?.displayName ?? 'WT'} src={n.actorId?.avatarUrl} size="sm" />
                <div className="min-w-0 grow">
                  <div className={cn('text-xs', !n.readAt && 'font-semibold')}>{n.title}</div>
                  {n.body && <div className="text-2xs text-ink-muted mt-0.5 line-clamp-2">{n.body}</div>}
                  <div className="text-2xs text-ink-faint mt-0.5">{fmtRelative(n.createdAt)}</div>
                </div>
                {!n.readAt && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary-500 shrink-0" aria-label="Unread" />}
              </button>
            ))}
          </div>
          <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={(p) => {
            const next = new URLSearchParams(params);
            next.set('page', String(p));
            setParams(next, { replace: true });
          }} />
        </>
      )}
    </div>
  );
}
