import { redirect } from 'next/navigation';

// Redirige a /dashboard; si no hay sesión activa, el layout privado redirige a /login.
export default function RootPage() {
  redirect('/dashboard');
}
