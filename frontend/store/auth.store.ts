import { create } from 'zustand';
import api from '@/lib/api';
import type { StaffUser, Organization } from '@/lib/types';

interface AuthState {
  user: StaffUser | null;
  organization: Organization | null;
  token: string | null;
  initialized: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (data: {
    orgName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
  init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  organization: null,
  token: null,
  initialized: false,

  init: async () => {
    const token =
      localStorage.getItem('token') ||
      sessionStorage.getItem('token');

    if (!token) {
      set({
        user: null,
        organization: null,
        token: null,
        initialized: true,
      });
      return;
    }

    try {
      const { data: user } = await api.get<StaffUser>('/v1/users/me');
      const { data: organization } = await api.get<Organization>(
        `/v1/organizations/${user.organizationId}`,
      );

      set({
        user,
        organization,
        token,
        initialized: true,
      });
    } catch {
      get().logout();
    }
  },

  login: async (email, password, remember = false) => {
    const { data } = await api.post<{ accessToken: string }>('/v1/auth/login', {
      email,
      password,
    });

    localStorage.removeItem('token');
    sessionStorage.removeItem('token');

    if (remember) {
      localStorage.setItem('token', data.accessToken);
    } else {
      sessionStorage.setItem('token', data.accessToken);
    }

    await get().init();
  },

  register: async (payload) => {
    const { data } = await api.post<{ accessToken: string }>(
      '/v1/auth/register',
      payload,
    );

    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.setItem('token', data.accessToken);

    await get().init();
  },

  logout: () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('user');

    set({
      user: null,
      organization: null,
      token: null,
      initialized: true,
    });
  },
}));
