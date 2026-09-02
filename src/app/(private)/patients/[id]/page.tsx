import { PatientView } from './patient-view';

export const metadata = { title: 'Detalle de paciente' };

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientView id={id} />;
}
