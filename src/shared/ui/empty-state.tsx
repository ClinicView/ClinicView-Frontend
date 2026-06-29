import { Icon, type IconName } from './icon';
import styles from './empty-state.module.css';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
}

export function EmptyState({ icon = 'document', title, description }: EmptyStateProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.icon} aria-hidden="true">
        <Icon name={icon} size={22} />
      </div>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
}
