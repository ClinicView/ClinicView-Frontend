import { DocumentsView } from './documents-view';

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentsView patientId={id} />;
}
