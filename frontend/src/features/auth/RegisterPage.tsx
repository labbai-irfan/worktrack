import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { post, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button, Field, Input, Select } from '@/components/ui';
import type { Organization, User } from '@/types';

const schema = z.object({
  organizationName: z.string().min(2, 'Organization name is required.'),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().optional(),
  email: z.string().email('Enter a valid email address.'),
  password: z
    .string()
    .min(10, 'At least 10 characters.')
    .regex(/[a-z]/, 'Include a lowercase letter.')
    .regex(/[A-Z]/, 'Include an uppercase letter.')
    .regex(/[0-9]/, 'Include a number.'),
});
type FormValues = z.infer<typeof schema>;

const STEPS = ['Organization', 'Your account'] as const;

export default function RegisterPage() {
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState('');
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const { register, handleSubmit, trigger, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  });

  async function next() {
    if (await trigger(['organizationName', 'industry', 'companySize', 'country', 'timezone'])) setStep(1);
  }

  async function onSubmit(values: FormValues) {
    setServerError('');
    try {
      const res = await post<{ accessToken: string; user: User; organization: Organization }>('/auth/register', values);
      setSession({ ...res.data, permissions: [], roleKey: 'org_admin' });
      // Fetch full session (permissions) after registration.
      window.location.href = '/';
    } catch (err) {
      setServerError(errorMessage(err));
    }
    void navigate;
  }

  return (
    <div className="card w-full max-w-md p-6">
      <h1 className="text-base font-bold">Create your workspace</h1>
      <div className="flex items-center gap-2 mt-3 mb-5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 text-2xs">
            <span className={`h-5 w-5 rounded-full flex items-center justify-center font-semibold ${i <= step ? 'bg-primary-600 text-white' : 'bg-surface-sunken text-ink-faint'}`}>{i + 1}</span>
            <span className={i <= step ? 'text-ink font-medium' : 'text-ink-faint'}>{s}</span>
            {i < STEPS.length - 1 && <span className="w-8 h-px bg-line" aria-hidden />}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {step === 0 && (
          <>
            <Field label="Organization name" error={errors.organizationName?.message} required htmlFor="orgName">
              <Input id="orgName" placeholder="Acme Software Pvt Ltd" {...register('organizationName')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Industry" htmlFor="industry">
                <Select id="industry" {...register('industry')}>
                  <option value="">Select…</option>
                  {['Software & IT Services', 'Finance', 'Healthcare', 'E-commerce', 'Education', 'Manufacturing', 'Other'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Company size" htmlFor="companySize">
                <Select id="companySize" {...register('companySize')}>
                  <option value="">Select…</option>
                  {['1-10', '11-50', '51-200', '201-1000', '1000+'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Country" htmlFor="country">
                <Input id="country" placeholder="India" {...register('country')} />
              </Field>
              <Field label="Time zone" htmlFor="timezone">
                <Input id="timezone" {...register('timezone')} />
              </Field>
            </div>
            <Button type="button" className="w-full" onClick={next}>
              Continue
            </Button>
          </>
        )}
        {step === 1 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" error={errors.firstName?.message} required htmlFor="firstName">
                <Input id="firstName" autoComplete="given-name" {...register('firstName')} />
              </Field>
              <Field label="Last name" htmlFor="lastName">
                <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
              </Field>
            </div>
            <Field label="Work email" error={errors.email?.message} required htmlFor="email">
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
            </Field>
            <Field label="Password" error={errors.password?.message} hint="10+ characters with upper, lower and a number." required htmlFor="password">
              <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            </Field>
            {serverError && <p className="text-xs text-error-main" role="alert">{serverError}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button type="submit" className="flex-1" loading={isSubmitting}>
                Create workspace
              </Button>
            </div>
          </>
        )}
      </form>
      <p className="mt-5 text-xs text-ink-muted text-center">
        Already have an account?{' '}
        <Link to="/login" className="text-primary-600 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
