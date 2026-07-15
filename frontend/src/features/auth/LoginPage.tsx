import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { post, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button, Field, Input } from '@/components/ui';
import type { Organization, User } from '@/types';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
  rememberMe: z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

interface LoginResponse {
  accessToken: string;
  user: User;
  organization: Organization | null;
  permissions: string[];
  roleKey: string | null;
}

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rememberMe: true },
  });
  const [serverError, setServerError] = useState('');
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();

  async function onSubmit(values: FormValues) {
    setServerError('');
    try {
      const res = await post<LoginResponse>('/auth/login', values);
      setSession(res.data);
      navigate((location.state as { from?: string })?.from ?? '/', { replace: true });
    } catch (err) {
      setServerError(errorMessage(err));
    }
  }

  return (
    <div className="bg-surface-primary border border-border-primary rounded-xl shadow-md p-7 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Sign in</h1>
        <p className="text-sm text-text-secondary mt-1">Welcome back. Enter your work credentials.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Work email" error={errors.email?.message} required htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register('email')}
          />
        </Field>

        <Field label="Password" error={errors.password?.message} required htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••"
            {...register('password')}
          />
        </Field>

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 text-text-secondary hover:text-text-primary cursor-pointer transition-colors">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border border-border-primary bg-surface-primary accent-primary-600 cursor-pointer"
              {...register('rememberMe')}
            />
            Remember me
          </label>
          <Link
            to="/forgot-password"
            className="text-primary-600 hover:text-primary-700 hover:underline transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {serverError && (
          <div className="bg-error-light border border-error-main/20 rounded-lg p-3" role="alert">
            <p className="text-sm text-error-dark font-medium">{serverError}</p>
          </div>
        )}

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-primary" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-surface-primary text-text-tertiary">New to WorkTrack?</span>
        </div>
      </div>

      <Link
        to="/register"
        className="block text-center px-4 py-2.5 rounded-lg border border-border-primary text-text-primary hover:bg-interactive-hover transition-colors font-medium text-sm"
      >
        Create a workspace
      </Link>
    </div>
  );
}
