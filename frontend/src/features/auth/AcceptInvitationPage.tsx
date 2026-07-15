import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { get, post, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button, Field, Input, PageLoader, EmptyState } from '@/components/ui';
import type { Organization, User } from '@/types';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().optional(),
  password: z
    .string()
    .min(10, 'At least 10 characters.')
    .regex(/[a-z]/, 'Include a lowercase letter.')
    .regex(/[A-Z]/, 'Include an uppercase letter.')
    .regex(/[0-9]/, 'Include a number.'),
});
type FormValues = z.infer<typeof schema>;

interface InviteInfo {
  email: string;
  name?: string;
  organization: { name: string; logoUrl?: string };
  role: { name: string };
}

export default function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [serverError, setServerError] = useState('');
  const setSession = useAuthStore((s) => s.setSession);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => get<InviteInfo>(`/auth/invitations/${token}`),
    enabled: Boolean(token),
    retry: false,
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!token || isError) {
    return (
      <div className="card w-full max-w-sm p-6">
        <EmptyState kind="error" title="Invitation not found" description="This invitation link is invalid or has expired. Ask your administrator to send a new one." action={<Link to="/login" className="text-primary-600 text-xs hover:underline">Back to sign in</Link>} />
      </div>
    );
  }
  if (isLoading || !data) return <div className="card w-full max-w-sm p-6"><PageLoader rows={3} /></div>;

  const invite = data.data;

  async function onSubmit(values: FormValues) {
    setServerError('');
    try {
      const res = await post<{ accessToken: string; user: User; organization: Organization; permissions: string[]; roleKey: string }>('/auth/accept-invitation', { token, ...values });
      setSession(res.data);
      window.location.href = '/';
    } catch (err) {
      setServerError(errorMessage(err));
    }
  }

  return (
    <div className="card w-full max-w-sm p-6">
      <h1 className="text-base font-bold">Join {invite.organization.name}</h1>
      <p className="text-xs text-ink-muted mt-1 mb-5">
        You've been invited as <span className="font-medium text-ink">{invite.role?.name}</span> using <span className="font-medium text-ink">{invite.email}</span>.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName?.message} required htmlFor="firstName">
            <Input id="firstName" defaultValue={invite.name?.split(' ')[0]} {...register('firstName')} />
          </Field>
          <Field label="Last name" htmlFor="lastName">
            <Input id="lastName" defaultValue={invite.name?.split(' ').slice(1).join(' ')} {...register('lastName')} />
          </Field>
        </div>
        <Field label="Create password" error={errors.password?.message} hint="10+ characters with upper, lower and a number." required htmlFor="password">
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
        </Field>
        {serverError && <p className="text-xs text-error-main" role="alert">{serverError}</p>}
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Accept invitation
        </Button>
      </form>
    </div>
  );
}
