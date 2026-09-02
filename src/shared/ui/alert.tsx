import styles from './alert.module.css';
import { Icon, type IconName } from './icon';

const ICONS: Record<NonNullable<AlertProps['variant']>, IconName> = {
  error: 'warning',
  warning: 'warning',
  success: 'check',
  info: 'info',
};

interface AlertProps {
  variant?: 'error' | 'warning' | 'success' | 'info';
  children: React.ReactNode;
}

export function Alert({ variant = 'error', children }: AlertProps) {
  return (
    <div
      className={`${styles.alert} ${styles[variant]}`}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon name={ICONS[variant]} size={18} />
      </span>
      <span className={styles.content}>{children}</span>
    </div>
  );
}
