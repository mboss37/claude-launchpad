import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const changelogPath = resolve(__dirname, '../../CHANGELOG.md');
const outputPath = resolve(__dirname, '../content/docs/changelog.mdx');

const changelog = readFileSync(changelogPath, 'utf-8');

// Strip the "# Changelog" H1 (Fumadocs renders its own title from frontmatter)
const body = changelog.replace(/^# Changelog\s*\n/, '');

const mdx = `---
title: Changelog
description: Release history for Claude Launchpad.
---

{/* Auto-generated from CHANGELOG.md - do not edit directly */}

${body.trim()}
`;

writeFileSync(outputPath, mdx);
console.log('Synced CHANGELOG.md → content/docs/changelog.mdx');
