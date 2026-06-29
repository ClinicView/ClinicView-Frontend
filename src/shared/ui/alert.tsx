import styles from './alert.module.css';

const ICONS: Record<string, string> = {
  error: '⚠',
  warning: '⚠',
  success: '✓',
  info: 'ℹ',
};

interface AlertProps {
  variant?: 'error' | 'warning' | 'success' | 'info';
  children: React.ReactNode;
}

export function Alert({ variant = 'error', children }: AlertProps) {
  return (
    <div className={`${styles.alert} ${styles[variant]}`} role="alert">
      <span className={styles.icon} aria-hidden="true">{ICONS[variant]}</span>
      <span>{children}</span>
    </div>
  );
}
