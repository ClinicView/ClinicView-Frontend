import styles from './spinner.module.css';

interface SpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
}

export function Spinner({ label = 'Cargando…', size = 'md', fullPage }: SpinnerProps) {
  if (fullPage) {
    return (
      <div className={styles.fullPage} role="status" aria-label={label} aria-atomic="true">
        <div className={styles.wrapper}>
          <div className={`${styles.ring} ${styles[size]}`} aria-hidden="true" />
          {label && <span className={styles.label}>{label}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper} role="status" aria-label={label} aria-atomic="true">
      <div className={`${styles.ring} ${styles[size]}`} aria-hidden="true" />
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}
