import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readFileOrNull } from "../../../lib/fs-utils.js";
import { generateCursorVerificationRule } from "../generators.js";
import { replaceVersionedCursorFile } from "../merge.js";

export async function createOrUpdateVerificationRule(
  root: string,
): Promise<boolean> {
  const path = join(root, ".cursor", "rules", "verification.mdc");
  const generated = generateCursorVerificationRule();
  const existing = await readFileOrNull(path);
  if (existing === null) {
    await writeGenerated(path, generated);
    return true;
  }
  const next = replaceVersionedCursorFile(
    existing,
    generated,
    "lp-cursor-verification-version",
  );
  if (next === null || next === existing) return false;
  await writeGenerated(path, next);
  return true;
}

export async function addEnvToCursorIgnore(root: string): Promise<boolean> {
  const path = join(root, ".cursorignore");
  const existing = await readFileOrNull(path);
  if (existing === null) {
    await writeGenerated(path, ".env\n");
    return true;
  }
  if (/(^|\n)\.env(\n|$)/.test(existing)) return false;
  const suffix = existing.endsWith("\n") ? ".env\n" : "\n.env\n";
  await writeGenerated(path, `${existing}${suffix}`);
  return true;
}

async function writeGenerated(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}
