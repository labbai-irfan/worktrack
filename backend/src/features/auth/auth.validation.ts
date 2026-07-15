import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/[0-9]/, 'Password must include a number.');

export const registerSchema = z.object({
  organizationName: z.string().min(2).max(120),
  industry: z.string().max(80).optional().default(''),
  companySize: z.string().max(40).optional().default(''),
  country: z.string().max(80).optional().default(''),
  timezone: z.string().max(60).optional().default('UTC'),
  firstName: z.string().min(1).max(60),
  lastName: z.string().max(60).optional().default(''),
  email: z.string().email(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required.'),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({ email: z.string().email() });

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(10),
  firstName: z.string().min(1).max(60),
  lastName: z.string().max(60).optional().default(''),
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().max(60).optional(),
  displayName: z.string().min(1).max(120).optional(),
  jobTitle: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  timezone: z.string().max(60).optional(),
  workLocation: z.string().max(120).optional(),
  skills: z.array(z.string().max(40)).max(30).optional(),
  avatarUrl: z.string().url().or(z.literal('')).optional(),
});
