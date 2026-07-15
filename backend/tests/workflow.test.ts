/**
 * End-to-end API workflow: organization isolation, permission enforcement,
 * project/task creation, and the complete work-update review cycle
 * (draft → submit → changes requested → resubmit → approve).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb } from './setup';

let app: import('express').Express;

interface Actor {
  token: string;
  userId: string;
}

async function registerOrg(name: string, email: string): Promise<Actor & { orgId: string }> {
  const res = await request(app).post('/api/v1/auth/register').send({
    organizationName: name, firstName: 'Admin', lastName: 'User', email, password: 'StrongPass1x',
  });
  return { token: res.body.data.accessToken, userId: res.body.data.user._id, orgId: res.body.data.organization._id };
}

beforeAll(async () => {
  const uri = await startTestDb();
  const { connectDatabase } = await import('../src/config/db');
  await connectDatabase(uri);
  const { createApp } = await import('../src/app');
  app = createApp();
});

afterAll(async () => {
  const { disconnectDatabase } = await import('../src/config/db');
  await disconnectDatabase();
  await stopTestDb();
});

describe('work management workflow', () => {
  let orgA: Actor & { orgId: string };
  let orgB: Actor & { orgId: string };
  let employee: Actor;
  let projectId: string;
  let taskId: string;
  let updateId: string;

  it('sets up two organizations', async () => {
    orgA = await registerOrg('Org Alpha', 'admin@alpha.test');
    orgB = await registerOrg('Org Beta', 'admin@beta.test');
    expect(orgA.orgId).not.toBe(orgB.orgId);
  });

  it('admin creates a project with a module and a task', async () => {
    const proj = await request(app).post('/api/v1/projects')
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ name: 'HRMS Rebuild', key: 'HRMS', description: 'Internal HRMS' });
    expect(proj.status).toBe(201);
    projectId = proj.body.data._id;
    expect(proj.body.data.key).toBe('HRMS');

    const mod = await request(app).post('/api/v1/modules')
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ projectId, name: 'Attendance', key: 'ATT' });
    expect(mod.status).toBe(201);

    const task = await request(app).post('/api/v1/tasks')
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ projectId, title: 'Build check-in API', type: 'backend', priority: 'high' });
    expect(task.status).toBe(201);
    taskId = task.body.data._id;
    expect(task.body.data.number).toBe('HRMS-1');
  });

  it('cross-organization access is denied', async () => {
    const res = await request(app).get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${orgB.token}`);
    expect(res.status).toBe(404); // scoped query — the other org cannot even see it exists

    const taskRes = await request(app).patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${orgB.token}`)
      .send({ title: 'hijack' });
    expect(taskRes.status).toBe(404);
  });

  it('admin invites an employee who accepts and joins', async () => {
    const rolesRes = await request(app).get('/api/v1/organizations/roles')
      .set('Authorization', `Bearer ${orgA.token}`);
    const employeeRole = rolesRes.body.data.find((r: { key: string }) => r.key === 'employee');

    const invite = await request(app).post('/api/v1/employees/invite')
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ email: 'dev@alpha.test', name: 'Dev One', roleId: employeeRole._id });
    expect(invite.status).toBe(201);
    const token = new URL(invite.body.data.inviteUrl).searchParams.get('token')!;

    const accept = await request(app).post('/api/v1/auth/accept-invitation')
      .send({ token, firstName: 'Dev', lastName: 'One', password: 'StrongPass1x' });
    expect(accept.status).toBe(201);
    expect(accept.body.data.roleKey).toBe('employee');
    employee = { token: accept.body.data.accessToken, userId: accept.body.data.user._id };
  });

  it('employee permissions are enforced (cannot create projects)', async () => {
    const res = await request(app).post('/api/v1/projects')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ name: 'Rogue Project', key: 'RGE' });
    expect(res.status).toBe(403);
  });

  it('employee creates and submits a work update', async () => {
    const create = await request(app).post('/api/v1/work-updates')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        projectId, taskId,
        title: 'Implemented check-in endpoint with validation',
        workDate: new Date().toISOString(),
        workType: 'backend', progress: 70,
        implemented: 'POST /check-in with geo validation and duplicate-punch prevention.',
        time: { minutesSpent: 300 },
      });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe('draft');
    expect(create.body.data.number).toBe('UPD-1');
    updateId = create.body.data._id;

    const submit = await request(app).post(`/api/v1/work-updates/${updateId}/submit`)
      .set('Authorization', `Bearer ${employee.token}`);
    expect(submit.status).toBe(200);
    expect(submit.body.data.status).toBe('submitted');
  });

  it('author cannot approve their own update', async () => {
    const res = await request(app).post(`/api/v1/work-updates/${updateId}/review`)
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ action: 'approve' });
    expect(res.status).toBe(403);
  });

  it('manager requests changes, employee resubmits, manager approves', async () => {
    const changes = await request(app).post(`/api/v1/work-updates/${updateId}/review`)
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ action: 'request_changes', comment: 'Please add test coverage details.' });
    expect(changes.status).toBe(200);
    expect(changes.body.data.status).toBe('changes_requested');

    const edit = await request(app).patch(`/api/v1/work-updates/${updateId}`)
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ implemented: 'POST /check-in with geo validation; added 8 supertest cases.' });
    expect(edit.status).toBe(200);

    const resubmit = await request(app).post(`/api/v1/work-updates/${updateId}/submit`)
      .set('Authorization', `Bearer ${employee.token}`);
    expect(resubmit.status).toBe(200);

    const approve = await request(app).post(`/api/v1/work-updates/${updateId}/review`)
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ action: 'approve', comment: 'Great work.' });
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe('approved');
    expect(approve.body.data.reviewHistory.length).toBeGreaterThanOrEqual(4);
  });

  it('employee received a notification about the approval', async () => {
    const res = await request(app).get('/api/v1/notifications')
      .set('Authorization', `Bearer ${employee.token}`);
    expect(res.status).toBe(200);
    const types = res.body.data.map((n: { type: string }) => n.type);
    expect(types).toContain('work_approved');
  });

  it('issue lifecycle: create → transition → resolve requires resolution code', async () => {
    const create = await request(app).post('/api/v1/issues')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        projectId, title: 'Check-in fails on Safari', type: 'frontend_error', severity: 'high',
        error: { message: 'TypeError: geolocation undefined', requestPayload: '{"password":"secret123"}' },
        reproduction: { steps: 'Open Safari, click check-in', reproducible: 'yes' },
      });
    expect(create.status).toBe(201);
    const issueId = create.body.data._id;
    expect(create.body.data.number).toBe('BUG-1');
    // sensitive values in error payloads are redacted before persistence
    expect(create.body.data.error.requestPayload).not.toContain('secret123');

    const start = await request(app).post(`/api/v1/issues/${issueId}/transition`)
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ status: 'in_progress' });
    expect(start.status).toBe(200);

    const badResolve = await request(app).post(`/api/v1/issues/${issueId}/transition`)
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ status: 'resolved' });
    expect(badResolve.status).toBe(400); // invalid transition (must pass through fix/testing)

    const fix = await request(app).post(`/api/v1/issues/${issueId}/transition`)
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ status: 'fix_implemented' });
    expect(fix.status).toBe(200);
    const testing = await request(app).post(`/api/v1/issues/${issueId}/transition`)
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ status: 'testing' });
    expect(testing.status).toBe(200);

    const resolve = await request(app).post(`/api/v1/issues/${issueId}/transition`)
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ status: 'resolved', resolution: { code: 'fixed', fixSummary: 'Added Safari geolocation fallback.' } });
    expect(resolve.status).toBe(200);
    expect(resolve.body.data.resolvedAt).toBeTruthy();
  });

  it('daily report aggregates the day\'s work and prevents duplicates', async () => {
    const date = new Date().toISOString().slice(0, 10);
    const upsert1 = await request(app).post('/api/v1/reports/daily')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ date, nextDayPlan: 'Continue attendance module.' });
    expect(upsert1.status).toBe(200);
    expect(upsert1.body.data.workUpdateIds.length).toBeGreaterThanOrEqual(1);

    // Upsert is idempotent — still exactly one report for the day.
    await request(app).post('/api/v1/reports/daily')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ date, nextDayPlan: 'Updated plan.' });
    const listRes = await request(app).get(`/api/v1/reports/daily?from=${date}&to=${date}`)
      .set('Authorization', `Bearer ${employee.token}`);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].nextDayPlan).toBe('Updated plan.');
  });

  it('audit log records security-relevant actions (admin only)', async () => {
    const res = await request(app).get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${orgA.token}`);
    expect(res.status).toBe(200);
    const actions = res.body.data.map((l: { action: string }) => l.action);
    expect(actions).toContain('employee.invite');

    const denied = await request(app).get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${employee.token}`);
    expect(denied.status).toBe(403);
  });

  it('global search is organization-scoped', async () => {
    const inOrg = await request(app).get('/api/v1/search?q=HRMS')
      .set('Authorization', `Bearer ${orgA.token}`);
    expect(inOrg.status).toBe(200);
    expect(inOrg.body.data.projects.length).toBe(1);

    const otherOrg = await request(app).get('/api/v1/search?q=HRMS')
      .set('Authorization', `Bearer ${orgB.token}`);
    expect(otherOrg.body.data.projects.length).toBe(0);
  });
});
