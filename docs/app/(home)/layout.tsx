import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Claude Code Setup, Scored and Enforced',
  description: 'Score your Claude Code setup, fix it with hooks, prove it with eval — plus persistent Claude Code memory with free cross-machine sync. Free, offline, open source.',
  alternates: { canonical: 'https://mboss37.github.io/claude-launchpad/' },
  openGraph: {
    url: 'https://mboss37.github.io/claude-launchpad/',
    images: 'https://mboss37.github.io/claude-launchpad/og/docs/image.png',
  },
};
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

export default function Layout({ children }: LayoutProps<'/'>) {
  return <HomeLayout {...baseOptions()}>{children}</HomeLayout>;
}
