import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus, Copy, Trash2, MessageCircle } from 'lucide-react';
import { get, post, del, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Avatar, Badge, Button, EmptyState, ErrorState, Field, Input, Modal, PageLoader, Pagination, Select, StatusBadge, Tabs } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { fmtDate } from '@/lib/utils';
import type { Department, Invitation, Role, Team, User } from '@/types';

const inviteSchema = z.object({
  email: z.string().email('Enter a valid email.'),
  name: z.string().optional(),
  roleId: z.string().min(1, 'Select a role.'),
  departmentId: z.string().optional(),
  teamId: z.string().optional(),
  jobTitle: z.string().optional(),
});
type InviteValues = z.infer<typeof inviteSchema>;

export default function TeamPage() {
  const [params, setParams] = useSearchParams();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuthStore();
  const tab = params.get('tab') ?? 'people';
  const page = parseInt(params.get('page') ?? '1', 10);
  const q = params.get('q') ?? '';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['employees', 'list', page, q],
    queryFn: () => get<User[]>('/employees', { page, limit: 25, ...(q ? { q } : {}) }),
  });
  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => get<Role[]>('/organizations/roles'),
  });
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => get<Department[]>('/teams/departments'),
  });
  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => get<Team[]>('/teams'),
  });
  const { data: invitations } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => get<Invitation[]>('/employees/invitations'),
    enabled: can('employee.invite'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteValues>({ resolver: zodResolver(inviteSchema) });
  const invite = useMutation({
    mutationFn: (v: InviteValues) => post<{ inviteUrl: string }>('/employees/invite', {
      ...v,
      departmentId: v.departmentId || null,
      teamId: v.teamId || null,
    }),
    onSuccess: (res) => {
      toast.success('Invitation created.');
      setInviteUrl(res.data.inviteUrl);
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      reset();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const revokeInvite = useMutation({
    mutationFn: (id: string) => del(`/employees/invitations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  });

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const tabs = [
    { key: 'people', label: 'People', count: data?.meta.total },
    { key: 'teams', label: 'Teams', count: teams?.data.length },
    { key: 'departments', label: 'Departments', count: departments?.data.length },
    ...(can('employee.invite') ? [{ key: 'invitations', label: 'Pending invites', count: invitations?.data.length }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Team</h1>
        {can('employee.invite') && (
          <Button size="sm" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => { setInviteUrl(''); setInviteOpen(true); }}>
            Invite Employee
          </Button>
        )}
      </div>

      <Tabs tabs={tabs} value={tab} onChange={(t) => setParam('tab', t)} />

      {tab === 'people' && (
        <>
          <Input value={q} onChange={(e) => setParam('q', e.target.value)} placeholder="Search name, email, code…" className="h-8 text-xs max-w-60" aria-label="Search employees" />
          {isLoading ? (
            <PageLoader />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (
            <>
              <div className="card overflow-x-auto">
                <table className="table-base min-w-[720px]">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Role</th>
                      <th>Department</th>
                      <th>Team</th>
                      <th>Joined</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.data ?? []).map((u) => (
                      <tr key={u._id} className="hover:bg-surface-sunken cursor-pointer" onClick={() => navigate(`/team/${u._id}`)}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={u.displayName} src={u.avatarUrl} size="md" />
                            <div className="min-w-0">
                              <div className="text-xs font-medium">{u.displayName}</div>
                              <div className="text-2xs text-ink-faint">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td><Badge tone="info">{(u.roleId as { name?: string })?.name ?? '—'}</Badge></td>
                        <td className="text-xs text-ink-muted">{(u.departmentId as { name?: string })?.name ?? '—'}</td>
                        <td className="text-xs text-ink-muted">{(u.teamId as { name?: string })?.name ?? '—'}</td>
                        <td className="text-2xs text-ink-muted whitespace-nowrap">{fmtDate(u.joiningDate)}</td>
                        <td><StatusBadge status={u.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={(p) => setParam('page', String(p))} />
            </>
          )}
        </>
      )}

      {tab === 'teams' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(teams?.data ?? []).length === 0 && <EmptyState title="No teams yet" />}
          {(teams?.data ?? []).map((t) => (
            <div key={t._id} className="card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{t.name}</span>
                <Badge>{(t.departmentId as { name?: string })?.name ?? 'No department'}</Badge>
              </div>
              {t.leadId && (
                <div className="mt-2 flex items-center gap-1.5 text-2xs text-ink-muted">
                  <Avatar name={t.leadId.displayName} src={t.leadId.avatarUrl} size="xs" /> Lead: {t.leadId.displayName}
                </div>
              )}
              <div className="mt-3 flex -space-x-1.5">
                {(t.memberIds ?? []).slice(0, 6).map((m) => (
                  <Avatar key={m._id} name={m.displayName} src={m.avatarUrl} size="sm" className="ring-2 ring-surface-raised" />
                ))}
                {(t.memberIds ?? []).length > 6 && <span className="h-6 w-6 rounded-full bg-surface-sunken text-2xs flex items-center justify-center ring-2 ring-surface-raised">+{t.memberIds.length - 6}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'departments' && (
        <div className="card divide-y divide-line/60">
          {(departments?.data ?? []).length === 0 && <EmptyState title="No departments yet" />}
          {(departments?.data ?? []).map((d) => (
            <div key={d._id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 grow">
                <div className="text-xs font-semibold">{d.name}</div>
                {d.description && <div className="text-2xs text-ink-muted">{d.description}</div>}
              </div>
              {d.headId && (
                <span className="flex items-center gap-1.5 text-2xs text-ink-muted">
                  <Avatar name={d.headId.displayName} src={d.headId.avatarUrl} size="xs" /> {d.headId.displayName}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'invitations' && (
        <div className="card divide-y divide-line/60">
          {(invitations?.data ?? []).length === 0 && <EmptyState title="No pending invitations" />}
          {(invitations?.data ?? []).map((inv) => (
            <div key={inv._id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 grow">
                <div className="text-xs font-medium">{inv.email}</div>
                <div className="text-2xs text-ink-faint">
                  {inv.roleId?.name} · invited by {inv.invitedBy?.displayName} · expires {fmtDate(inv.expiresAt)}
                </div>
              </div>
              <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => revokeInvite.mutate(inv._id)} aria-label={`Revoke invite for ${inv.email}`}>
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite an employee" footer={
        inviteUrl ? (
          <Button onClick={() => setInviteOpen(false)}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button loading={invite.isPending} onClick={handleSubmit((v) => invite.mutate(v))}>Send invitation</Button>
          </>
        )
      }>
        {inviteUrl ? (
          <div className="space-y-3">
            <p className="text-xs text-ink-muted">
              Invitation created. When SMTP is not configured, share this link directly:
            </p>
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} className="text-2xs font-mono" aria-label="Invitation link" />
              <Button
                variant="outline"
                size="md"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl);
                  toast.success('Link copied.');
                }}
              >
                Copy
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              icon={<MessageCircle className="h-3.5 w-3.5" />}
              onClick={() => {
                const text = `You've been invited to join our WorkTrack workspace. Accept your invitation here: ${inviteUrl}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
              }}
            >
              Share on WhatsApp
            </Button>
          </div>
        ) : (
          <form className="space-y-4" noValidate>
            <Field label="Work email" error={errors.email?.message} required htmlFor="invemail">
              <Input id="invemail" type="email" placeholder="teammate@company.com" {...register('email')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name" htmlFor="invname">
                <Input id="invname" {...register('name')} />
              </Field>
              <Field label="Job title" htmlFor="invtitle">
                <Input id="invtitle" {...register('jobTitle')} />
              </Field>
            </div>
            <Field label="Role" error={errors.roleId?.message} required htmlFor="invrole">
              <Select id="invrole" {...register('roleId')}>
                <option value="">Select role…</option>
                {(roles?.data ?? []).map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Department" htmlFor="invdept">
                <Select id="invdept" {...register('departmentId')}>
                  <option value="">None</option>
                  {(departments?.data ?? []).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="Team" htmlFor="invteam">
                <Select id="invteam" {...register('teamId')}>
                  <option value="">None</option>
                  {(teams?.data ?? []).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </Select>
              </Field>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
