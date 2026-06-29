'use client';

import styles from './document-detail.module.css';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function ZoomControls({ zoom, onZoomIn, onZoomOut, onReset }: ZoomControlsProps) {
  return (
    <div className={styles.zoomControls} aria-label="Controles de zoom de imagen">
      <button
        className={styles.zoomButton}
        type="button"
        onClick={onZoomOut}
        aria-label="Alejar imagen"
        title="Alejar"
      >
        -
      </button>
      <span className={styles.zoomValue} aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <button
        className={styles.zoomButton}
        type="button"
        onClick={onZoomIn}
        aria-label="Acercar imagen"
        title="Acercar"
      >
        +
      </button>
      <button
        className={styles.zoomReset}
        type="button"
        onClick={onReset}
        aria-label="Restablecer zoom de imagen"
      >
        Restablecer
      </button>
    </div>
  );
}
