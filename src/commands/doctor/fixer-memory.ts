import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { log } from "../../lib/output.js";
import { readSettingsJson, writeSettingsJson, readSettingsLocalJson, writeSettingsLocalJson } from "../../lib/settings.js";
import type { MemoryPlacement } from "../../types/index.js";

// ─── Shared Hook Helper (placement-aware) ───

async function addPlacementHook(
  root: string,
  placement: MemoryPlacement,
  event: string,
  dedupKeyword: string,
  entry: Record<string, unknown>,
  prepend: boolean,
  successMsg: string,
): Promise<boolean> {
  const read = placement === "local" ? readSettingsLocalJson : readSettingsJson;
  const write = placement === "local" ? writeSettingsLocalJson : writeSettingsJson;
  const settings = await read(root);
  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  const hookList = (hooks[event] as Record<string, unknown>[] | undefined) ?? [];

  const alreadyHas = hookList.some((g) => {
    const nested = g.hooks as Record<string, unknown>[] | undefined;
    return nested?.some((h) => String(h.command ?? "").includes(dedupKeyword));
  });
  if (alreadyHas) return false;

  const updatedList = prepend ? [entry, ...hookList] : [...hookList, entry];
  const updatedSettings = { ...settings, hooks: { ...hooks, [event]: updatedList } };
  await write(root, updatedSettings);
  log.success(successMsg);
  return true;
}

// ─── Memory Fix Functions ───

export async function disableAutoMemory(root: string, placement: MemoryPlacement): Promise<boolean> {
  const read = placement === "local" ? readSettingsLocalJson : readSettingsJson;
  const write = placement === "local" ? writeSettingsLocalJson : writeSettingsJson;
  const settings = await read(root);
  if (settings.autoMemoryEnabled === false) return false;

  const updated = { ...settings, autoMemoryEnabled: false };
  await write(root, updated);
  const target = placement === "local" ? "settings.local.json" : "settings.json";
  log.success(`Set autoMemoryEnabled: false in ${target}`);
  return true;
}

export async function addMemoryToolPermissions(root: string, placement: MemoryPlacement): Promise<boolean> {
  const read = placement === "local" ? readSettingsLocalJson : readSettingsJson;
  const write = placement === "local" ? writeSettingsLocalJson : writeSettingsJson;
  const settings = await read(root);
  const permissions = (settings.permissions ?? {}) as Record<string, unknown>;
  const allow = (permissions.allow as string[] | undefined) ?? [];

  const tools = [
    "mcp__agentic-memory__memory_store",
    "mcp__agentic-memory__memory_search",
    "mcp__agentic-memory__memory_recent",
    "mcp__agentic-memory__memory_forget",
    "mcp__agentic-memory__memory_relate",
    "mcp__agentic-memory__memory_stats",
    "mcp__agentic-memory__memory_update",
  ];

  const missing = tools.filter((t) => !allow.includes(t));
  if (missing.length === 0) return false;

  const updated = { ...settings, permissions: { ...permissions, allow: [...allow, ...missing] } };
  await write(root, updated);
  const target = placement === "local" ? "settings.local.json" : "settings.json";
  log.success(`Added agentic-memory MCP tool permissions to ${target}`);
  return true;
}

export async function addSessionStartPullHook(root: string, placement: MemoryPlacement): Promise<boolean> {
  const target = placement === "local" ? "settings.local.json" : "settings.json";
  return addPlacementHook(root, placement, "SessionStart", "memory pull", {
    matcher: "startup",
    hooks: [{ type: "command", command: "claude-launchpad memory pull -y 2>/dev/null; exit 0" }],
  }, true, `Added SessionStart hook for memory sync to ${target}`);
}

export async function addSessionEndPushHook(root: string, placement: MemoryPlacement): Promise<boolean> {
  const target = placement === "local" ? "settings.local.json" : "settings.json";
  return addPlacementHook(root, placement, "SessionEnd", "memory push", {
    hooks: [{ type: "command", command: "nohup claude-launchpad memory push -y </dev/null >/dev/null 2>&1 & exit 0" }],
  }, false, `Added SessionEnd hook for memory sync to ${target}`);
}

