// Auth calls no usan api-client (son públicas, sin Bearer token).
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

import type { TokenResponse } from '../types';

export const authService = {
  async login(email: string, password: string): Promise<TokenResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('login_failed');
    return res.json() as Promise<TokenResponse>;
  },

  async refresh(refreshToken: string): Promise<TokenResponse> {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) throw new Error('refresh_failed');
    return res.json() as Promise<TokenResponse>;
  },

  async logout(accessToken: string, refreshToken: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Si falla la red, la sesión local se limpia igualmente
    }
  },
};
