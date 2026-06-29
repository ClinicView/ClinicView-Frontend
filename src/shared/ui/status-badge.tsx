import styles from './status-badge.module.css';

interface StatusBadgeProps {
  status: string;
  label: string;
  dot?: boolean;
}

export function StatusBadge({ status, label, dot = false }: StatusBadgeProps) {
  const cls = styles[status as keyof typeof styles];
  return (
    <span className={`${styles.badge} ${cls ?? ''}`}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {label}
    </span>
  );
}
