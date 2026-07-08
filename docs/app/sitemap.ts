import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const BASE = 'https://mboss37.github.io/claude-launchpad';
const PAGES = ['', '/docs', '/docs/init', '/docs/doctor', '/docs/enhance', '/docs/eval', '/docs/memory', '/docs/workflow', '/docs/ci', '/docs/migrate-memory', '/docs/changelog', '/docs/privacy'];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : path === '/docs/memory' ? 0.9 : 0.7,
  }));
}
