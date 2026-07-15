import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, FolderKanban, CheckSquare, Bug, FileText, Users, Rocket } from 'lucide-react';
import { get } from '@/lib/api';
import { Spinner, StatusBadge } from '@/components/ui';
import type { SearchResults } from '@/types';

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () => get<SearchResults>('/search', { q: debouncedQ }),
    enabled: open && debouncedQ.trim().length >= 2,
  });

  if (!open) return null;

  const results = data?.data;
  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const Section = ({ title, icon: Icon, items }: { title: string; icon: typeof Search; items: { key: string; label: string; sub?: string; status?: string; path: string }[] }) =>
    items.length === 0 ? null : (
      <div className="py-1">
        <div className="px-3 py-1 text-2xs font-semibold uppercase tracking-wide text-ink-faint flex items-center gap-1.5">
          <Icon className="h-3 w-3" /> {title}
        </div>
        {items.map((item) => (
          <button key={item.key} onClick={() => go(item.path)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-sunken">
            <span className="grow truncate">
              <span className="font-medium">{item.label}</span>
              {item.sub && <span className="text-ink-faint ml-2">{item.sub}</span>}
            </span>
            {item.status && <StatusBadge status={item.status} />}
          </button>
        ))}
      </div>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true" aria-label="Global search">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ backgroundColor: 'var(--overlay)' }} onClick={onClose} aria-hidden />
      <div className="relative card w-full max-w-xl shadow-overlay overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-b border-line">
          <Search className="h-4 w-4 text-ink-faint shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            placeholder="Search projects, tasks, issues, updates, people…"
            className="w-full h-12 bg-transparent text-sm outline-none placeholder:text-ink-faint"
            aria-label="Search query"
          />
          {isFetching && <Spinner className="h-4 w-4" />}
        </div>
        <div className="max-h-[55vh] overflow-y-auto scrollbar-thin">
          {debouncedQ.trim().length < 2 && (
            <p className="px-4 py-6 text-xs text-ink-faint text-center">Type at least two characters to search across your workspace.</p>
          )}
          {results && (
            <>
              <Section title="Projects" icon={FolderKanban} items={results.projects.map((p) => ({ key: p._id, label: p.name, sub: p.key, status: p.status, path: `/projects/${p._id}` }))} />
              <Section title="Tasks" icon={CheckSquare} items={results.tasks.map((t) => ({ key: t._id, label: t.title, sub: t.number, status: t.status, path: `/tasks/${t._id}` }))} />
              <Section title="Issues" icon={Bug} items={results.issues.map((i) => ({ key: i._id, label: i.title, sub: i.number, status: i.status, path: `/issues/${i._id}` }))} />
              <Section title="Work Updates" icon={FileText} items={results.workUpdates.map((u) => ({ key: u._id, label: u.title, sub: u.number, status: u.status, path: `/work-updates/${u._id}` }))} />
              <Section title="People" icon={Users} items={results.employees.map((e) => ({ key: e._id, label: e.displayName, sub: e.jobTitle, path: `/team/${e._id}` }))} />
              <Section title="Releases" icon={Rocket} items={results.releases.map((r) => ({ key: r._id, label: r.version, sub: r.name, status: r.status, path: `/releases` }))} />
              {Object.values(results).every((arr) => (arr as unknown[]).length === 0) && (
                <p className="px-4 py-6 text-xs text-ink-faint text-center">No results for “{debouncedQ}”.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
