export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta: PageMeta & Record<string, unknown>;
}

export interface PageMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  unreadCount?: number;
}

export interface UserRef {
  _id: string;
  displayName: string;
  avatarUrl?: string;
  jobTitle?: string;
  email?: string;
}

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  industry?: string;
  timezone: string;
  workingDays: string[];
  workingHours: { start: string; end: string };
  settings: {
    dateFormat: string;
    timeFormat: string;
    weekStart: string;
    dailyReportCutoff: string;
    allowSelfApproval: boolean;
    allowMultipleTimers: boolean;
  };
}

export interface User {
  _id: string;
  email: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string;
  phone?: string;
  jobTitle?: string;
  departmentId?: { _id: string; name: string } | string | null;
  teamId?: { _id: string; name: string } | string | null;
  managerId?: UserRef | string | null;
  roleId?: { _id: string; key: string; name: string } | string | null;
  status: 'invited' | 'active' | 'inactive' | 'on_leave' | 'suspended' | 'exited';
  joiningDate?: string;
  workLocation?: string;
  timezone?: string;
  skills: string[];
  lastLoginAt?: string;
  createdAt: string;
}

export interface Role {
  _id: string;
  key: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
}

export interface Department { _id: string; name: string; description?: string; headId?: UserRef | null }
export interface Team {
  _id: string;
  name: string;
  description?: string;
  departmentId?: { _id: string; name: string } | null;
  leadId?: UserRef | null;
  memberIds: UserRef[];
}

export interface ProjectMember { userId: UserRef | string; role: 'manager' | 'lead' | 'member' | 'viewer' }

export interface Project {
  _id: string;
  name: string;
  key: string;
  slug: string;
  description?: string;
  color: string;
  icon: string;
  client?: string;
  managerId?: UserRef | null;
  members: ProjectMember[];
  startDate?: string | null;
  targetDate?: string | null;
  status: 'draft' | 'planned' | 'active' | 'on_hold' | 'at_risk' | 'completed' | 'archived' | 'cancelled';
  priority: Priority;
  progress: number;
  health: 'healthy' | 'attention' | 'at_risk' | 'critical';
  tags: string[];
  repositoryUrl?: string;
  stagingUrl?: string;
  productionUrl?: string;
  documentationUrl?: string;
  visibility: 'private' | 'organization';
  createdAt: string;
  updatedAt: string;
  stats?: {
    tasksByStatus: Record<string, number>;
    openIssues: number;
    criticalIssues: number;
    workUpdates: number;
  };
}

export interface Module {
  _id: string;
  projectId: string;
  name: string;
  key: string;
  description?: string;
  icon: string;
  color: string;
  ownerId?: UserRef | null;
  memberIds?: UserRef[];
  status: string;
  priority: Priority;
  progress: number;
  targetDate?: string | null;
  stats?: { tasksByStatus: Record<string, number>; openIssues: number; blockedTasks: number };
  recentUpdates?: WorkUpdate[];
}

export interface Milestone {
  _id: string;
  projectId: { _id: string; name: string; key: string; color: string } | string;
  name: string;
  description?: string;
  startDate?: string | null;
  dueDate?: string | null;
  status: string;
  progress: number;
}

export interface MilestoneAlerts {
  overdue: Milestone[];
  upcoming: Milestone[];
}

export interface ProjectHealthMetrics {
  openTasks: number;
  overdueTasks: number;
  overdueRatio: number;
  blockedTasks: number;
  blockedCriticalTasks: number;
  overdueMilestones: number;
  upcomingMilestones: number;
  daysSinceActivity: number | null;
}

export interface ProjectHealth {
  health: 'healthy' | 'attention' | 'at_risk' | 'critical';
  reasons: string[];
  metrics: ProjectHealthMetrics;
  recommendedAction: string;
}

export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none';
export type TaskStatus =
  | 'backlog' | 'todo' | 'planned' | 'in_progress' | 'blocked' | 'under_review'
  | 'testing' | 'changes_requested' | 'completed' | 'cancelled';

