import { EditPatientView } from './edit-patient-view';

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditPatientView patientId={id} />;
}
