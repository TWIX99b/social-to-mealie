import './globals.css';
import './stm.css';
import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import type React from 'react';

const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-fraunces', display: 'swap' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Social → Mealie',
  description: 'Rezepte aus Reels, TikToks und Posts – geschrieben von Claude, gespeichert in Mealie.',
  appleWebApp: { capable: true, title: 'Social → Mealie', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#a6441d',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='de' className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
      <head />
      <body style={{ margin: 0 }}>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
