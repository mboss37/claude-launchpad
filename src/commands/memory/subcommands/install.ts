import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { checkbox } from "@inquirer/prompts";
import { createDatabase, closeDatabase } from "../storage/database.js";
import { migrate } from "../storage/migrator.js";
import { loadConfig, resolveDataDir } from "../config.js";
import {
  readSettingsJson,
  writeSettingsJson,
  readSettingsLocalJson,
  writeSettingsLocalJson,
} from "../../../lib/settings.js";
import { getMemoryPlacement } from "../../../lib/memory-placement.js";
import { configureClaudeMemorySettings } from "../install-claude-settings.js";
import { log } from "../../../lib/output.js";
import { detectHarnesses } from "../../../harness/registry.js";
import type { HarnessId } from "../../../harness/types.js";
import type { MemoryPlacement } from "../../../types/index.js";
import { hasCursorMemoryMcp } from "../../../lib/memory-registration.js";
import { registerCursorMemoryMcp } from "../cursor-mcp.js";
import {
  injectAgentsMdGuidance,
  injectClaudeMdGuidance,
  installMemorySkills,
} from "../install-guidance.js";
import {
  parseMemoryInstallHarness,
  resolveMemoryInstallTargets,
  type MemoryInstallHarness,
} from "../install-targets.js";

export { injectAgentsMdGuidance, injectClaudeMdGuidance };

