import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { post, errorMessage } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { Button, Field, Input } from '@/components/ui';

const schema = z
  .object({
    password: z
      .string()
      .min(10, 'At least 10 characters.')
      .regex(/[a-z]/, 'Include a lowercase letter.')
      .regex(/[A-Z]/, 'Include an uppercase letter.')
      .regex(/[0-9]/, 'Include a number.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' });
type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError('');
    try {
      await post('/auth/reset-password', { token, password: values.password });
      toast.success('Password reset. Please sign in.');
      navigate('/login');
    } catch (err) {
      setServerError(errorMessage(err));
    }
  }

  return (
    <div className="card w-full max-w-sm p-6">
      <h1 className="text-base font-bold">Choose a new password</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-5" noValidate>
        <Field label="New password" error={errors.password?.message} required htmlFor="password">
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
        </Field>
        <Field label="Confirm password" error={errors.confirm?.message} required htmlFor="confirm">
          <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
        </Field>
        {serverError && <p className="text-xs text-error-main" role="alert">{serverError}</p>}
        <Button type="submit" className="w-full" loading={isSubmitting}>Reset password</Button>
      </form>
      <p className="mt-5 text-xs text-center">
        <Link to="/login" className="text-primary-600 hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}