export interface Task {
  _id: string;
  number: string;
  projectId: { _id: string; name: string; key: string; color: string } | string;
  moduleId?: { _id: string; name: string; key: string; color: string } | string | null;
  milestoneId?: string | null;
  parentTaskId?: string | null;
  title: string;
  description?: string;
  type: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId?: UserRef | null;
  collaboratorIds?: UserRef[];
  reporterId?: UserRef | null;
  reviewerId?: UserRef | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  loggedMinutes: number;
  progress: number;
  labels: string[];
  checklist: { text: string; done: boolean }[];
  acceptanceCriteria?: string;
  environment?: string;
  git?: { repository?: string; branch?: string; commitHash?: string; pullRequestUrl?: string };
  blockedReason?: string;
  order: number;
  subtasks?: Task[];
  /** Tasks this one depends on (populated as refs on the detail endpoint). */
  dependencyIds?: ({ _id: string; number: string; title: string; status: TaskStatus } | string)[];
  /** Tasks that depend on this one (detail endpoint only). */
  dependents?: { _id: string; number: string; title: string; status: TaskStatus }[];
  watcherIds?: UserRef[];
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyWork {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  blocked: Task[];
  inReview: Task[];
  counts: { overdue: number; today: number; upcoming: number; blocked: number; inReview: number; noDueDate: number };
}

export type WorkUpdateStatus = 'draft' | 'submitted' | 'under_review' | 'changes_requested' | 'approved' | 'rejected' | 'archived';

export interface Attachment {
  _id: string;
  secureUrl: string;
  publicId: string;
  resourceType: 'image' | 'video' | 'raw';
  format: string;
  originalFilename: string;
  bytes: number;
  width?: number | null;
  height?: number | null;
  caption?: string;
  altText?: string;
  attachmentType: string;
  uploadedBy: UserRef | string;
  createdAt: string;
}

export interface ReviewEvent {
  action: 'submitted' | 'review_started' | 'changes_requested' | 'approved' | 'rejected' | 'resubmitted';
  byId: UserRef | string;
  comment: string;
  at: string;
}

export interface WorkUpdate {
  _id: string;
  number: string;
  userId: UserRef | string;
  projectId: { _id: string; name: string; key: string; color: string; managerId?: string } | string;
  moduleId?: { _id: string; name: string; key: string; color: string } | string | null;
  taskId?: { _id: string; number: string; title: string } | string | null;
  issueId?: { _id: string; number: string; title: string } | string | null;
  title: string;
  description?: string;
  workType: string;
  progressStatus: string;
  progress: number;
  workDate: string;
  planned?: string;
  implemented?: string;
  changed?: string;
  remaining?: string;
  outcome?: string;
  blockers?: string;
  dependencies?: string;
  assistanceRequired?: string;
  nextAction?: string;
  time?: {
    startTime?: string; endTime?: string; breakMinutes?: number;
    minutesSpent?: number; billable?: boolean; source?: 'manual' | 'timer';
  };
  technical?: {
    environment?: string; repository?: string; branch?: string; commitHash?: string;
    pullRequestUrl?: string; deploymentUrl?: string; apiEndpoint?: string; httpMethod?: string;
    httpStatus?: string; databaseChanges?: string; migrationNotes?: string; notes?: string;
  };
  attachmentIds: Attachment[];
  beforeAfter: { beforeAttachmentId: string; afterAttachmentId: string; caption?: string }[];
  status: WorkUpdateStatus;
  submittedAt?: string | null;
  review?: { reviewerId?: UserRef | null; comment?: string; reviewedAt?: string | null; approvedAt?: string | null };
  reviewHistory: ReviewEvent[];
  createdAt: string;
  updatedAt: string;
}

export type IssueStatus =
  | 'open' | 'triaged' | 'assigned' | 'in_progress' | 'blocked' | 'fix_implemented'
  | 'under_review' | 'testing' | 'resolved' | 'closed' | 'reopened' | 'duplicate' | 'wont_fix';

export interface Issue {
  _id: string;
  number: string;
  projectId: { _id: string; name: string; key: string; color: string } | string;
  moduleId?: { _id: string; name: string; key: string; color: string } | string | null;
  taskId?: { _id: string; number: string; title: string } | string | null;
  title: string;
  description?: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  priority: Priority;
  status: IssueStatus;
  reporterId?: UserRef | null;
  assigneeId?: UserRef | null;
  environment: string;
  affectedVersion?: string;
  fixedVersion?: string;
  dueDate?: string | null;
  resolvedAt?: string | null;
  labels: string[];
  error?: {
    message?: string; stackTrace?: string; consoleLog?: string; apiEndpoint?: string; httpMethod?: string;
    responseStatus?: string; browser?: string; browserVersion?: string; os?: string; device?: string; appVersion?: string;
    commitHash?: string; occurrenceCount?: number; firstSeenAt?: string; lastSeenAt?: string;
  };
  reproduction?: { steps?: string; expected?: string; actual?: string; frequency?: string; reproducible?: string };
  resolution?: { rootCause?: string; fixSummary?: string; solution?: string; testingPerformed?: string; regressionRisk?: string; code?: string };
  history: { action: string; byId: UserRef | string; from?: string; to?: string; note?: string; at: string }[];
  attachmentIds: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  entityType: string;
  entityId: string;
  authorId: UserRef;
  body: string;
  mentionIds: UserRef[];
  parentId?: string | null;
  reactions: { emoji: string; userIds: string[] }[];
  pinned: boolean;
  resolvedAt?: string | null;
  editedAt?: string | null;
  createdAt: string;
}

export interface TimeEntry {
  _id: string;
  projectId?: { _id: string; name: string; key: string; color: string } | null;
  taskId?: { _id: string; number: string; title: string } | null;
  startedAt: string;
  endedAt?: string | null;
  minutes: number;
  notes?: string;
  billable: boolean;
  source: 'manual' | 'timer';
  running: boolean;
}

export interface DailyReport {
  _id: string;
  userId: UserRef | string;
  date: string;
  projectIds: { _id: string; name: string; key: string; color: string }[];
  workUpdateIds: WorkUpdate[] | string[];
  taskIds: string[];
  issuesCreated: number;
  issuesResolved: number;
  completedSummary?: string;
  inProgressSummary?: string;
  blockers?: string;
  assistanceRequired?: string;
  nextDayPlan?: string;
  totalMinutes: number;
  employeeNotes?: string;
  managerNotes?: string;
  status: 'draft' | 'submitted' | 'reviewed' | 'changes_requested' | 'approved' | 'missed';
  submittedAt?: string | null;
  reviewedBy?: UserRef | null;
  reviewedAt?: string | null;
}

export interface Notification {
  _id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  actorId?: UserRef | null;
  readAt?: string | null;
  createdAt: string;
}

export interface Activity {
  _id: string;
  actorId: UserRef;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel?: string;
  previousValue?: string;
  newValue?: string;
  link?: string;
  createdAt: string;
}

export interface Release {
  _id: string;
  version: string;
  name?: string;
  projectId: { _id: string; name: string; key: string; color: string } | string;
  environment: string;
  status: string;
  managerId?: UserRef | null;
  releaseDate?: string | null;
  deployedAt?: string | null;
  taskIds: (Task | string)[];
  issueIds: (Issue | string)[];
  notes?: { features?: string; improvements?: string; bugFixes?: string; breakingChanges?: string; migrationNotes?: string; rollbackPlan?: string };
  git?: { repository?: string; branch?: string; commitHash?: string; buildUrl?: string; deploymentUrl?: string };
  createdAt: string;
}

export interface Invitation {
  _id: string;
  email: string;
  name?: string;
  roleId?: { _id: string; name: string; key: string };
  invitedBy?: UserRef;
  expiresAt: string;
  createdAt: string;
}

export interface SearchResults {
  projects: Project[];
  tasks: Task[];
  issues: Issue[];
  workUpdates: WorkUpdate[];
  employees: User[];
  releases: Release[];
}
