import { RecordView } from './record-view';

export default async function RecordPage({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const { id, recordId } = await params;
  return <RecordView patientId={id} recordId={recordId} />;
}
