export const TASK_STATUSES = [
  'backlog', 'todo', 'planned', 'in_progress', 'blocked', 'under_review',
  'testing', 'changes_requested', 'completed', 'cancelled',
] as const;

export const BOARD_COLUMNS = ['todo', 'in_progress', 'blocked', 'under_review', 'testing', 'completed'] as const;

export const TASK_TYPES = [
  'feature', 'improvement', 'bug', 'ui_ux', 'frontend', 'backend', 'database', 'api',
  'devops', 'testing', 'research', 'documentation', 'deployment', 'meeting', 'support', 'other',
] as const;

export const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'] as const;

export const WORK_TYPES = [
  'feature', 'improvement', 'bug_fix', 'ui_ux', 'frontend', 'backend', 'api', 'database',
  'devops', 'deployment', 'testing', 'research', 'documentation', 'meeting',
  'client_support', 'internal_support', 'code_review', 'refactoring', 'performance', 'security', 'other',
] as const;

export const WORK_PROGRESS_STATUSES = ['planned', 'started', 'in_progress', 'blocked', 'under_review', 'testing', 'completed'] as const;

export const ISSUE_TYPES = [
  'bug', 'production_bug', 'ui_issue', 'ux_issue', 'frontend_error', 'backend_error', 'api_error',
  'database_error', 'performance', 'security', 'deployment', 'infrastructure', 'data_issue',
  'integration', 'requirement_gap', 'enhancement', 'support', 'other',
] as const;

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export const ENVIRONMENTS = ['local', 'development', 'staging', 'production', 'other'] as const;

export const RESOLUTION_CODES = ['fixed', 'duplicate', 'cannot_reproduce', 'by_design', 'configuration', 'data_correction', 'wont_fix', 'deferred'] as const;

/** Semantic tone per status value — used by <StatusBadge/>. */
export const STATUS_TONES: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  // shared
  draft: 'neutral', archived: 'neutral', cancelled: 'neutral',
  // tasks & work
  backlog: 'neutral', todo: 'info', planned: 'info', started: 'info', in_progress: 'info',
  blocked: 'danger', under_review: 'info', testing: 'warning', changes_requested: 'warning',
  completed: 'success', approved: 'success', submitted: 'info', rejected: 'danger',
  // issues
  open: 'warning', triaged: 'info', assigned: 'info', fix_implemented: 'info',
  resolved: 'success', closed: 'neutral', reopened: 'danger', duplicate: 'neutral', wont_fix: 'neutral',
  // projects
  active: 'success', on_hold: 'warning', at_risk: 'danger',
  healthy: 'success', attention: 'warning', critical: 'danger',
  // releases
  building: 'info', ready: 'success', deploying: 'warning', deployed: 'success', failed: 'danger', rolled_back: 'danger',
  // priorities / severities
  urgent: 'danger', high: 'warning', medium: 'info', low: 'neutral', none: 'neutral',
  // people
  invited: 'info', inactive: 'neutral', on_leave: 'warning', suspended: 'danger', exited: 'neutral',
  // reports
  reviewed: 'success', missed: 'danger',
};
