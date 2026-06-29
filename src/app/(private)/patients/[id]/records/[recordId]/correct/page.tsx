import { CorrectRecordView } from './correct-record-view';

export default async function CorrectRecordPage({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const { id, recordId } = await params;
  return <CorrectRecordView patientId={id} recordId={recordId} />;
}
