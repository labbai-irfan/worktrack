import { create } from 'zustand';
import type { Organization, User } from '@/types';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  organization: Organization | null;
  permissions: string[];
  roleKey: string | null;
  hydrated: boolean;
  setSession: (s: { accessToken: string; user: User; organization: Organization | null; permissions: string[]; roleKey: string | null }) => void;
  setUser: (user: User) => void;
  setOrganization: (organization: Organization) => void;
  setHydrated: () => void;
  clearSession: () => void;
  can: (...permissions: string[]) => boolean;
}

/**
 * Access token lives in memory only (never persisted); the session is
 * restored on load through the httpOnly refresh cookie. Permission checks
 * here are UI conveniences — the backend enforces authorization.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  organization: null,
  permissions: [],
  roleKey: null,
  hydrated: false,
  setSession: ({ accessToken, user, organization, permissions, roleKey }) =>
    set({ accessToken, user, organization, permissions, roleKey, hydrated: true }),
  setUser: (user) => set({ user }),
  setOrganization: (organization) => set({ organization }),
  setHydrated: () => set({ hydrated: true }),
  clearSession: () => set({ accessToken: null, user: null, organization: null, permissions: [], roleKey: null, hydrated: true }),
  can: (...permissions) => {
    const { permissions: mine, roleKey } = get();
    if (roleKey === 'org_admin' || roleKey === 'super_admin') return true;
    return permissions.some((p) => mine.includes(p));
  },
}));
