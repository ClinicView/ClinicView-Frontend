const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export async function logoutRequest(accessToken: string, refreshToken: string): Promise<void> {
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
}
