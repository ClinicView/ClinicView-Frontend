export type { Session, SessionUser } from '@/shared/session/types';

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}
