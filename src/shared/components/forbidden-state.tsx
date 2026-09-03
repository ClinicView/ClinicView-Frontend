'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/shared/ui';
import styles from './forbidden-state.module.css';

interface ForbiddenStateProps {
  title?: string;
  description?: string;
}

export function ForbiddenState({
  title = 'No tienes acceso a esta sección',
  description = 'Tu cuenta está activa, pero el rol asignado no incluye los permisos necesarios para consultar este contenido.',
}: ForbiddenStateProps) {
  const router = useRouter();

  return (
    <section className={styles.state} aria-labelledby="forbidden-title" aria-describedby="forbidden-description">
      <div className={styles.card}>
        <p className={styles.code}>Acceso 403</p>
        <span className={styles.icon} aria-hidden="true">
          <Icon name="shield" size={34} />
        </span>
        <h1 id="forbidden-title" className={styles.title}>{title}</h1>
        <p id="forbidden-description" className={styles.description}>{description}</p>
        <p className={styles.help}>
          Si necesitas ingresar, solicita a un administrador que revise tu rol y vuelve a intentarlo.
        </p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/profile">
            <Icon name="profile" size={17} />
            Ir a mi perfil
          </Link>
          <button className={styles.secondary} type="button" onClick={() => router.back()}>
            Volver a la página anterior
          </button>
        </div>
      </div>
    </section>
  );
}
