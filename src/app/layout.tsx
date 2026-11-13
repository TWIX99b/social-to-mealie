import './globals.css';
import './stm.css';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import type React from 'react';

export const metadata: Metadata = {
  title: 'Social → Mealie',
  description: 'Rezepte aus Reels, TikToks und Posts – geschrieben von Claude, gespeichert in Mealie.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
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
    <html lang='de' suppressHydrationWarning>
      <head />
      <body style={{ margin: 0 }}>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
