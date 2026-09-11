export type OcrBox = [number, number, number, number];

export interface OcrMachineLine {
  lineId: string;
  bbox: OcrBox;
  detectionBbox?: OcrBox | null;
  polygon?: number[][] | null;
  regionId?: string | null;
  order: number;
  text: string;
  confidence: number | null;
  warnings?: string[];
}

export interface OcrLayoutPage {
  page: number;
  width: number;
  height: number;
  coordinateSpace: string;
  lines: OcrMachineLine[];
  warnings: string[];
  imageAvailable: boolean;
}

export interface OcrReviewLine {
  lineId: string;
  page: number;
  bbox: OcrBox;
  order: number;
  text: string;
  reviewed: boolean;
  sourceLineIds: string[];
  reason?: string;
}

export interface OcrLayout {
  schemaVersion: 1;
  available: boolean;
  reason?: string;
  runId: string | null;
  documentVersion: number;
  documentStatus?: string;
  assignedReviewerId?: string | null;
  pages: OcrLayoutPage[];
  revisions?: OcrRevisionMetadata[];
  review: null | {
    revision: number;
    documentVersion: number;
    stale: boolean;
    lines: OcrReviewLine[];
    recordedAt: string;
    recordedBy: { id: string; username: string; fullName: string };
  };
}

export interface OcrRevisionMetadata {
  revision: number;
  documentVersion: number;
  recordedAt: string;
  recordedBy: { id: string; username: string; fullName: string };
  reason?: string | null;
}

export interface OcrRevision extends OcrRevisionMetadata {
  schemaVersion: 1;
  runId: string;
  lines: OcrReviewLine[];
  correctedText: string;
  previousCorrection: { text: string | null; documentVersion: number; entities: unknown };
}

export interface OcrReviewInput {
  expectedVersion: number;
  runId: string;
  lines: OcrReviewLine[];
  reason?: string;
  confirmTextReplacement?: boolean;
}
