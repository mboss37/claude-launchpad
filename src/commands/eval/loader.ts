import { readFile, readdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { validateScenario } from "./schema.js";
import type { EvalScenario } from "../../types/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load eval scenarios from a directory. Supports:
 * - Built-in scenarios (shipped in scenarios/)
 * - Custom scenarios from a user-specified path
 */
export async function loadScenarios(options: {
  suite?: string;
  customPath?: string;
}): Promise<ReadonlyArray<EvalScenario>> {
  const { suite, customPath } = options;

  const scenarioDir = customPath
    ? resolve(customPath)
    : resolve(__dirname, "../../../scenarios");

  const dirs = suite
    ? [join(scenarioDir, suite)]
    : await getSubdirectories(scenarioDir);

  // Also check the root dir for flat YAML files
  const allDirs = [scenarioDir, ...dirs];

  const scenarios: EvalScenario[] = [];

  for (const dir of allDirs) {
    const files = await listYamlFiles(dir);
    for (const file of files) {
      try {
        const content = await readFile(file, "utf-8");
        const raw = parseYaml(content);
        const scenario = validateScenario(raw, file);
        scenarios.push(scenario);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`  Warning: Skipping ${file}: ${msg}`);
      }
    }
  }

  return scenarios;
}

async function getSubdirectories(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => join(dir, e.name));
  } catch {
    return [];
  }
}

async function listYamlFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && (e.name.endsWith(".yaml") || e.name.endsWith(".yml")))
      .map((e) => join(dir, e.name));
  } catch {
    return [];
  }
}
