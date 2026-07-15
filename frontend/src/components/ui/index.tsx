/* Premium enterprise UI kit: small, accessible, theme-aware primitives. */
import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef, useEffect, useRef } from 'react';
import { Loader2, X, AlertTriangle, Inbox, SearchX, ShieldOff, RefreshCw } from 'lucide-react';
import { cn, initials, titleCase } from '@/lib/utils';
import { STATUS_TONES } from '@/constants';

/* ---------- Button ---------- */
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref
) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 border border-transparent disabled:bg-primary-400',
    secondary: 'bg-surface-secondary text-text-primary hover:bg-surface-tertiary border border-border-primary disabled:bg-surface-secondary disabled:text-text-disabled',
    outline: 'bg-transparent text-text-primary hover:bg-interactive-hover border border-border-primary disabled:text-text-disabled',
    ghost: 'bg-transparent text-text-secondary hover:bg-interactive-hover hover:text-text-primary border border-transparent disabled:text-text-disabled',
    danger: 'bg-error-main text-white hover:bg-red-700 active:bg-red-800 border border-transparent disabled:bg-red-400',
  };
  const sizes = { sm: 'h-7 px-2.5 text-xs gap-1.5', md: 'h-9 px-3.5 text-sm gap-2', lg: 'h-10 px-5 text-sm gap-2' };
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

/* ---------- Form fields ---------- */
interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
  htmlFor?: string;
}
export function Field({ label, error, hint, required, className, children, htmlFor }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
          {required && <span className="text-error-main ml-0.5" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-2xs text-text-tertiary">{hint}</p>}
      {error && (
        <p className="mt-1 text-2xs text-error-main" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn('input', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cn('input resize-y', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn('input appearance-none pr-8 bg-no-repeat bg-[right_0.6rem_center]', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")" }}
      {...rest}>
      {children}
    </select>
  );
});

/* ---------- Badge / StatusBadge ---------- */
/* The -light/-dark tokens already swap meaning between themes (see styles/index.css),
 * so no `dark:` variant is needed here — adding one double-swaps and inverts the badge. */
const badgeTones = {
  neutral: 'bg-neutral-light text-neutral-dark border border-neutral-main/20',
  info: 'bg-info-light text-info-dark border border-info-main/20',
  success: 'bg-success-light text-success-dark border border-success-main/20',
  warning: 'bg-warning-light text-warning-dark border border-warning-main/20',
  danger: 'bg-error-light text-error-dark border border-error-main/20',
};
export function Badge({ tone = 'neutral', className, children }: { tone?: keyof typeof badgeTones; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-2xs font-medium whitespace-nowrap', badgeTones[tone], className)}>
      {children}
    </span>
  );
}
export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  if (!status) return null;
  return (
    <Badge tone={STATUS_TONES[status] ?? 'neutral'} className={className}>
      {titleCase(status)}
    </Badge>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ name, src, size = 'md', className }: { name?: string; src?: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { xs: 'h-5 w-5 text-[9px]', sm: 'h-6 w-6 text-2xs', md: 'h-8 w-8 text-xs', lg: 'h-12 w-12 text-base' };
  if (src) return <img src={src} alt={name ?? 'avatar'} className={cn('rounded-full object-cover shrink-0 ring-1 ring-border-primary/50', sizes[size], className)} loading="lazy" />;
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 font-semibold shrink-0 ring-1 ring-border-primary/50', sizes[size], className)}
      aria-label={name}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarGroup({ items, max = 4, size = 'sm' }: { items: { name?: string; src?: string }[]; max?: number; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const shown = items.slice(0, max);
  const hidden = items.length - shown.length;
  const sizeClasses = { xs: '-ml-1.5', sm: '-ml-2', md: '-ml-2.5', lg: '-ml-3' };
  return (
    <div className="flex items-center">
      {shown.map((item, i) => (
        <Avatar key={i} {...item} size={size} className={cn('ring-2 ring-surface-primary', i > 0 && sizeClasses[size])} />
      ))}
      {hidden > 0 && (
        <span className={cn('inline-flex items-center justify-center rounded-full bg-neutral-light text-neutral-dark font-medium text-2xs ring-2 ring-surface-primary', { xs: 'h-5 w-5', sm: 'h-6 w-6', md: 'h-8 w-8', lg: 'h-12 w-12' }[size], sizeClasses[size])}>
          +{hidden}
        </span>
      )}
    </div>
  );
}

/* ---------- Progress bar ---------- */
export function Progress({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-2 w-full rounded-full bg-surface-tertiary overflow-hidden', className)} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary-500 transition-all duration-300" style={{ width: `${clamped}%` }} />
    </div>
  );
}

/* ---------- Modal ---------- */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}
export function Modal({ open, onClose, title, children, footer, wide }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 backdrop-blur-sm" onClick={onClose} aria-hidden style={{ backgroundColor: 'var(--overlay)' }} />
      <div
        ref={ref}
        className={cn(
          'relative bg-surface-primary border border-border-primary w-full max-h-[92vh] flex flex-col shadow-overlay rounded-b-none sm:rounded-lg',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary shrink-0">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-interactive-hover text-text-tertiary hover:text-text-secondary transition-colors" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto scrollbar-thin grow">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-6 py-4 border-t border-border-primary shrink-0 bg-surface-secondary">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Skeleton / loading ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-surface-tertiary', className)} aria-hidden />;
}
export function PageLoader({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-1" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-text-tertiary', className)} aria-label="Loading" />;
}

/* ---------- Empty / error / denied states ---------- */
interface StateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  kind?: 'empty' | 'search' | 'error' | 'denied';
}
export function EmptyState({ title, description, action, kind = 'empty' }: StateProps) {
  const iconColors = {
    empty: 'text-text-tertiary',
    search: 'text-text-tertiary',
    error: 'text-error-main',
    denied: 'text-warning-main',
  };
  const icons = {
    empty: <Inbox className="h-8 w-8" />,
    search: <SearchX className="h-8 w-8" />,
    error: <AlertTriangle className="h-8 w-8" />,
    denied: <ShieldOff className="h-8 w-8" />,
  };
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-4">
      <div className={cn('mb-3', iconColors[kind])}>{icons[kind]}</div>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {description && <p className="mt-1 text-xs text-text-secondary max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      kind="error"
      title="Something went wrong"
      description={message ?? 'The request failed. Please try again.'}
      action={onRetry && (
        <Button variant="outline" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRetry}>
          Retry
        </Button>
      )}
    />
  );
}

/* ---------- Tabs ---------- */
export function Tabs({ tabs, value, onChange, className }: { tabs: { key: string; label: string; count?: number }[]; value: string; onChange: (key: string) => void; className?: string }) {
  return (
    <div className={cn('flex items-center border-b border-border-primary overflow-x-auto scrollbar-thin', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
            value === t.key ? 'border-primary-500 text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-2 text-2xs text-text-tertiary bg-surface-tertiary px-1.5 py-0.5 rounded">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 pt-4 text-xs text-text-secondary">
      <span>
        Page <span className="font-semibold text-text-primary">{page}</span> of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
