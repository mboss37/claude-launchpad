import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { log } from "./output.js";

async function readJsonFile(path: string): Promise<Record<string, unknown> | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return {};
    log.warnOnce(`read:${path}`, `Could not read ${path}: ${(err as Error).message}`);
    return null;
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    log.warnOnce(`parse:${path}`, `${path} is not valid JSON: ${(err as Error).message}. Treating as unreadable to avoid clobbering it.`);
    return null;
  }
}

export async function readSettingsJson(root: string): Promise<Record<string, unknown> | null> {
  return readJsonFile(join(root, ".claude", "settings.json"));
}

export async function writeSettingsJson(root: string, settings: Record<string, unknown>): Promise<void> {
  const dir = join(root, ".claude");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "settings.json"), JSON.stringify(settings, null, 2) + "\n");
}

export async function readSettingsLocalJson(root: string): Promise<Record<string, unknown> | null> {
  return readJsonFile(join(root, ".claude", "settings.local.json"));
}

export async function writeSettingsLocalJson(root: string, settings: Record<string, unknown>): Promise<void> {
  const dir = join(root, ".claude");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "settings.local.json"), JSON.stringify(settings, null, 2) + "\n");
}
