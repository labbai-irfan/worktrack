export const PERMISSIONS = [
  'organization.view',
  'organization.manage',
  'employee.view',
  'employee.invite',
  'employee.manage',
  'employee.deactivate',
  'department.manage',
  'team.create',
  'team.manage',
  'project.create',
  'project.view',
  'project.update',
  'project.archive',
  'project.manage_members',
  'module.create',
  'module.manage',
  'milestone.manage',
  'task.create',
  'task.assign',
  'task.update',
  'task.delete',
  'work_update.create',
  'work_update.edit_own',
  'work_update.view_team',
  'work_update.review',
  'work_update.approve',
  'issue.create',
  'issue.assign',
  'issue.manage',
  'comment.create',
  'time.track',
  'time.manage',
  'report.submit',
  'report.review',
  'analytics.personal',
  'analytics.team',
  'analytics.organization',
  'release.create',
  'release.deploy',
  'file.manage',
  'audit.view',
  'search.use',
  'notification.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const EMPLOYEE_PERMISSIONS: Permission[] = [
  'organization.view',
  'employee.view',
  'project.view',
  'task.create',
  'task.update',
  'work_update.create',
  'work_update.edit_own',
  'issue.create',
  'comment.create',
  'time.track',
  'report.submit',
  'analytics.personal',
  'search.use',
  'notification.view',
];

const TEAM_LEAD_PERMISSIONS: Permission[] = [
  ...EMPLOYEE_PERMISSIONS,
  'task.assign',
  'work_update.view_team',
  'work_update.review',
  'issue.assign',
  'report.review',
  'analytics.team',
];

const PROJECT_MANAGER_PERMISSIONS: Permission[] = [
  ...TEAM_LEAD_PERMISSIONS,
  'project.create',
  'project.update',
  'project.archive',
  'project.manage_members',
  'module.create',
  'module.manage',
  'milestone.manage',
  'task.delete',
  'work_update.approve',
  'issue.manage',
  'release.create',
  'release.deploy',
  'file.manage',
  'team.manage',
];

const ORG_ADMIN_PERMISSIONS: Permission[] = [...PERMISSIONS];

const VIEWER_PERMISSIONS: Permission[] = [
  'organization.view',
  'project.view',
  'search.use',
  'notification.view',
];

/** Default roles seeded into every new organization. */
export const DEFAULT_ROLES: { key: string; name: string; permissions: Permission[]; isSystem: boolean }[] = [
  { key: 'org_admin', name: 'Organization Admin', permissions: ORG_ADMIN_PERMISSIONS, isSystem: true },
  { key: 'project_manager', name: 'Project Manager', permissions: PROJECT_MANAGER_PERMISSIONS, isSystem: true },
  { key: 'team_lead', name: 'Team Lead', permissions: TEAM_LEAD_PERMISSIONS, isSystem: true },
  { key: 'employee', name: 'Employee', permissions: EMPLOYEE_PERMISSIONS, isSystem: true },
  { key: 'viewer', name: 'Viewer', permissions: VIEWER_PERMISSIONS, isSystem: true },
];
