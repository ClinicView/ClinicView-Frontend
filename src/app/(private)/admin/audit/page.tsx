import { AuditEventsView } from '@/features/audit';
import { RequirePermissions } from '@/shared/guards/require-permissions';

export const metadata = {
  title: 'Auditoría',
};

export default function AuditPage() {
  return (
    <RequirePermissions
      allOf={['admin.audit.read']}
      title="Auditoría restringida"
      description="Tu rol no tiene permiso para consultar los eventos técnicos del sistema."
    >
      <AuditEventsView />
    </RequirePermissions>
  );
}

