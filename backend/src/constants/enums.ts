export const USER_STATUSES = ['invited', 'active', 'inactive', 'on_leave', 'suspended', 'exited'] as const;

export const PROJECT_STATUSES = ['draft', 'planned', 'active', 'on_hold', 'at_risk', 'completed', 'archived', 'cancelled'] as const;
export const PROJECT_HEALTH = ['healthy', 'attention', 'at_risk', 'critical'] as const;

export const MODULE_STATUSES = ['planned', 'active', 'on_hold', 'completed', 'archived'] as const;
export const MILESTONE_STATUSES = ['planned', 'in_progress', 'completed', 'missed'] as const;

export const TASK_TYPES = [
  'feature', 'improvement', 'bug', 'ui_ux', 'frontend', 'backend', 'database', 'api',
  'devops', 'testing', 'research', 'documentation', 'deployment', 'meeting', 'support', 'other',
] as const;

export const TASK_STATUSES = [
  'backlog', 'todo', 'planned', 'in_progress', 'blocked', 'under_review',
  'testing', 'changes_requested', 'completed', 'cancelled',
] as const;

export const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'] as const;

export const WORK_TYPES = [
  'feature', 'improvement', 'bug_fix', 'ui_ux', 'frontend', 'backend', 'api', 'database',
  'devops', 'deployment', 'testing', 'research', 'documentation', 'meeting',
  'client_support', 'internal_support', 'code_review', 'refactoring', 'performance', 'security', 'other',
] as const;

export const WORK_UPDATE_STATUSES = [
  'draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected', 'archived',
] as const;

export const WORK_PROGRESS_STATUSES = [
  'planned', 'started', 'in_progress', 'blocked', 'under_review', 'testing', 'completed',
] as const;

export const ISSUE_TYPES = [
  'bug', 'production_bug', 'ui_issue', 'ux_issue', 'frontend_error', 'backend_error', 'api_error',
  'database_error', 'performance', 'security', 'deployment', 'infrastructure', 'data_issue',
  'integration', 'requirement_gap', 'enhancement', 'support', 'other',
] as const;

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

export const ISSUE_STATUSES = [
  'open', 'triaged', 'assigned', 'in_progress', 'blocked', 'fix_implemented',
  'under_review', 'testing', 'resolved', 'closed', 'reopened', 'duplicate', 'wont_fix',
] as const;

export const RESOLUTION_CODES = [
  'fixed', 'duplicate', 'cannot_reproduce', 'by_design', 'configuration',
  'data_correction', 'wont_fix', 'deferred',
] as const;

export const DAILY_REPORT_STATUSES = ['draft', 'submitted', 'reviewed', 'changes_requested', 'approved', 'missed'] as const;

export const RELEASE_STATUSES = [
  'draft', 'planned', 'building', 'testing', 'ready', 'deploying',
  'deployed', 'failed', 'rolled_back', 'cancelled',
] as const;

export const ATTACHMENT_TYPES = ['screenshot', 'before', 'after', 'evidence', 'error', 'document', 'recording', 'other'] as const;

export const NOTIFICATION_TYPES = [
  'task_assigned', 'task_due_soon', 'task_overdue', 'task_status_changed',
  'mention', 'comment', 'reply',
  'work_submitted', 'work_approved', 'work_changes_requested', 'work_rejected',
  'issue_assigned', 'issue_status_changed', 'issue_reopened',
  'blocker_created', 'report_due', 'report_reviewed',
  'release_created', 'deployment_completed', 'invitation',
] as const;

export const ENVIRONMENTS = ['local', 'development', 'staging', 'production', 'other'] as const;
