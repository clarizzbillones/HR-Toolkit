import type { Metadata } from 'next';
import { Spectral, Public_Sans, Anton, Great_Vibes } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const spectral = Spectral({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-spectral',
  display: 'swap',
});
const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-public-sans',
  display: 'swap',
});
const anton = Anton({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-anton',
  display: 'swap',
});
const greatVibes = Great_Vibes({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-great-vibes',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Litson HR Toolkit',
  description: 'Litson, PLLC — HR Administration',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spectral.variable} ${publicSans.variable} ${anton.variable} ${greatVibes.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