export async function upgradeStaleSessionEndPushHook(root: string): Promise<boolean> {
  let changedAny = false;
  for (const placement of ["shared", "local"] as const) {
    const read = placement === "local" ? readSettingsLocalJson : readSettingsJson;
    const write = placement === "local" ? writeSettingsLocalJson : writeSettingsJson;
    const settings = await read(root);
    const hooks = settings.hooks as Record<string, unknown[]> | undefined;
    const sessionEnd = hooks?.SessionEnd as Record<string, unknown>[] | undefined;
    if (!sessionEnd) continue;

    let changed = false;
    const upgraded = sessionEnd.map((group) => {
      const inner = group.hooks as Record<string, unknown>[] | undefined;
      if (!inner) return group;
      const rewritten = inner.map((h) => {
        const cmd = typeof h.command === "string" ? h.command : "";
        if (!cmd.includes("memory push") || cmd.includes("nohup")) return h;
        changed = true;
        return { ...h, command: "nohup claude-launchpad memory push -y </dev/null >/dev/null 2>&1 & exit 0" };
      });
      return { ...group, hooks: rewritten };
    });
    if (!changed) continue;

    const updated = { ...settings, hooks: { ...hooks, SessionEnd: upgraded } };
    await write(root, updated);
    const target = placement === "local" ? "settings.local.json" : "settings.json";
    log.success(`Upgraded SessionEnd push hook in ${target} (now nohup-wrapped)`);
    changedAny = true;
  }
  return changedAny;
}

export async function removeStaleStopHook(root: string): Promise<boolean> {
  const settings = await readSettingsJson(root);
  const hooks = settings.hooks as Record<string, unknown[]> | undefined;
  if (!hooks?.Stop) return false;

  const stopHooks = hooks.Stop as Record<string, unknown>[];
  const filtered = stopHooks.filter((h) => {
    const innerHooks = h.hooks as Record<string, unknown>[] | undefined;
    return !innerHooks?.some(
      (ih) => typeof ih.command === "string" && (ih.command as string).includes("memory extract"),
    );
  });

  if (filtered.length === stopHooks.length) return false;

  const updated = filtered.length === 0
    ? (({ Stop: _, ...rest }) => rest)(hooks as Record<string, unknown>)
    : { ...hooks, Stop: filtered };
  const updatedSettings = { ...settings, hooks: updated };
  await writeSettingsJson(root, updatedSettings);
  log.success("Removed deprecated Stop hook (memory extract)");
  return true;
}

// ─── MCP Fix Functions ───

export async function addAllowedMcpServers(root: string, placement: MemoryPlacement): Promise<boolean> {
  const read = placement === "local" ? readSettingsLocalJson : readSettingsJson;
  const write = placement === "local" ? writeSettingsLocalJson : writeSettingsJson;
  const settings = await read(root);
  if (settings.allowedMcpServers) return false;
  const other = placement === "local" ? await readSettingsJson(root) : await readSettingsLocalJson(root);
  if (other.allowedMcpServers) return false;

  const serverNames = new Set<string>();
  const settingsServers = settings.mcpServers as Record<string, unknown> | undefined;
  if (settingsServers && typeof settingsServers === "object") {
    for (const name of Object.keys(settingsServers)) serverNames.add(name);
  }
  const mcpJsonPath = join(root, ".mcp.json");
  try {
    const mcpJson = JSON.parse(await readFile(mcpJsonPath, "utf-8")) as Record<string, unknown>;
    const mcpServers = mcpJson.mcpServers as Record<string, unknown> | undefined;
    if (mcpServers && typeof mcpServers === "object") {
      for (const name of Object.keys(mcpServers)) serverNames.add(name);
    }
  } catch { /* no .mcp.json */ }

  if (serverNames.size === 0) return false;

  const updatedSettings = {
    ...settings,
    allowedMcpServers: [...serverNames].map((name) => ({ serverName: name })),
  };
  await write(root, updatedSettings);
  const target = placement === "local" ? "settings.local.json" : "settings.json";
  log.success(`Added allowedMcpServers from configured servers to ${target}`);
  return true;
}