function isGhAuthenticated(): boolean {
  try {
    execSync("gh auth status", { stdio: "pipe", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function isClaudeCliOnPath(): boolean {
  try {
    execSync("claude --version", { stdio: "pipe", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function isGhOnPath(): boolean {
  try {
    execSync("gh --version", { stdio: "pipe", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export const CURSOR_CLOUD_MEMORY_WARNING =
  "Cursor Cloud Agents cannot use this local MCP server.";

export function knowledgeBaseStepLabel(
  targets: ReadonlyArray<HarnessId>,
): string {
  return targets.includes("claude")
    ? "[1/5] Creating knowledge base..."
    : "Creating knowledge base...";
}

export function missingGhAdvice(targets: ReadonlyArray<HarnessId>): string {
  return targets.includes("claude")
    ? "Recommended: install the GitHub CLI for cross-device memory sync:"
    : "Optional: install the GitHub CLI for `memory push` / `memory pull`.";
}

function preflight(targets: ReadonlyArray<HarnessId>): void {
  if (targets.includes("claude") && !isClaudeCliOnPath()) {
    log.error("The `claude` CLI was not found on PATH.");
    log.blank();
    log.info(
      "The knowledge base installs as a Claude Code MCP server, so the CLI is required.",
    );
    log.info("Install: https://docs.claude.com/en/docs/claude-code");
    process.exit(1);
  }
  if (!isGhOnPath()) {
    log.warn(missingGhAdvice(targets));
    log.info("Install later: https://cli.github.com/ then `gh auth login`.");
    log.blank();
  }
}

interface InstallOpts {
  readonly dbPath?: string;
  readonly yes?: boolean;
  readonly harness?: MemoryInstallHarness;
}

export async function runInstall(opts: InstallOpts): Promise<void> {
  log.blank();
  log.step("Setting up your knowledge base");
  log.blank();

  const projectRoot = process.cwd();
  const targets = await selectInstallTargets(opts, projectRoot);
  preflight(targets);
  await ensureNativeDeps();

  const nonInteractive = opts.yes === true || !process.stdin.isTTY;
  const wantsClaude = targets.includes("claude");
  if (wantsClaude && nonInteractive) {
    log.info(
      'Non-interactive: using "shared" memory placement (CLAUDE.md + settings.json).',
    );
  }
  const placement = wantsClaude
    ? await getMemoryPlacement(projectRoot, nonInteractive)
    : "shared";

  const config = loadConfig(opts.dbPath ? { dataDir: opts.dbPath } : undefined);
  const dataDir = resolveDataDir(config.dataDir);
  log.step(knowledgeBaseStepLabel(targets));
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const db = createDatabase({ dataDir });
  migrate(db);
  closeDatabase(db);
  log.success(`Knowledge base created at ${dataDir}/memory.db`);

  if (wantsClaude) await installClaudeMemory(projectRoot, placement);
  if (targets.includes("cursor")) installCursorMemory(projectRoot);
  finishInstall(targets);
}

export { parseMemoryInstallHarness };

async function selectInstallTargets(
  opts: InstallOpts,
  projectRoot: string,
): Promise<ReadonlyArray<HarnessId>> {
  const detected = await detectHarnesses(projectRoot);
  const nonInteractive = opts.yes === true || !process.stdin.isTTY;
  if (opts.harness || detected.length <= 1 || nonInteractive) {
    return resolveMemoryInstallTargets({
      detected,
      explicit: opts.harness,
      allDetectedWhenUnspecified: opts.harness === undefined,
    });
  }
  const selected = await checkbox<HarnessId>({
    message: "Install memory into which harnesses?",
    choices: detected.map((id) => ({
      name: id === "cursor" ? "Cursor Agent" : "Claude Code",
      value: id,
      checked: true,
    })),
  });
  return resolveMemoryInstallTargets({
    detected,
    allDetectedWhenUnspecified: false,
    selected,
  });
}

async function installClaudeMemory(
  projectRoot: string,
  placement: MemoryPlacement,
): Promise<void> {
  log.step("[2/5] Connecting to Claude Code...");
  await configureClaudeMemorySettings(projectRoot, placement);
  log.step("[3/5] Enabling memory tools...");
  const mcpScope = placement === "local" ? "local" : "project";
  await ensureAllowedMcpServerIncludesMemory(projectRoot, placement);
  const registered = registerMcpServer(mcpScope);
  if (registered) {
    log.success("Memory tools available in Claude Code");
  } else {
    log.warn("Could not enable memory tools automatically.");
    log.info(
      `Run: claude mcp add --scope ${mcpScope} agentic-memory -- npx claude-launchpad memory serve`,
    );
  }
  log.step("[4/5] Adding instructions...");
  if (injectClaudeMdGuidance(projectRoot, placement)) {
    const label = placement === "local" ? ".claude/CLAUDE.md" : "CLAUDE.md";
    log.success(`${label} updated with memory instructions`);
  }
  if (placement === "shared") {
    const skillsInstalled = installMemorySkills(projectRoot);
    if (skillsInstalled > 0) {
      log.success(`Installed ${skillsInstalled} skill(s) to .claude/skills/`);
    }
  }
}

function installCursorMemory(projectRoot: string): void {
  log.step("Connecting to Cursor Agent...");
  if (registerCursorMemoryMcp(projectRoot)) {
    log.success("Memory tools registered in .cursor/mcp.json");
  } else {
    log.info("Memory tools already registered in .cursor/mcp.json");
  }
  if (injectAgentsMdGuidance(projectRoot)) {
    log.success("AGENTS.md updated with memory instructions");
  } else if (!existsSync(join(projectRoot, "AGENTS.md"))) {
    log.info(
      "No AGENTS.md found — skipped memory guidance. Add AGENTS.md and re-run install to append it.",
    );
  }
}

function finishInstall(targets: ReadonlyArray<HarnessId>): void {
  const names = targets
    .map((id) => (id === "cursor" ? "Cursor Agent" : "Claude Code"))
    .join(" and ");
  log.blank();
  log.success(`Knowledge base is ready for ${names}.`);
  log.info("Restart the selected agent session to activate.");
  if (targets.includes("cursor")) {
    log.info(CURSOR_CLOUD_MEMORY_WARNING);
  }
  if (isGhAuthenticated() && targets.includes("claude")) {
    log.info(
      "Cross-device sync available. Run `memory push` to back up, or it auto-syncs each session.",
    );
  } else if (!isGhAuthenticated()) {
    log.blank();
    log.info(missingGhAdvice(targets));
    log.step("  https://cli.github.com/");
    log.step("  gh auth login");
  }
  log.blank();
}

export function existingSetupLabel(
  projectDir: string,
  placement: MemoryPlacement,
): string {
  if (placement === "local") return ".claude/CLAUDE.md + settings.local.json";
  const parts: string[] = [];
  try {
    const claude = readFileSync(join(projectDir, "CLAUDE.md"), "utf-8");
    if (claude.includes("## Memory (agentic-memory)")) parts.push("CLAUDE.md");
  } catch {
    /* not found */
  }
  try {
    const agents = readFileSync(join(projectDir, "AGENTS.md"), "utf-8");
    if (/^## Memory( \(agentic-memory\))?\s*$/m.test(agents)) {
      parts.push("AGENTS.md");
    }
  } catch {
    /* not found */
  }
  if (hasCursorMemoryMcp(projectDir)) parts.push(".cursor/mcp.json");
  return parts.length > 0 ? parts.join(" + ") : "project memory config";
}

export function detectExistingSetup(
  projectDir: string,
): MemoryPlacement | null {
  // Check local CLAUDE.md
  try {
    const localClaude = readFileSync(
      join(projectDir, ".claude", "CLAUDE.md"),
      "utf-8",
    );
    if (
      localClaude.includes("## Memory") ||
      localClaude.includes("agentic-memory")
    )
      return "local";
  } catch {
    /* not found */
  }

  // Check root CLAUDE.md
  try {
    const rootClaude = readFileSync(join(projectDir, "CLAUDE.md"), "utf-8");
    if (rootClaude.includes("## Memory (agentic-memory)")) return "shared";
  } catch {
    /* not found */
  }

  try {
    const agents = readFileSync(join(projectDir, "AGENTS.md"), "utf-8");
    if (/^## Memory( \(agentic-memory\))?\s*$/m.test(agents)) return "shared";
  } catch {
    /* not found */
  }
  if (hasCursorMemoryMcp(projectDir)) return "shared";

  return null;
}

async function ensureNativeDeps(): Promise<void> {
  const { cwdRequire } = await import("../utils/require-deps.js");
  try {
    cwdRequire("better-sqlite3");
    return;
  } catch {
    // Not installed — install globally
  }

  log.step("Installing required database libraries...");
  try {
    execSync("npm install -g better-sqlite3", {
      stdio: "pipe",
      timeout: 120000,
    });
    log.success("Database libraries installed");
  } catch {
    log.error("Could not install database libraries automatically.");
    log.blank();
    log.info("Install manually:");
    log.step("  npm install -g better-sqlite3");
    log.blank();
    log.info(
      "Requires a C++ compiler (Xcode on macOS, build-essential on Linux).",
    );
    process.exit(1);
  }
}

async function ensureAllowedMcpServerIncludesMemory(
  projectDir: string,
  placement: MemoryPlacement,
): Promise<void> {
  const read = placement === "local" ? readSettingsLocalJson : readSettingsJson;
  const write =
    placement === "local" ? writeSettingsLocalJson : writeSettingsJson;
  const settings = await read(projectDir);
  if (settings === null) return;
  const existing = settings.allowedMcpServers as unknown;
  // No allowlist configured — nothing to patch; Claude Code trusts any added server by default.
  if (!Array.isArray(existing)) return;

  const list = existing as Array<{ serverName?: unknown }>;
  const hasMemory = list.some(
    (e) => e && typeof e === "object" && e.serverName === "agentic-memory",
  );
  if (hasMemory) return;

  const updated = {
    ...settings,
    allowedMcpServers: [{ serverName: "agentic-memory" }, ...list],
  };
  await write(projectDir, updated);
  const target =
    placement === "local" ? "settings.local.json" : "settings.json";
  log.info(`Added agentic-memory to allowedMcpServers in ${target}`);
}

function registerMcpServer(scope: "project" | "local"): boolean {
  try {
    const existing = execSync("claude mcp list", {
      stdio: "pipe",
      timeout: 10000,
      encoding: "utf-8",
    });
    if (existing.includes("agentic-memory")) {
      log.info("Memory tools already registered");
      return true;
    }
    execSync(
      `claude mcp add --scope ${scope} agentic-memory -- npx claude-launchpad memory serve`,
      { stdio: "pipe", timeout: 10000 },
    );
    return true;
  } catch {
    return false;
  }
}
