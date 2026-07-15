import { Suspense, lazy, useEffect, ReactNode, Component } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { API_BASE_URL } from '@/lib/api';
import { PageLoader, EmptyState, Button } from '@/components/ui';
import { ToastViewport } from '@/components/ui/toast';
import AppLayout from '@/layouts/AppLayout';
import AuthLayout from '@/layouts/AuthLayout';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));
const AcceptInvitationPage = lazy(() => import('@/features/auth/AcceptInvitationPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('@/features/projects/ProjectDetailPage'));
const TasksPage = lazy(() => import('@/features/tasks/TasksPage'));
const MyWorkPage = lazy(() => import('@/features/tasks/MyWorkPage'));
const TaskDetailPage = lazy(() => import('@/features/tasks/TaskDetailPage'));
const WorkUpdatesPage = lazy(() => import('@/features/workUpdates/WorkUpdatesPage'));
const WorkUpdateFormPage = lazy(() => import('@/features/workUpdates/WorkUpdateFormPage'));
const WorkUpdateDetailPage = lazy(() => import('@/features/workUpdates/WorkUpdateDetailPage'));
const IssuesPage = lazy(() => import('@/features/issues/IssuesPage'));
const IssueDetailPage = lazy(() => import('@/features/issues/IssueDetailPage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const TeamPage = lazy(() => import('@/features/team/TeamPage'));
const EmployeeDetailPage = lazy(() => import('@/features/team/EmployeeDetailPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));
const ReleasesPage = lazy(() => import('@/features/releases/ReleasesPage'));
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <EmptyState
            kind="error"
            title="The application hit an unexpected error"
            description={this.state.error.message}
            action={<Button onClick={() => window.location.reload()}>Reload</Button>}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

/** Restores the session from the httpOnly refresh cookie on first load. */
function useSessionBootstrap() {
  const { hydrated, setSession, setHydrated } = useAuthStore();
  useEffect(() => {
    if (hydrated) return;
    axios
      .post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        const { accessToken, user, organization, permissions, roleKey } = res.data.data;
        setSession({ accessToken, user, organization, permissions, roleKey });
      })
      .catch(() => setHydrated());
  }, [hydrated, setSession, setHydrated]);
  return hydrated;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { accessToken } = useAuthStore();
  const location = useLocation();
  if (!accessToken) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

export default function App() {
  const hydrated = useSessionBootstrap();
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <PageLoader rows={3} />
      </div>
    );
  }
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="p-8"><PageLoader /></div>}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/my-work" element={<MyWorkPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/:id" element={<TaskDetailPage />} />
            <Route path="/work-updates" element={<WorkUpdatesPage />} />
            <Route path="/work-updates/new" element={<WorkUpdateFormPage />} />
            <Route path="/work-updates/:id" element={<WorkUpdateDetailPage />} />
            <Route path="/work-updates/:id/edit" element={<WorkUpdateFormPage />} />
            <Route path="/issues" element={<IssuesPage />} />
            <Route path="/issues/:id" element={<IssueDetailPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/team/:id" element={<EmployeeDetailPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/releases" element={<ReleasesPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings/*" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ToastViewport />
    </ErrorBoundary>
  );
}
