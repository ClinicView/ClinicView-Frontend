export { RecordList } from './components/record-list';
export { RecordForm } from './components/record-form';
export { RecordDetail } from './components/record-detail';
export { RecordDetailsView } from './components/record-details-view';
export { RecordAttachmentsGallery } from './components/record-attachments-gallery';
export { RecordMediaUploader } from './components/record-media-uploader';
export type {
  ClinicalRecord,
  ClinicalMediaAsset,
  ClinicalMediaStatus,
  ClinicalRecordAttachment,
  RecordAttachmentInput,
  RecordType,
  RecordStatus,
  RecordOrigin,
  RecordPriority,
  RecordSchemaVersion,
  RecordDetails,
  RecordDetailsByType,
  TypedRecordDetailsPayload,
  TypedCreateRecordData,
  RecordsPage,
  CreateRecordData,
  CorrectRecordData,
  RecordDraftPayload,
  RecordDraftResponse,
} from './types/record';
export { createRecord, correctRecord, listRecords } from './services/records.service';
export {
  RECORD_TYPE_DEFINITIONS,
  RECORD_TYPE_OPTIONS,
  createEmptyRecordDetails,
  getRecordTypeDefinition,
} from './lib/record-type-definitions';
export type {
  RecordFieldDefinition,
  RecordFieldKind,
  RecordFieldOption,
  RecordColumnDefinition,
  RecordSectionDefinition,
  RecordTypeDefinition,
} from './lib/record-type-definitions';
export {
  getRecordDetailsPresentation,
  getRecordDetailsSearchText,
  recordDetailsIncludeValue,
} from './lib/record-details-presentation';
export type {
  RecordDetailsBlock,
  RecordDetailsSection,
} from './lib/record-details-presentation';
export {
  fitRecordAttachmentDimensions,
  formatRecordAttachmentSize,
  getRecordAttachmentAltText,
  getRecordAttachmentGroups,
  getRecordExportAttachments,
  resolveRequiredAttachmentData,
  RequiredAttachmentResolutionError,
} from './lib/record-attachments-presentation';
export type {
  RecordAttachmentGroup,
  RecordExportAttachment,
  ResolvedAttachment,
} from './lib/record-attachments-presentation';
export { useRecordDraft } from './hooks/use-record-draft';
export { useRecordMedia } from './hooks/use-record-media';
export type {
  RecordMediaAssetState,
  RecordMediaCleanupResult,
  RecordMediaController,
  RecordMediaUploadItem,
  RecordMediaUploadStatus,
} from './hooks/use-record-media';
export {
  deleteTemporaryRecordMedia,
  getRecordMediaContent,
  getRecordMediaMetadata,
  uploadRecordMedia,
} from './services/record-media.service';
