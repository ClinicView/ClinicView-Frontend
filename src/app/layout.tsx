import type { Metadata } from 'next';
import { Atkinson_Hyperlegible, Figtree } from 'next/font/google';
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
  title: {
    default: 'ClinicView',
    template: '%s · ClinicView',
  },
  description: 'Plataforma segura para digitalizar, revisar y gestionar historias clínicas.',
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
