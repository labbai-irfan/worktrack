/**
 * Idempotent development seed. Creates the "WiseTech Demo" workspace with
 * realistic projects, modules, tasks, work updates, issues, comments,
 * reports, releases, and notifications.
 *
 * Run: npm run seed   (development only — refuses to run in production)
 */
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { logger } from '../config/logger';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Department } from '../models/Department';
import { Team } from '../models/Team';
import { Project } from '../models/Project';
import { ProjectModule } from '../models/Module';
import { Milestone } from '../models/Milestone';
import { Task } from '../models/Task';
import { WorkUpdate } from '../models/WorkUpdate';
import { Issue } from '../models/Issue';
import { Comment } from '../models/Comment';
import { DailyReport } from '../models/DailyReport';
import { Notification } from '../models/Notification';
import { Release } from '../models/Release';
import { Activity } from '../models/Activity';
import { nextIdentifier } from '../utils/counters';
import { DEFAULT_ROLES } from '../constants/permissions';

const SEED_SLUG = 'wisetech-demo';
// Development-only credentials. Documented in the README; never use in production.
const PASSWORD = 'WorkTrack@2026';

function daysAgo(n: number, hour = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function seed() {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production environment.');
  }
  await connectDatabase();

  const existing = await Organization.findOne({ slug: SEED_SLUG });
  if (existing) {
    logger.info('Seed organization already exists — wiping and re-seeding demo data.');
    const orgId = existing._id;
    await Promise.all([
      User.deleteMany({ organizationId: orgId }), Role.deleteMany({ organizationId: orgId }),
      Department.deleteMany({ organizationId: orgId }), Team.deleteMany({ organizationId: orgId }),
      Project.deleteMany({ organizationId: orgId }), ProjectModule.deleteMany({ organizationId: orgId }),
      Milestone.deleteMany({ organizationId: orgId }), Task.deleteMany({ organizationId: orgId }),
      WorkUpdate.deleteMany({ organizationId: orgId }), Issue.deleteMany({ organizationId: orgId }),
      Comment.deleteMany({ organizationId: orgId }), DailyReport.deleteMany({ organizationId: orgId }),
      Notification.deleteMany({ organizationId: orgId }), Release.deleteMany({ organizationId: orgId }),
      Activity.deleteMany({ organizationId: orgId }),
    ]);
    const { Counter } = await import('../models/Counter');
    await Counter.deleteMany({ organizationId: orgId });
    await Organization.deleteOne({ _id: orgId });
  }

  const org = await Organization.create({
    name: 'WiseTech Demo',
    slug: SEED_SLUG,
    industry: 'Software & IT Services',
    companySize: '11-50',
    country: 'India',
    timezone: 'Asia/Kolkata',
  });
  const orgId = org._id;

  const roles = await Role.insertMany(DEFAULT_ROLES.map((r) => ({ ...r, organizationId: orgId })));
  const roleBy = (key: string) => roles.find((r) => r.key === key)!._id;

  const [devDept, designDept, mgmtDept, qaDept] = await Department.insertMany([
    { organizationId: orgId, name: 'Development' },
    { organizationId: orgId, name: 'Design' },
    { organizationId: orgId, name: 'Management' },
    { organizationId: orgId, name: 'Quality Assurance' },
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const mkUser = async (email: string, first: string, last: string, roleKey: string, title: string, deptId: Types.ObjectId, skills: string[]) =>
    User.create({
      organizationId: orgId, email, passwordHash,
      firstName: first, lastName: last, displayName: `${first} ${last}`,
      roleId: roleBy(roleKey), jobTitle: title, departmentId: deptId,
      employeeCode: await nextIdentifier(orgId, 'employee', 'EMP'),
      status: 'active', joiningDate: daysAgo(400), emailVerifiedAt: new Date(), skills,
    });

  const admin = await mkUser('admin@wisetech.dev', 'Anita', 'Rao', 'org_admin', 'Head of Engineering', mgmtDept._id, ['Architecture', 'Leadership']);
  const manager = await mkUser('manager@wisetech.dev', 'Rahul', 'Mehta', 'project_manager', 'Project Manager', mgmtDept._id, ['Agile', 'Delivery']);
  const lead = await mkUser('lead@wisetech.dev', 'Sneha', 'Iyer', 'team_lead', 'Frontend Team Lead', devDept._id, ['React', 'TypeScript']);
  const dev1 = await mkUser('priya@wisetech.dev', 'Priya', 'Sharma', 'employee', 'Full-Stack Developer', devDept._id, ['Node.js', 'MongoDB', 'React']);
  const dev2 = await mkUser('arjun@wisetech.dev', 'Arjun', 'Patel', 'employee', 'Backend Developer', devDept._id, ['Express', 'Redis', 'AWS']);
  const designer = await mkUser('kavya@wisetech.dev', 'Kavya', 'Nair', 'employee', 'UI/UX Designer', designDept._id, ['Figma', 'Design Systems']);
  const qa = await mkUser('vikram@wisetech.dev', 'Vikram', 'Singh', 'employee', 'QA Engineer', qaDept._id, ['Playwright', 'API Testing']);

  await Team.insertMany([
    { organizationId: orgId, name: 'Frontend', departmentId: devDept._id, leadId: lead._id, memberIds: [lead._id, dev1._id, designer._id] },
    { organizationId: orgId, name: 'Backend', departmentId: devDept._id, leadId: manager._id, memberIds: [dev1._id, dev2._id] },
    { organizationId: orgId, name: 'UI/UX', departmentId: designDept._id, leadId: designer._id, memberIds: [designer._id] },
    { organizationId: orgId, name: 'QA', departmentId: qaDept._id, leadId: qa._id, memberIds: [qa._id] },
  ]);

  await User.updateMany({ organizationId: orgId, _id: { $in: [dev1._id, dev2._id] } }, { managerId: manager._id });
  await User.updateMany({ organizationId: orgId, _id: lead._id }, { managerId: manager._id });

  // --- Projects ---
  const hrms = await Project.create({
    organizationId: orgId, name: 'WiseTech HRMS', key: 'WTH', slug: 'wisetech-hrms',
    description: 'Human resource management system covering attendance, payroll, leave, and employee lifecycle.',
    managerId: manager._id, status: 'active', priority: 'high', health: 'attention', progress: 62,
    startDate: daysAgo(180), targetDate: daysAgo(-60), color: '#4f46e5', icon: 'users',
    repositoryUrl: 'https://github.com/wisetech/hrms',
    stagingUrl: 'https://staging.hrms.wisetech.dev', tags: ['hrms', 'internal'],
    members: [
      { userId: manager._id, role: 'manager' }, { userId: lead._id, role: 'lead' },
      { userId: dev1._id, role: 'member' }, { userId: dev2._id, role: 'member' },
      { userId: designer._id, role: 'member' }, { userId: qa._id, role: 'member' },
    ],
    createdBy: admin._id,
  });

  const store = await Project.create({
    organizationId: orgId, name: 'PPD Store', key: 'PPD', slug: 'ppd-store',
    description: 'E-commerce storefront and admin panel for PPD retail client.',
    managerId: manager._id, status: 'active', priority: 'medium', health: 'healthy', progress: 38,
    startDate: daysAgo(90), targetDate: daysAgo(-120), color: '#0891b2', icon: 'shopping-cart',
    repositoryUrl: 'https://github.com/wisetech/ppd-store', tags: ['client', 'ecommerce'],
    members: [
      { userId: manager._id, role: 'manager' }, { userId: dev2._id, role: 'member' },
      { userId: designer._id, role: 'member' }, { userId: qa._id, role: 'member' },
    ],
    createdBy: admin._id,
  });

  // --- Modules ---
  const moduleDefs: [string, string, string][] = [
    ['Leads', 'LEADS', '#f59e0b'], ['Projects', 'PROJ', '#4f46e5'], ['Calendar', 'CAL', '#10b981'],
    ['Meetings', 'MEET', '#8b5cf6'], ['Attendance', 'ATT', '#ef4444'], ['Biometric', 'BIO', '#6b7280'],
    ['Salary', 'SAL', '#059669'], ['Payroll', 'PAY', '#0d9488'], ['Holidays', 'HOL', '#f97316'],
    ['Employees', 'EMP', '#3b82f6'], ['Billing', 'BILL', '#dc2626'], ['Dashboard', 'DASH', '#7c3aed'],
  ];
  const modules = await ProjectModule.insertMany(
    moduleDefs.map(([name, key, color], i) => ({
      organizationId: orgId, projectId: hrms._id, name, key, color,
      ownerId: i % 2 === 0 ? dev1._id : dev2._id,
      memberIds: [dev1._id, dev2._id, lead._id],
      status: 'active', progress: 20 + ((i * 13) % 70),
      description: `${name} module of the WiseTech HRMS platform.`,
      createdBy: manager._id,
    }))
  );
  const moduleBy = (key: string) => modules.find((m) => m.key === key)!;

  const storeModules = await ProjectModule.insertMany([
    { organizationId: orgId, projectId: store._id, name: 'Catalog', key: 'CAT', color: '#0891b2', ownerId: dev2._id, status: 'active', progress: 55, createdBy: manager._id },
    { organizationId: orgId, projectId: store._id, name: 'Checkout', key: 'CHK', color: '#059669', ownerId: dev2._id, status: 'active', progress: 30, createdBy: manager._id },
    { organizationId: orgId, projectId: store._id, name: 'Admin Panel', key: 'ADM', color: '#7c3aed', ownerId: designer._id, status: 'planned', progress: 10, createdBy: manager._id },
  ]);

  await Milestone.insertMany([
    { organizationId: orgId, projectId: hrms._id, name: 'Payroll GA', description: 'Payroll + salary slips production-ready', dueDate: daysAgo(-30), status: 'in_progress', progress: 70, createdBy: manager._id },
    { organizationId: orgId, projectId: hrms._id, name: 'Attendance v2', description: 'Biometric sync and geo check-in', dueDate: daysAgo(-75), status: 'planned', progress: 15, createdBy: manager._id },
    { organizationId: orgId, projectId: store._id, name: 'Soft Launch', dueDate: daysAgo(-45), status: 'in_progress', progress: 40, createdBy: manager._id },
  ]);

  // --- Tasks ---
  const mkTask = async (projectKey: 'WTH' | 'PPD', projectId: Types.ObjectId, data: Record<string, unknown> & { title: string }) => {
    const [doc] = await Task.create([
      {
        organizationId: orgId, projectId,
        number: await nextIdentifier(orgId, `task:${projectKey}`, projectKey),
        reporterId: manager._id, createdBy: manager._id,
        ...data,
      },
    ]);
    return doc;
  };

  const t1 = await mkTask('WTH', hrms._id, {
    title: 'Build salary slip PDF generation', moduleId: moduleBy('SAL')._id, type: 'backend',
    status: 'in_progress', priority: 'high', assigneeId: dev1._id, dueDate: daysAgo(-5),
    estimatedHours: 16, progress: 60, labels: ['payroll'],
    description: 'Generate monthly salary slips as PDFs with organization branding and email delivery.',
    checklist: [{ text: 'Template design', done: true }, { text: 'PDF renderer', done: true }, { text: 'Email delivery', done: false }],
  });
  const t2 = await mkTask('WTH', hrms._id, {
    title: 'Attendance regularization approval flow', moduleId: moduleBy('ATT')._id, type: 'feature',
    status: 'under_review', priority: 'medium', assigneeId: dev2._id, reviewerId: lead._id,
    dueDate: daysAgo(-2), progress: 90,
  });
  const t3 = await mkTask('WTH', hrms._id, {
    title: 'Leads kanban drag-and-drop reordering', moduleId: moduleBy('LEADS')._id, type: 'frontend',
    status: 'todo', priority: 'medium', assigneeId: lead._id, dueDate: daysAgo(-10),
  });
  const t4 = await mkTask('WTH', hrms._id, {
    title: 'Fix biometric sync duplicate punches', moduleId: moduleBy('BIO')._id, type: 'bug',
    status: 'blocked', priority: 'urgent', assigneeId: dev2._id, dueDate: daysAgo(1),
    blockedReason: 'Waiting for vendor API credentials for the staging device.',
  });
  const t5 = await mkTask('WTH', hrms._id, {
    title: 'Holiday calendar 2026 data entry UI', moduleId: moduleBy('HOL')._id, type: 'ui_ux',
    status: 'completed', priority: 'low', assigneeId: designer._id, completedAt: daysAgo(3), progress: 100,
  });
  const t6 = await mkTask('PPD', store._id, {
    title: 'Product listing page with filters', moduleId: storeModules[0]._id, type: 'frontend',
    status: 'in_progress', priority: 'high', assigneeId: dev2._id, dueDate: daysAgo(-7), progress: 45,
  });
  const t7 = await mkTask('PPD', store._id, {
    title: 'Payment gateway integration (Razorpay)', moduleId: storeModules[1]._id, type: 'api',
    status: 'planned', priority: 'urgent', assigneeId: dev2._id, dueDate: daysAgo(-14),
  });
  await mkTask('WTH', hrms._id, {
    title: 'Dashboard KPI cards responsive layout', moduleId: moduleBy('DASH')._id, type: 'ui_ux',
    status: 'testing', priority: 'medium', assigneeId: designer._id, reviewerId: qa._id, progress: 85,
  });

  // --- Issues ---
  const i1 = await Issue.create({
    organizationId: orgId, projectId: hrms._id, moduleId: moduleBy('PAY')._id,
    number: await nextIdentifier(orgId, 'issue', 'BUG'),
    title: 'Payroll run fails for employees joined mid-month',
    description: 'Pro-rata calculation throws a division error when joining date falls on a month boundary.',
    type: 'backend_error', severity: 'critical', priority: 'urgent', status: 'in_progress',
    reporterId: qa._id, assigneeId: dev1._id, environment: 'staging',
    error: {
      message: 'TypeError: Cannot read properties of undefined (reading "workingDays")',
      apiEndpoint: '/api/v1/payroll/run', httpMethod: 'POST', responseStatus: '500',
      occurrenceCount: 6, firstSeenAt: daysAgo(4), lastSeenAt: daysAgo(1),
    },
    reproduction: { steps: '1. Add employee joining on the 15th\n2. Run payroll for that month', expected: 'Pro-rata salary computed', actual: '500 error', frequency: 'always', reproducible: 'yes' },
    history: [{ action: 'created', byId: qa._id, to: 'open', at: daysAgo(4) }, { action: 'status_changed', byId: manager._id, from: 'open', to: 'in_progress', at: daysAgo(3) }],
    createdBy: qa._id,
  });
  const i2 = await Issue.create({
    organizationId: orgId, projectId: hrms._id, moduleId: moduleBy('ATT')._id,
    number: await nextIdentifier(orgId, 'issue', 'BUG'),
    title: 'Attendance report timezone off by one day',
    type: 'data_issue', severity: 'high', priority: 'high', status: 'resolved',
    reporterId: dev1._id, assigneeId: dev2._id, environment: 'production',
    resolvedAt: daysAgo(2),
    resolution: { rootCause: 'Dates stored in local time instead of UTC.', fixSummary: 'Normalized attendance timestamps to UTC and convert at render time.', code: 'fixed', testingPerformed: 'Regression run on attendance exports across 3 timezones.' },
    history: [{ action: 'created', byId: dev1._id, to: 'open', at: daysAgo(9) }, { action: 'status_changed', byId: dev2._id, from: 'testing', to: 'resolved', at: daysAgo(2) }],
    createdBy: dev1._id,
  });
  await Issue.create({
    organizationId: orgId, projectId: store._id, moduleId: storeModules[1]._id,
    number: await nextIdentifier(orgId, 'issue', 'BUG'),
    title: 'Cart total not updating after coupon removal',
    type: 'ui_issue', severity: 'medium', priority: 'medium', status: 'open',
    reporterId: qa._id, environment: 'staging',
    reproduction: { steps: 'Apply coupon, remove it, observe total', expected: 'Total reverts', actual: 'Discount persists until refresh', frequency: 'always', reproducible: 'yes' },
    history: [{ action: 'created', byId: qa._id, to: 'open', at: daysAgo(1) }],
    createdBy: qa._id,
  });

  // --- Work updates over the past two weeks ---
  const mkUpdate = async (user: typeof dev1, day: number, data: Record<string, unknown>) =>
    WorkUpdate.create({
      organizationId: orgId, userId: user._id, createdBy: user._id,
      number: await nextIdentifier(orgId, 'work_update', 'UPD'),
      workDate: daysAgo(day),
      ...data,
    });

  await mkUpdate(dev1, 0, {
    projectId: hrms._id, moduleId: moduleBy('SAL')._id, taskId: t1._id,
    title: 'Salary slip PDF template + renderer wired to payroll data',
    workType: 'backend', progressStatus: 'in_progress', progress: 60, status: 'submitted', submittedAt: daysAgo(0, 18),
    planned: 'Finish the PDF renderer and connect payroll aggregates.',
    implemented: 'Built the PDF layout with org branding, wired earnings/deductions tables, added per-employee generation endpoint.',
    remaining: 'Email delivery and bulk generation queue.',
    blockers: '', nextAction: 'Add email delivery via the mailer service.',
    time: { startTime: '09:30', endTime: '18:00', breakMinutes: 45, minutesSpent: 465, billable: true, source: 'manual' },
    technical: { environment: 'development', repository: 'wisetech/hrms', branch: 'feat/salary-slip-pdf', commitHash: 'a3f8c21', pullRequestUrl: 'https://github.com/wisetech/hrms/pull/142' },
    reviewHistory: [{ action: 'submitted', byId: dev1._id, comment: '', at: daysAgo(0, 18) }],
  });
  await mkUpdate(dev1, 1, {
    projectId: hrms._id, moduleId: moduleBy('PAY')._id, issueId: i1._id,
    title: 'Root-caused mid-month payroll crash',
    workType: 'bug_fix', progressStatus: 'in_progress', progress: 40, status: 'approved',
    implemented: 'Traced the crash to missing working-days config for partial months; wrote failing test reproducing it.',
    blockers: 'Need product decision: round pro-rata to nearest day or half-day?',
    assistanceRequired: 'Product decision on rounding rules.',
    time: { minutesSpent: 380, billable: true, source: 'manual' },
    review: { reviewerId: manager._id, comment: 'Good analysis. Rounding: nearest half-day.', reviewedAt: daysAgo(1, 19), approvedAt: daysAgo(1, 19) },
    reviewHistory: [
      { action: 'submitted', byId: dev1._id, comment: '', at: daysAgo(1, 18) },
      { action: 'approved', byId: manager._id, comment: 'Good analysis. Rounding: nearest half-day.', at: daysAgo(1, 19) },
    ],
    submittedAt: daysAgo(1, 18),
  });
  await mkUpdate(dev2, 0, {
    projectId: hrms._id, moduleId: moduleBy('ATT')._id, taskId: t2._id,
    title: 'Attendance regularization approvals — manager UI complete',
    workType: 'feature', progressStatus: 'under_review', progress: 90, status: 'under_review', submittedAt: daysAgo(0, 17),
    implemented: 'Approval queue with bulk approve/reject, reason capture, and notification hooks.',
    remaining: 'Edge case: overlapping regularization windows.',
    time: { minutesSpent: 420, billable: true, source: 'timer' },
    technical: { branch: 'feat/att-regularization', commitHash: 'e91b774' },
    reviewHistory: [
      { action: 'submitted', byId: dev2._id, comment: '', at: daysAgo(0, 17) },
      { action: 'review_started', byId: lead._id, comment: '', at: daysAgo(0, 18) },
    ],
  });
  await mkUpdate(dev2, 2, {
    projectId: store._id, moduleId: storeModules[0]._id, taskId: t6._id,
    title: 'Catalog filters: price range, brand, availability',
    workType: 'frontend', progressStatus: 'in_progress', progress: 45, status: 'changes_requested',
    implemented: 'Filter sidebar with URL-synced state; server-side filter queries.',
    remaining: 'Mobile filter drawer + empty states.',
    review: { reviewerId: manager._id, comment: 'Please add debounce on the price slider and loading skeletons before resubmitting.', reviewedAt: daysAgo(1, 12) },
    reviewHistory: [
      { action: 'submitted', byId: dev2._id, comment: '', at: daysAgo(2, 18) },
      { action: 'changes_requested', byId: manager._id, comment: 'Add debounce on price slider and loading skeletons.', at: daysAgo(1, 12) },
    ],
    submittedAt: daysAgo(2, 18),
    time: { minutesSpent: 330, billable: true, source: 'manual' },
  });
  await mkUpdate(designer, 3, {
    projectId: hrms._id, moduleId: moduleBy('HOL')._id, taskId: t5._id,
    title: 'Holiday calendar admin UI — final polish',
    workType: 'ui_ux', progressStatus: 'completed', progress: 100, status: 'approved',
    implemented: 'Year switcher, regional holiday groups, bulk import from CSV, dark-mode audit.',
    outcome: 'Module shipped to staging; product sign-off received.',
    review: { reviewerId: manager._id, comment: 'Clean work — shipping it.', reviewedAt: daysAgo(2, 11), approvedAt: daysAgo(2, 11) },
    reviewHistory: [
      { action: 'submitted', byId: designer._id, comment: '', at: daysAgo(3, 18) },
      { action: 'approved', byId: manager._id, comment: 'Clean work — shipping it.', at: daysAgo(2, 11) },
    ],
    submittedAt: daysAgo(3, 18),
    time: { minutesSpent: 300, source: 'manual' },
  });
  await mkUpdate(qa, 1, {
    projectId: hrms._id, moduleId: moduleBy('PAY')._id,
    title: 'Payroll regression suite — mid-month joiners',
    workType: 'testing', progressStatus: 'in_progress', progress: 50, status: 'approved',
    implemented: 'Added 14 API test cases around pro-rata payroll; found BUG for mid-month joiners.',
    review: { reviewerId: manager._id, comment: 'Nice catch on the joiner bug.', reviewedAt: daysAgo(0, 10), approvedAt: daysAgo(0, 10) },
    reviewHistory: [
      { action: 'submitted', byId: qa._id, comment: '', at: daysAgo(1, 17) },
      { action: 'approved', byId: manager._id, comment: 'Nice catch on the joiner bug.', at: daysAgo(0, 10) },
    ],
    submittedAt: daysAgo(1, 17),
    time: { minutesSpent: 400, source: 'manual' },
  });
  // Historical volume for charts
  for (let day = 4; day <= 14; day++) {
    const author = [dev1, dev2, designer, qa][day % 4];
    const mod = modules[day % modules.length];
    await mkUpdate(author, day, {
      projectId: hrms._id, moduleId: mod._id,
      title: `${mod.name} — iteration ${15 - day}`,
      workType: ['backend', 'frontend', 'ui_ux', 'testing'][day % 4],
      progressStatus: 'completed', progress: 100, status: 'approved',
      implemented: `Completed planned ${mod.name.toLowerCase()} work for the day: refactors, fixes, and small enhancements.`,
      review: { reviewerId: manager._id, reviewedAt: daysAgo(day - 1), approvedAt: daysAgo(day - 1), comment: 'Approved.' },
      reviewHistory: [
        { action: 'submitted', byId: author._id, comment: '', at: daysAgo(day, 18) },
        { action: 'approved', byId: manager._id, comment: 'Approved.', at: daysAgo(day - 1, 10) },
      ],
      submittedAt: daysAgo(day, 18),
      time: { minutesSpent: 300 + (day * 17) % 180, source: 'manual' },
    });
  }

  // --- Comments ---
  const wu = await WorkUpdate.findOne({ organizationId: orgId, taskId: t2._id });
  await Comment.insertMany([
    { organizationId: orgId, entityType: 'work_update', entityId: wu!._id, authorId: lead._id, body: 'Looks solid. Does bulk-reject also capture a reason per record?', mentionIds: [dev2._id] },
    { organizationId: orgId, entityType: 'work_update', entityId: wu!._id, authorId: dev2._id, body: 'Yes — reason is required for both single and bulk rejections.', reactions: [{ emoji: '👍', userIds: [lead._id] }] },
    { organizationId: orgId, entityType: 'issue', entityId: i1._id, authorId: manager._id, body: 'This blocks the payroll GA milestone — top priority this week.', pinned: true },
    { organizationId: orgId, entityType: 'task', entityId: t4._id, authorId: dev2._id, body: 'Vendor promised staging credentials by Friday. Escalating if not received.' },
  ]);

  // --- Daily reports ---
  for (const [user, blockersText] of [[dev1, ''], [dev2, 'Waiting on biometric vendor credentials.'], [qa, '']] as const) {
    const updates = await WorkUpdate.find({ organizationId: orgId, userId: user._id, workDate: { $gte: daysAgo(1, 0) }, status: { $ne: 'draft' } }).lean();
    await DailyReport.create({
      organizationId: orgId, userId: user._id, date: dateStr(daysAgo(1)),
      projectIds: [...new Set(updates.map((u) => String(u.projectId)))],
      workUpdateIds: updates.map((u) => u._id),
      issuesCreated: 0, issuesResolved: user === dev2 ? 1 : 0,
      totalMinutes: updates.reduce((s, u) => s + (u.time?.minutesSpent ?? 0), 0),
      blockers: blockersText,
      nextDayPlan: 'Continue current sprint items.',
      status: 'submitted', submittedAt: daysAgo(1, 19),
    });
  }

  // --- Release ---
  await Release.create({
    organizationId: orgId, projectId: hrms._id, version: 'v2.4.0', name: 'Attendance & Holidays',
    environment: 'production', status: 'deployed', managerId: manager._id,
    releaseDate: daysAgo(6), deployedAt: daysAgo(6),
    taskIds: [t5._id], issueIds: [i2._id],
    notes: { features: 'Holiday calendar admin, regional groups', bugFixes: 'Attendance timezone fix', rollbackPlan: 'Revert to v2.3.2 image; no schema changes.' },
    git: { repository: 'wisetech/hrms', branch: 'release/2.4.0', commitHash: 'f4d2e19' },
    createdBy: manager._id,
  });

  // --- Notifications ---
  await Notification.insertMany([
    { organizationId: orgId, userId: manager._id, actorId: dev1._id, type: 'work_submitted', title: 'Priya Sharma submitted UPD for review', entityType: 'work_update', link: '/work-updates' },
    { organizationId: orgId, userId: dev2._id, actorId: manager._id, type: 'work_changes_requested', title: 'Changes requested on your catalog filters update', entityType: 'work_update', link: '/work-updates' },
    { organizationId: orgId, userId: dev1._id, actorId: manager._id, type: 'issue_assigned', title: `Rahul Mehta assigned you ${i1.number}`, entityType: 'issue', entityId: i1._id, link: `/issues/${i1._id}` },
  ]);

  // --- Activity ---
  await Activity.insertMany([
    { organizationId: orgId, projectId: hrms._id, actorId: manager._id, action: 'project.created', entityType: 'project', entityId: hrms._id, entityLabel: 'WiseTech HRMS', link: `/projects/${hrms._id}`, createdAt: daysAgo(180) },
    { organizationId: orgId, projectId: hrms._id, actorId: dev1._id, action: 'work_update.submitted', entityType: 'work_update', entityId: wu!._id, entityLabel: 'Salary slip PDF', link: '/work-updates', createdAt: daysAgo(0, 18) },
    { organizationId: orgId, projectId: hrms._id, actorId: manager._id, action: 'release.deployed', entityType: 'release', entityId: hrms._id, entityLabel: 'v2.4.0', newValue: 'production', createdAt: daysAgo(6) },
  ]);

  logger.info('--------------------------------------------------');
  logger.info('Seed complete. Development accounts (password for all: %s):', PASSWORD);
  for (const u of [admin, manager, lead, dev1, dev2, designer, qa]) {
    logger.info('  %s — %s', u.email, u.jobTitle);
  }
  logger.info('--------------------------------------------------');

  await disconnectDatabase();
}

seed().catch(async (err) => {
  logger.error({ err }, 'Seed failed');
  await disconnectDatabase();
  process.exit(1);
});
