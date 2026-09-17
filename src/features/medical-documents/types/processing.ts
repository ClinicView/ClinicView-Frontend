/** Persistent server-side execution; counters describe work, never OCR accuracy. */
export interface DocumentProcessing {
  jobId: string;
  attempt: number;
  status: 'QUEUED' | 'RUNNING' | 'WAITING_FOR_WORKER' | 'FINALIZING' | 'SUCCEEDED' | 'FAILED' | 'INTERRUPTED';
  progress: {
    phase: string;
    currentPage: number | null;
    pagesTotal: number | null;
    pagesCompleted: number;
    linesTotal: number | null;
    linesCompleted: number;
    batchesTotal: number | null;
    batchesCompleted: number;
  };
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  heartbeatAt: string | null;
  error: { code: string; message: string; retryable: boolean } | null;
  canRetry: boolean;
}
