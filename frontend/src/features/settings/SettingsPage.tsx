import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Monitor, Moon, Sun, Trash2, ShieldCheck } from 'lucide-react';
import { get, patch, post, del, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Badge, Button, EmptyState, Field, Input, PageLoader, Select, Tabs } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { useTheme, Theme } from '@/hooks/useTheme';
import { fmtDateTime, titleCase } from '@/lib/utils';
import type { Organization, Role, User } from '@/types';

interface Session {
  _id: string;
  userAgent: string;
  ip: string;
  createdAt: string;
  lastUsedAt: string;
  revokedAt?: string | null;
  expiresAt: string;
}

const profileSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().optional(),
  displayName: z.string().min(1, 'Required'),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  workLocation: z.string().optional(),
});
type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z
      .string()
      .min(10, 'At least 10 characters.')
      .regex(/[a-z]/, 'Include a lowercase letter.')
      .regex(/[A-Z]/, 'Include an uppercase letter.')
      .regex(/[0-9]/, 'Include a number.'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' });
type PasswordValues = z.infer<typeof passwordSchema>;

const orgSchema = z.object({
  name: z.string().min(2, 'Required'),
  timezone: z.string().optional(),
  industry: z.string().optional(),
});
type OrgValues = z.infer<typeof orgSchema>;

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const { can } = useAuthStore();
  const tab = params.get('tab') ?? 'profile';

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'security', label: 'Security' },
    { key: 'appearance', label: 'Appearance' },
    ...(can('organization.manage') ? [{ key: 'organization', label: 'Organization' }, { key: 'roles', label: 'Roles & permissions' }] : []),
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-lg font-bold">Settings</h1>
      <Tabs tabs={tabs} value={tab} onChange={(t) => {
        const next = new URLSearchParams(params);
        next.set('tab', t);
        setParams(next, { replace: true });
      }} />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'appearance' && <AppearanceTab />}
      {tab === 'organization' && can('organization.manage') && <OrganizationTab />}
      {tab === 'roles' && can('organization.manage') && <RolesTab />}
    </div>
  );
}

function ProfileTab() {
  const { user, setUser } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      displayName: user?.displayName ?? '',
      jobTitle: user?.jobTitle ?? '',
      phone: user?.phone ?? '',
      timezone: user?.timezone ?? '',
      workLocation: user?.workLocation ?? '',
    },
  });

  async function onSubmit(values: ProfileValues) {
    try {
      const res = await patch<User>('/auth/me', values);
      setUser(res.data);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card p-4 sm:p-5 space-y-4" noValidate>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="First name" error={errors.firstName?.message} required htmlFor="sfirst">
          <Input id="sfirst" {...register('firstName')} />
        </Field>
        <Field label="Last name" htmlFor="slast">
          <Input id="slast" {...register('lastName')} />
        </Field>
        <Field label="Display name" error={errors.displayName?.message} required htmlFor="sdisplay">
          <Input id="sdisplay" {...register('displayName')} />
        </Field>
        <Field label="Job title" htmlFor="sjob">
          <Input id="sjob" {...register('jobTitle')} />
        </Field>
        <Field label="Phone" htmlFor="sphone">
          <Input id="sphone" {...register('phone')} />
        </Field>
        <Field label="Time zone" htmlFor="stz">
          <Input id="stz" placeholder="Asia/Kolkata" {...register('timezone')} />
        </Field>
        <Field label="Work location" htmlFor="sloc">
          <Input id="sloc" {...register('workLocation')} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>Save changes</Button>
      </div>
    </form>
  );
}

