// API pública del feature auth — importar desde aquí, nunca desde internals.
export { SessionProvider } from './context/session-context';
export { useLogin } from './hooks/use-login';
export { useSession } from './hooks/use-session';
export { LoginForm } from './components/login-form';
export type { Session, SessionUser, TokenResponse } from './types';
