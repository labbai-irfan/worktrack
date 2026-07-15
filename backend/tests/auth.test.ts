import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb } from './setup';

let app: import('express').Express;

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

const registration = {
  organizationName: 'Acme Corp',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@acme.test',
  password: 'StrongPass1x',
};

describe('authentication', () => {
  it('registers an organization and admin account', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(registration);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.organization.name).toBe('Acme Corp');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    // refresh token cookie is httpOnly
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('wt_refresh=') && c.includes('HttpOnly'))).toBe(true);
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(registration);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects weak passwords with field-level errors', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registration, email: 'other@acme.test', organizationName: 'Other', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors.some((e: { field: string }) => e.field === 'password')).toBe(true);
  });

  it('logs in with valid credentials and returns permissions', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: registration.email, password: registration.password });
    expect(res.status).toBe(200);
    expect(res.body.data.roleKey).toBe('org_admin');
    expect(res.body.data.permissions).toContain('organization.manage');
  });

  it('rejects invalid credentials with a uniform message', async () => {
    const bad = await request(app).post('/api/v1/auth/login').send({ email: registration.email, password: 'WrongPass1x' });
    const missing = await request(app).post('/api/v1/auth/login').send({ email: 'ghost@acme.test', password: 'WrongPass1x' });
    expect(bad.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(bad.body.message).toBe(missing.body.message); // prevents user enumeration
  });

  it('rotates refresh tokens on /refresh', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: registration.email, password: registration.password });
    const cookie = (login.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('wt_refresh='))!;

    const refresh1 = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refresh1.status).toBe(200);
    expect(refresh1.body.data.accessToken).toBeTruthy();

    // Old token was rotated out — reusing it must fail.
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(replay.status).toBe(401);
  });

  it('requires authentication for protected routes', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user on /me with a valid token', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: registration.email, password: registration.password });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(registration.email);
  });
});
