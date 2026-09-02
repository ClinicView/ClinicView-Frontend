'use client';

import { Icon } from '@/shared/ui';
import type { ConfidenceLevel, OcrMetrics } from '../types/document';
import styles from './correction-view.module.css';

interface MetricsPanelProps {
  metrics: OcrMetrics | null | undefined;
  confidenceLevel: ConfidenceLevel | null | undefined;
}

function pct(value: number | null): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

const LEVEL_CLASS: Record<ConfidenceLevel, string> = {
  HIGH: styles.conf_high,
  MEDIUM: styles.conf_mid,
  LOW: styles.conf_low,
};

const LEVEL_LABEL: Record<ConfidenceLevel, string> = {
  HIGH: 'Confianza alta',
  MEDIUM: 'Confianza media',
  LOW: 'Confianza baja',
};

export function MetricsPanel({ metrics, confidenceLevel }: MetricsPanelProps) {
  return (
    <details className={styles.metricsPanel} open={Boolean(metrics)}>
      <summary className={styles.metricsSummary}>
        <Icon name="chart" size={16} />
        Métricas OCR
        {metrics?.estimated && <span className={styles.collapsibleHint}>(estimadas)</span>}
      </summary>

      {metrics ? (
        <div className={styles.metricsBody}>
          <span className={styles.metricItem} aria-label={`Tasa de error por carácter: ${pct(metrics.cer)}`}>
            <span className={styles.metricLabel}>CER:</span>
            <span className={styles.metricValue}>{pct(metrics.cer)}</span>
          </span>
          <span className={styles.metricDivider} aria-hidden="true">|</span>
          <span className={styles.metricItem} aria-label={`Tasa de error por palabra: ${pct(metrics.wer)}`}>
            <span className={styles.metricLabel}>WER:</span>
            <span className={styles.metricValue}>{pct(metrics.wer)}</span>
          </span>
          <span className={styles.metricDivider} aria-hidden="true">|</span>
          <span className={styles.metricItem} aria-label={`Exactitud por carácter: ${pct(metrics.charAccuracy)}`}>
            <span className={styles.metricLabel}>Acc:</span>
            <span className={styles.metricValue}>{pct(metrics.charAccuracy)}</span>
          </span>
          {metrics.nerF1 != null && (
            <>
              <span className={styles.metricDivider} aria-hidden="true">|</span>
              <span className={styles.metricItem} aria-label={`Puntuación F1 de entidades: ${pct(metrics.nerF1)}`}>
                <span className={styles.metricLabel}>NER F1:</span>
                <span className={styles.metricValue}>{pct(metrics.nerF1)}</span>
              </span>
            </>
          )}
          {confidenceLevel && (
            <span className={`${styles.confidenceBadge} ${LEVEL_CLASS[confidenceLevel]}`}>
              {LEVEL_LABEL[confidenceLevel]}
            </span>
          )}
          {metrics.estimated && (
            <span className={styles.metricsNote}>
              Estimadas a partir de la confianza del modelo; las métricas reales se
              calculan al validar contra el texto corregido.
            </span>
          )}
        </div>
      ) : (
        <p className={styles.metricsEmpty}>
          Las métricas CER/WER estarán disponibles cuando el documento se procese
          con el motor IA v2 (TrOCR).
        </p>
      )}
    </details>
  );
}
