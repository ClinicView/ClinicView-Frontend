import { RequireAuth } from '@/shared/guards/require-auth';

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