function SecurityTab() {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => get<Session[]>('/auth/sessions'),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => del(`/auth/sessions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  async function changePassword(values: PasswordValues) {
    try {
      await post('/auth/change-password', { currentPassword: values.currentPassword, newPassword: values.newPassword });
      toast.success('Password changed. Please sign in again.');
      reset();
      useAuthStore.getState().clearSession();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(changePassword)} className="card p-4 sm:p-5 space-y-4" noValidate>
        <h2 className="text-xs font-semibold flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Change password</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Current password" error={errors.currentPassword?.message} required htmlFor="scur">
            <Input id="scur" type="password" autoComplete="current-password" {...register('currentPassword')} />
          </Field>
          <Field label="New password" error={errors.newPassword?.message} required htmlFor="snew">
            <Input id="snew" type="password" autoComplete="new-password" {...register('newPassword')} />
          </Field>
          <Field label="Confirm" error={errors.confirm?.message} required htmlFor="sconf">
            <Input id="sconf" type="password" autoComplete="new-password" {...register('confirm')} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting}>Change password</Button>
        </div>
      </form>

      <section className="card">
        <header className="px-4 py-3 border-b border-line">
          <h2 className="text-xs font-semibold">Login activity & sessions</h2>
        </header>
        {isLoading ? (
          <div className="p-4"><PageLoader rows={2} /></div>
        ) : (
          <div className="divide-y divide-line/60">
            {(sessions?.data ?? []).slice(0, 12).map((s) => (
              <div key={s._id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <div className="min-w-0 grow">
                  <div className="truncate">{s.userAgent || 'Unknown device'}</div>
                  <div className="text-2xs text-ink-faint">
                    {s.ip} · started {fmtDateTime(s.createdAt)} {s.revokedAt && '· revoked'}
                  </div>
                </div>
                {s.revokedAt ? (
                  <Badge>Revoked</Badge>
                ) : new Date(s.expiresAt) < new Date() ? (
                  <Badge>Expired</Badge>
                ) : (
                  <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => revoke.mutate(s._id)}>
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const options: { key: Theme; label: string; icon: typeof Sun; desc: string }[] = [
    { key: 'light', label: 'Light', icon: Sun, desc: 'Bright interface for well-lit environments.' },
    { key: 'dark', label: 'Dark', icon: Moon, desc: 'Low-glare interface for focus.' },
    { key: 'system', label: 'System', icon: Monitor, desc: 'Follows your operating-system preference.' },
  ];
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => setTheme(o.key)}
          className={`card p-4 text-left transition-colors ${theme === o.key ? 'border-primary-500 ring-1 ring-primary-500/40' : 'hover:border-ink-faint'}`}
          aria-pressed={theme === o.key}
        >
          <o.icon className="h-5 w-5 text-ink-muted mb-2" />
          <div className="text-xs font-semibold">{o.label}</div>
          <div className="text-2xs text-ink-faint mt-0.5">{o.desc}</div>
        </button>
      ))}
    </div>
  );
}

function OrganizationTab() {
  const { organization, setOrganization } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<OrgValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: { name: organization?.name ?? '', timezone: organization?.timezone ?? '', industry: organization?.industry ?? '' },
  });

  async function onSubmit(values: OrgValues) {
    try {
      const res = await patch<Organization>('/organizations/current', values);
      setOrganization(res.data);
      toast.success('Organization updated.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card p-4 sm:p-5 space-y-4" noValidate>
      <Field label="Organization name" error={errors.name?.message} required htmlFor="oname">
        <Input id="oname" {...register('name')} />
      </Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Time zone" htmlFor="otz">
          <Input id="otz" placeholder="Asia/Kolkata" {...register('timezone')} />
        </Field>
        <Field label="Industry" htmlFor="oind">
          <Input id="oind" {...register('industry')} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>Save changes</Button>
      </div>
    </form>
  );
}

function RolesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => get<Role[]>('/organizations/roles'),
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  if (isLoading) return <PageLoader rows={3} />;
  const roles = data?.data ?? [];
  if (roles.length === 0) return <EmptyState title="No roles" />;
  return (
    <div className="card divide-y divide-line/60">
      {roles.map((r) => (
        <div key={r._id}>
          <button onClick={() => setExpanded(expanded === r._id ? null : r._id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-sunken">
            <div className="min-w-0 grow">
              <div className="text-xs font-semibold">{r.name}</div>
              <div className="text-2xs text-ink-faint">{r.permissions.length} permissions {r.isSystem && '· system role'}</div>
            </div>
            <Badge tone={r.isSystem ? 'info' : 'neutral'}>{r.key}</Badge>
          </button>
          {expanded === r._id && (
            <div className="px-4 pb-3 flex flex-wrap gap-1">
              {r.permissions.map((p) => <Badge key={p}>{titleCase(p.replace('.', ' — '))}</Badge>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
