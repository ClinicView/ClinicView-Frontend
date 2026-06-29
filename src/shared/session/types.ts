export interface SessionUser {
  sub: string;
  email: string;
  permissions: string[];
}

export interface Session {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}
