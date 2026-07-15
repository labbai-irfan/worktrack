import { clsx, type ClassValue } from 'clsx';
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

export function cn(...classes: ClassValue[]): string {
  return clsx(classes);
}

export function fmtDate(value?: string | Date | null, pattern = 'dd MMM yyyy'): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? parseISO(value) : value;
  return format(d, pattern);
}

export function fmtDateTime(value?: string | Date | null): string {
  return fmtDate(value, 'dd MMM yyyy, hh:mm a');
}

export function fmtRelative(value?: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? parseISO(value) : value;
  if (isToday(d)) return `Today, ${format(d, 'hh:mm a')}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, 'hh:mm a')}`;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function fmtMinutes(minutes?: number | null): string {
  if (!minutes) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function titleCase(value?: string | null): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function refId(ref: unknown): string {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  return (ref as { _id?: string })._id ?? '';
}
