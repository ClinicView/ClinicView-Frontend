export { RecordList } from './components/record-list';
export { RecordForm } from './components/record-form';
export { RecordDetail } from './components/record-detail';
export { RecordDetailsView } from './components/record-details-view';
export type {
  ClinicalRecord,
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
export { useRecordDraft } from './hooks/use-record-draft';
