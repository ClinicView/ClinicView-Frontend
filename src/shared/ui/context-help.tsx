'use client';

import { useId, useRef } from 'react';
import { Icon } from './icon';
import styles from './context-help.module.css';

/** Native dialog supplies focus trapping, Escape and focus restoration. */
export function ContextHelp({
  title,
  children,
  compact = false,
}: {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  return (
    <>
      <button
        className={styles.trigger}
        type="button"
        aria-label={`Ayuda: ${title}`}
        aria-haspopup="dialog"
        aria-controls={id}
        onClick={() => dialogRef.current?.showModal()}
      >
        <Icon name="info" size={18} />
        {!compact && <span>Ayuda</span>}
      </button>
      <dialog
        id={id}
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={`${id}-title`}
      >
        <header>
          <h2 id={`${id}-title`}>{title}</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Cerrar ayuda"
          >
            Cerrar
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </dialog>
    </>
  );
}
