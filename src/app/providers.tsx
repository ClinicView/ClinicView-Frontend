'use client';

import { SessionProvider } from '@/features/auth';

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
