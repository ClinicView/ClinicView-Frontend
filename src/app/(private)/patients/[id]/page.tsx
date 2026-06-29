import { PatientView } from './patient-view';

export const metadata = { title: 'Detalle de paciente — Plataforma Clínica' };

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientView id={id} />;
}
