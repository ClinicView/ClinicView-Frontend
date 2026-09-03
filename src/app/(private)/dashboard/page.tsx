import type { Metadata } from 'next';
import { RequirePermissions } from '@/shared/guards/require-permissions';
import { DashboardView } from './dashboard-view';

export const metadata: Metadata = { title: 'Inicio' };

export default function DashboardPage() {
  return (
    <RequirePermissions allOf={['patients.read', 'documents.read']}>
      <DashboardView />
    </RequirePermissions>
  );
}
