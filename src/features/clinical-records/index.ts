export { RecordList } from './components/record-list';
export { RecordForm } from './components/record-form';
export { RecordDetail } from './components/record-detail';
export type {
  ClinicalRecord,
  RecordType,
  RecordStatus,
  RecordOrigin,
  RecordsPage,
  CreateRecordData,
  CorrectRecordData,
} from './types/record';
export { createRecord, correctRecord } from './services/records.service';
