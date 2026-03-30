import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: appName,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    links: [
      {
        text: 'Changelog',
        url: '/docs/changelog',
      },
      {
        type: 'icon',
        label: 'npm',
        icon: (
          <img
            src="https://img.shields.io/npm/v/claude-launchpad?style=flat-square&color=333&labelColor=1a1a1a"
            alt="npm version"
            className="h-5"
          />
        ),
        text: 'npm',
        url: 'https://www.npmjs.com/package/claude-launchpad',
        external: true,
      },
    ],
  };
}
