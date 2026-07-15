import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, FolderKanban, CheckSquare, FileText, Bug, CalendarCheck,
  Users, BarChart3, Rocket, Bell, Settings, Search, Plus, Menu, X,
  ClipboardCheck, LogOut, Moon, Sun, Monitor, ChevronDown, ListTodo,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { get, post } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { Avatar, Button } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { useTheme, Theme } from '@/hooks/useTheme';
import GlobalSearch from '@/features/search/GlobalSearch';
import type { Notification } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: string;
  end?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/my-work', label: 'My Work', icon: ListTodo },
      { to: '/work-updates', label: 'Work Updates', icon: FileText },
      { to: '/tasks', label: 'Tasks', icon: CheckSquare },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/projects', label: 'Projects', icon: FolderKanban },
      { to: '/issues', label: 'Issues', icon: Bug },
      { to: '/team', label: 'Team', icon: Users, permission: 'employee.view' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/reports', label: 'Reports', icon: CalendarCheck },
      { to: '/analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics.personal' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/releases', label: 'Releases', icon: Rocket },
    ],
  },
];

export default function AppLayout() {
  const { user, organization, can, clearSession } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Real-time: notifications + entity events invalidate queries.
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;
    socket.on('notification:new', (n: Notification) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.info(n.title);
    });
    socket.on('work_update:status', () => queryClient.invalidateQueries({ queryKey: ['work-updates'] }));
    socket.on('comment:new', () => queryClient.invalidateQueries({ queryKey: ['comments'] }));
    return () => {
      socket.off('notification:new');
      socket.off('work_update:status');
      socket.off('comment:new');
    };
  }, [queryClient]);

  // Cmd/Ctrl+K opens global search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setSidebarOpen(false), [location.pathname]);

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'badge'],
    queryFn: () => get<Notification[]>('/notifications', { limit: 1 }),
    refetchInterval: 60_000,
  });
  const unread = notifData?.meta.unreadCount ?? 0;

  async function handleLogout() {
    try {
      await post('/auth/logout');
    } finally {
      disconnectSocket();
      clearSession();
      navigate('/login');
    }
  }

  const themeOptions: { key: Theme; icon: typeof Sun; label: string }[] = [
    { key: 'light', icon: Sun, label: 'Light' },
    { key: 'dark', icon: Moon, label: 'Dark' },
    { key: 'system', icon: Monitor, label: 'System' },
  ];

  const sidebar = (
    <nav className="flex flex-col h-full bg-sidebar-background" aria-label="Main navigation">
      {/* Logo & Org Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <span className="h-8 w-8 rounded-lg bg-primary-600 text-white flex items-center justify-center shrink-0 font-bold">
          <ClipboardCheck className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold leading-tight text-sidebar-text truncate">WorkTrack</div>
          <div className="text-2xs text-sidebar-text-muted truncate">{organization?.name}</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="grow overflow-y-auto scrollbar-thin py-4 px-3 space-y-5">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.permission || can(item.permission));
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-wider text-sidebar-text-faint">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200',
                        isActive
                          ? 'bg-sidebar-active text-primary-700 dark:text-primary-300'
                          : 'text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text'
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}

        {/* Notifications */}
        <div>
          <div className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-wider text-sidebar-text-faint">
            Activity
          </div>
          <div className="space-y-0.5">
            <NavLink
              to="/notifications"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 relative',
                  isActive
                    ? 'bg-sidebar-active text-primary-700 dark:text-primary-300'
                    : 'text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text'
                )
              }
            >
              <Bell className="h-4 w-4 shrink-0" />
              <span>Notifications</span>
              {unread > 0 && (
                <span className="ml-auto flex items-center justify-center min-w-5 h-5 rounded-full bg-error-main text-white text-2xs font-semibold">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </NavLink>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="space-y-3 px-3 py-4 border-t border-sidebar-border">
        {/* Theme Switcher */}
        <div className="bg-sidebar-surface border border-sidebar-border rounded-lg p-1 flex gap-1">
          {themeOptions.map((t) => (
            <button
              key={t.key}
              onClick={() => setTheme(t.key)}
              aria-label={`${t.label} theme`}
              title={`${t.label} theme`}
              className={cn(
                'flex-1 flex items-center justify-center rounded py-1.5 text-xs transition-all duration-200',
                theme === t.key
                  ? 'bg-sidebar-active text-primary-700 dark:text-primary-300'
                  : 'text-sidebar-text-faint hover:text-sidebar-text-muted'
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        {/* Settings */}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200',
              isActive
                ? 'bg-sidebar-active text-primary-700 dark:text-primary-300'
                : 'text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text'
            )
          }
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </NavLink>
      </div>

      {/* User Profile */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        <button
          onClick={() => setUserMenuOpen((o) => !o)}
          className="w-full flex items-center gap-2.5 rounded-lg p-2 hover:bg-sidebar-hover transition-colors duration-200 relative"
        >
          <Avatar name={user?.displayName} src={user?.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1 text-left">
            <div className="text-xs font-semibold text-sidebar-text truncate">{user?.displayName}</div>
            <div className="text-2xs text-sidebar-text-faint truncate">{user?.email}</div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-sidebar-text-faint shrink-0" />
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 sticky top-0 h-screen border-r border-sidebar-border">
        {sidebar}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ backgroundColor: 'var(--overlay)' }}
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 h-full w-64 flex flex-col overflow-y-auto shadow-overlay border-r border-sidebar-border">
            <button
              className="absolute right-3 top-4 p-1.5 rounded-lg hover:bg-sidebar-hover text-sidebar-text lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-border-primary bg-surface-primary/95 backdrop-blur-sm sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6">
          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-interactive-hover text-text-primary transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Global Search */}
          <div className="hidden sm:flex flex-1 max-w-md">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-border-primary bg-surface-secondary px-3.5 h-9 text-xs text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-colors w-full"
              aria-label="Open global search"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="grow text-left truncate">Search projects, tasks, updates…</span>
              <kbd className="hidden sm:inline text-2xs font-medium border border-border-secondary rounded px-1.5 py-0.5 bg-surface-tertiary text-text-tertiary">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Spacer */}
          <div className="hidden sm:block flex-1" />

          {/* Quick Add Button */}
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/work-updates/new')}
            className="hidden sm:inline-flex"
          >
            Add Update
          </Button>

          {/* Notifications */}
          <button
            onClick={() => navigate('/notifications')}
            className="relative p-2 rounded-lg hover:bg-interactive-hover text-text-secondary hover:text-text-primary transition-colors"
            aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-error-main" aria-hidden />
            )}
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg hover:bg-interactive-hover px-2 py-1.5 transition-colors"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <Avatar name={user?.displayName} src={user?.avatarUrl} size="sm" />
              <ChevronDown className="h-3.5 w-3.5 text-text-tertiary hidden sm:block" />
            </button>

            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                  aria-hidden
                />
                <div
                  className="absolute right-0 mt-2 w-56 bg-surface-primary border border-border-primary rounded-lg shadow-overlay z-50 overflow-hidden"
                  role="menu"
                >
                  <div className="px-4 py-3 border-b border-border-primary">
                    <div className="text-sm font-semibold text-text-primary truncate">
                      {user?.displayName}
                    </div>
                    <div className="text-xs text-text-tertiary truncate mt-0.5">
                      {user?.email}
                    </div>
                  </div>
                  <button
                    role="menuitem"
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-interactive-hover transition-colors text-text-secondary hover:text-text-primary flex items-center gap-2"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/settings');
                    }}
                  >
                    <Settings className="h-4 w-4" />
                    Settings & Profile
                  </button>
                  <button
                    role="menuitem"
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-interactive-hover transition-colors text-error-main hover:bg-error-light/20 flex items-center gap-2 border-t border-border-primary"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="grow overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Global Search Modal */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Mobile Floating Action Button */}
      <button
        onClick={() => navigate('/work-updates/new')}
        className="sm:hidden fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-lg flex items-center justify-center transition-all active:scale-95"
        aria-label="Add work update"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
