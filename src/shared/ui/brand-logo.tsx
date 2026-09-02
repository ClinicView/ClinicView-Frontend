import Image from 'next/image';
import { CLINICVIEW_BRAND_ASSETS, CLINICVIEW_BRAND_LABEL } from '@/shared/brand/assets';
import styles from './brand-logo.module.css';

export type BrandLogoVariant = 'mark' | 'lockup' | 'horizontal';
export type BrandLogoTone = 'default' | 'inverse';
export type BrandLogoSize = 'compact' | 'navigation' | 'hero';

interface BrandLogoBaseProps {
  size?: BrandLogoSize;
  className?: string;
  decorative?: boolean;
  preload?: boolean;
}

export type BrandLogoProps = BrandLogoBaseProps & (
  | {
      variant?: 'lockup';
      tone?: BrandLogoTone;
    }
  | {
      variant: Exclude<BrandLogoVariant, 'lockup'>;
      tone?: never;
    }
);

const MARK_SIZES: Record<BrandLogoSize, string> = {
  compact: '36px',
  navigation: '44px',
  hero: '56px',
};
const HORIZONTAL_SIZES: Record<BrandLogoSize, string> = {
  compact: '176px',
  navigation: '196px',
  hero: '232px',
};

export function BrandLogo({
  variant = 'lockup',
  tone = 'default',
  size = 'navigation',
  className = '',
  decorative = false,
  preload = false,
}: BrandLogoProps) {
  const rootClassName = [
    styles.root,
    styles[`variant${variant[0].toUpperCase()}${variant.slice(1)}`],
    variant === 'lockup'
      ? styles[`tone${tone[0].toUpperCase()}${tone.slice(1)}`]
      : '',
    styles[`size${size[0].toUpperCase()}${size.slice(1)}`],
    className,
  ].filter(Boolean).join(' ');

  if (variant === 'horizontal') {
    return (
      <span
        className={rootClassName}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : CLINICVIEW_BRAND_LABEL}
        aria-hidden={decorative || undefined}
      >
        <Image
          className={styles.horizontalImage}
          src={CLINICVIEW_BRAND_ASSETS.horizontal.src}
          alt=""
          width={CLINICVIEW_BRAND_ASSETS.horizontal.width}
          height={CLINICVIEW_BRAND_ASSETS.horizontal.height}
          preload={preload}
          sizes={HORIZONTAL_SIZES[size]}
        />
      </span>
    );
  }

  return (
    <span
      className={rootClassName}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : CLINICVIEW_BRAND_LABEL}
      aria-hidden={decorative || undefined}
    >
      <Image
        className={styles.markImage}
        src={CLINICVIEW_BRAND_ASSETS.mark.src}
        alt=""
        width={CLINICVIEW_BRAND_ASSETS.mark.width}
        height={CLINICVIEW_BRAND_ASSETS.mark.height}
        preload={preload}
        sizes={MARK_SIZES[size]}
      />

      {variant === 'lockup' && (
        <span className={styles.copy} aria-hidden="true">
          <span className={styles.wordmark}>
            Clinic<span className={styles.wordmarkAccent}>View</span>
          </span>
          <span className={styles.descriptor}>
            <span>Historias clínicas</span>
            <span className={styles.descriptorAccent}>Digitalizadas</span>
          </span>
        </span>
      )}
    </span>
  );
}
