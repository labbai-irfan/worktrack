import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { post, errorMessage } from '@/lib/api';
import { Button, Field, Input } from '@/components/ui';

const schema = z.object({ email: z.string().email('Enter a valid email address.') });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');

  async function onSubmit(values: FormValues) {
    setServerError('');
    try {
      await post('/auth/forgot-password', values);
      setSent(true);
    } catch (err) {
      setServerError(errorMessage(err));
    }
  }

  return (
    <div className="card w-full max-w-sm p-6">
      <h1 className="text-base font-bold">Reset your password</h1>
      {sent ? (
        <p className="text-xs text-ink-muted mt-3">
          If an account exists for that email, a reset link has been sent. Check your inbox (or the backend logs in local development).
        </p>
      ) : (
        <>
          <p className="text-xs text-ink-muted mt-1 mb-5">Enter your work email and we'll send a reset link.</p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="Work email" error={errors.email?.message} required htmlFor="email">
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
            </Field>
            {serverError && <p className="text-xs text-error-main" role="alert">{serverError}</p>}
            <Button type="submit" className="w-full" loading={isSubmitting}>Send reset link</Button>
          </form>
        </>
      )}
      <p className="mt-5 text-xs text-center">
        <Link to="/login" className="text-primary-600 hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}
