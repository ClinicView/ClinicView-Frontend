'use client';

import type { ReactNode } from 'react';
import styles from './document-detail.module.css';

interface DocumentReviewLayoutProps {
  preview: ReactNode;
  editor: ReactNode;
  support: ReactNode;
}

export function DocumentReviewLayout({ preview, editor, support }: DocumentReviewLayoutProps) {
  return (
    <div className={styles.reviewLayout}>
      <div className={styles.previewColumn}>{preview}</div>
      <div className={styles.editorColumn}>{editor}</div>
      <div className={styles.supportColumn}>{support}</div>
    </div>
  );
}
