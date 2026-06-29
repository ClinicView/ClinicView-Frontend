import { NewRecordView } from './new-record-view';

export default async function NewRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NewRecordView patientId={id} />;
}
