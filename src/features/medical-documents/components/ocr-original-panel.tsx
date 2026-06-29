'use client';

import { Icon } from '@/shared/ui';
import styles from './document-detail.module.css';

interface OcrOriginalPanelProps {
  ocrText: string | null;
}

export function OcrOriginalPanel({ ocrText }: OcrOriginalPanelProps) {
  return (
    <details className={styles.collapsiblePanel} aria-labelledby="ocr-original-title">
      <summary id="ocr-original-title" className={styles.collapsibleSummary}>
        Ver OCR original
      </summary>
      <div className={styles.collapsibleHint}>
        <Icon name="document" size={16} />
        <span>El OCR original se conserva para trazabilidad.</span>
      </div>
      <div className={`${styles.ocrBox} ${styles.ocrBoxCollapsed}`}>
        {ocrText ? (
          ocrText
        ) : (
          <span className={styles.emptyInline}>
            Todavia no hay texto reconocido. Ejecuta el procesamiento primero.
          </span>
        )}
      </div>
    </details>
  );
}
