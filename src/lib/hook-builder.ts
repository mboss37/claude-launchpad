import { readSettingsJson, writeSettingsJson } from "./settings.js";
import { log } from "./output.js";

export interface HookCommand {
  readonly type: "command";
  readonly command: string;
  readonly timeout?: number;
}

export interface HookEntry {
  readonly matcher?: string;
  readonly hooks: ReadonlyArray<HookCommand>;
}

export interface AddHookOptions {
  readonly event: string;
  readonly dedupKeyword: string;
  readonly entry: HookEntry;
  readonly prepend?: boolean;
}

export interface AddHookResult {
  readonly hooks: Record<string, unknown[]>;
  readonly added: boolean;
}

export function addOrUpdateHook(
  existingHooks: Record<string, unknown[]> | undefined,
  options: AddHookOptions,
): AddHookResult {
  const hookList = (existingHooks?.[options.event] ?? []) as Record<string, unknown>[];

  const alreadyHas = hookList.some((group) => {
    const nested = group.hooks as Record<string, unknown>[] | undefined;
    return nested?.some((h) => String(h.command ?? "").includes(options.dedupKeyword));
  });

  if (alreadyHas) {
    return { hooks: (existingHooks ?? {}) as Record<string, unknown[]>, added: false };
  }

  const newEntry = options.entry as unknown as Record<string, unknown>;
  const updated = options.prepend ? [newEntry, ...hookList] : [...hookList, newEntry];
  return {
    hooks: { ...(existingHooks ?? {}), [options.event]: updated },
    added: true,
  };
}

export async function addHookToSettings(
  root: string,
  event: string,
  dedupKeyword: string,
  entry: HookEntry,
  successMsg: string,
): Promise<boolean> {
  const settings = await readSettingsJson(root);
  if (settings === null) return false;
  const existingHooks = settings.hooks as Record<string, unknown[]> | undefined;

  const result = addOrUpdateHook(existingHooks, { event, dedupKeyword, entry });
  if (!result.added) return false;

  await writeSettingsJson(root, { ...settings, hooks: result.hooks });
  log.success(successMsg);
  return true;
}
