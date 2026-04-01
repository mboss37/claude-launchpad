import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export async function readSettingsJson(root: string): Promise<Record<string, unknown>> {
  const path = join(root, ".claude", "settings.json");
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function writeSettingsJson(root: string, settings: Record<string, unknown>): Promise<void> {
  const dir = join(root, ".claude");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "settings.json"), JSON.stringify(settings, null, 2) + "\n");
}
