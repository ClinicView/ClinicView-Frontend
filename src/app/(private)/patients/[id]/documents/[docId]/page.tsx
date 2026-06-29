import { DocumentDetailView } from './document-detail-view';

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id, docId } = await params;
  return <DocumentDetailView patientId={id} docId={docId} />;
}
