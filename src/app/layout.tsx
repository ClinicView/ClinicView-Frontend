import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible, Figtree } from 'next/font/google';
import { CLINICVIEW_BRAND_ASSETS } from '@/shared/brand/assets';
import { Providers } from './providers';
import './globals.css';

const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-atkinson',
});

const figtree = Figtree({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-figtree',
});

export const metadata: Metadata = {
  applicationName: 'ClinicView',
  title: {
    default: 'ClinicView',
    template: '%s · ClinicView',
  },
  description: 'ClinicView: plataforma segura para digitalizar, revisar y gestionar historias clínicas.',
  icons: {
    icon: [{
      url: CLINICVIEW_BRAND_ASSETS.mark.src,
      type: 'image/png',
      sizes: `${CLINICVIEW_BRAND_ASSETS.mark.width}x${CLINICVIEW_BRAND_ASSETS.mark.height}`,
    }],
    apple: [{
      url: CLINICVIEW_BRAND_ASSETS.appleTouchIcon.src,
      type: 'image/png',
      sizes: `${CLINICVIEW_BRAND_ASSETS.appleTouchIcon.width}x${CLINICVIEW_BRAND_ASSETS.appleTouchIcon.height}`,
    }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f4f7fb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${atkinson.variable} ${figtree.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
