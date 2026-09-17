'use client';

import { Icon } from '@/shared/ui';
import type { ConfidenceLevel, OcrMetrics } from '../types/document';
import { formatErrorRate, modelConfidence, referenceErrorRates } from '../lib/ocr-metrics';
import styles from './correction-view.module.css';

interface MetricsPanelProps {
  metrics: OcrMetrics | null | undefined;
  confidenceLevel: ConfidenceLevel | null | undefined;
  confidence?: number | null;
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

export function MetricsPanel({ metrics, confidenceLevel, confidence }: MetricsPanelProps) {
  const rates = referenceErrorRates(metrics);
  const confidenceValue = modelConfidence(confidence);
  return (
    <details className={styles.metricsPanel} open>
      <summary className={styles.metricsSummary}>
        <Icon name="chart" size={16} />
        Calidad OCR y confianza del modelo
      </summary>

      <div className={styles.metricsBody}>
        {rates ? <>
          <p className={styles.metricsNote}><strong>Comparación contra una referencia suministrada al procesamiento.</strong> No acredita una evaluación independiente ni la versión clínica actual.</p>
          <span className={styles.metricItem} aria-label={`Tasa de error por carácter: ${formatErrorRate(rates.cer)}`}>
            <span className={styles.metricLabel}>CER:</span><span className={styles.metricValue}>{formatErrorRate(rates.cer)}</span>
          </span>
          <span className={styles.metricItem} aria-label={`Tasa de error por palabra: ${formatErrorRate(rates.wer)}`}>
            <span className={styles.metricLabel}>WER:</span><span className={styles.metricValue}>{formatErrorRate(rates.wer)}</span>
          </span>
          <p className={styles.metricsNote}>Menor error es mejor. Las inserciones pueden llevar CER/WER por encima del 100 %. No son porcentajes de exactitud clínica.</p>
        </> : <p className={styles.metricsNote}><strong>Sin CER/WER medidos contra una referencia.</strong> La confianza del modelo no permite calcular estos errores ni la calidad de las entidades.</p>}
        <span className={styles.metricItem}>
          <span className={styles.metricLabel}>Confianza del modelo:</span>
          <span className={styles.metricValue}>{confidenceValue === null ? 'No disponible' : `${(confidenceValue * 100).toFixed(1)}%`}</span>
        </span>
        {confidenceLevel && <span className={`${styles.confidenceBadge} ${LEVEL_CLASS[confidenceLevel]}`}>{LEVEL_LABEL[confidenceLevel]}</span>}
        <p className={styles.metricsNote}>La confianza es una señal automática, no precisión medida. Guardar o validar en la web no recalcula CER/WER. Para evaluarlos, utiliza una transcripción revisada y comprueba también las páginas completas, las zonas omitidas y el orden de lectura.</p>
      </div>
    </details>
  );
}
