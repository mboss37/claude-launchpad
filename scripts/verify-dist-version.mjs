// Publish preflight: the binary must report the version being published.
// v1.17.0 shipped a dist built before the version bump (prepublishOnly did
// not execute) — package.json said 1.17.0, `-v` said 1.16.0.
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8')).version;
const dist = readFileSync('dist/cli.js', 'utf-8');
if (!dist.includes(`"${pkg}"`)) {
  console.error(`FATAL: dist/cli.js does not contain version ${pkg} — stale build. Run pnpm build.`);
  process.exit(1);
}
console.log(`dist verified: ${pkg}`);
