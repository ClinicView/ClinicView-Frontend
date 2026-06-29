import { RecordsView } from './records-view';

export default async function RecordsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecordsView patientId={id} />;
}
