import { Geist, Geist_Mono } from 'next/font/google';
import type { Metadata } from 'next';
import { Provider } from '@/components/provider';
import './global.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: { default: 'Claude Launchpad', template: '%s | Claude Launchpad' },
  description: 'Score your Claude Code setup. Fix what\'s broken. Prove it works.',
  openGraph: {
    title: 'Claude Launchpad',
    description: 'Score your Claude Code setup. Fix what\'s broken. Prove it works.',
    type: 'website',
    siteName: 'Claude Launchpad',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Claude Launchpad',
    description: 'Score your Claude Code setup. Fix what\'s broken. Prove it works.',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
