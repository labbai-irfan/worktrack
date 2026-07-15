import { Outlet, Navigate } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

export default function AuthLayout() {
  const { accessToken } = useAuthStore();
  if (accessToken) return <Navigate to="/" replace />;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-background">
      {/* Gradient accent (optional premium touch) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-500/5 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-2 select-none">
          <span className="h-10 w-10 rounded-lg bg-primary-600 text-white flex items-center justify-center font-bold">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <span className="text-2xl font-bold tracking-tight text-text-primary">
            {import.meta.env.VITE_APP_NAME ?? 'WorkTrack'}
          </span>
        </div>

        {/* Tagline */}
        <p className="text-sm text-text-secondary mb-8">
          Enterprise work progress & project tracking
        </p>

        {/* Auth Forms Container */}
        <div className="w-full max-w-sm">
          <Outlet />
        </div>

        {/* Footer Text */}
        <p className="mt-8 text-2xs text-text-tertiary">
          © 2026 WorkTrack. Secure & encrypted.
        </p>
      </div>
    </div>
  );
}
