export function mergeCursorHooks(
  existing: Record<string, unknown>,
  generated: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...existing,
    ...pickDefined(generated, "version"),
    hooks: mergeHookEvents(asRecord(existing.hooks), asRecord(generated.hooks)),
  };
}

export function mergeCursorMcp(
  existing: Record<string, unknown>,
  generated: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...existing,
    mcpServers: {
      ...asRecord(existing.mcpServers),
      ...asRecord(generated.mcpServers),
    },
  };
}

export function replaceVersionedCursorFile(
  existing: string,
  generated: string,
  markerPrefix: string,
): string | null {
  if (!existing.includes(`<!-- ${markerPrefix}`)) return null;
  return generated;
}

function mergeHookEvents(
  existing: Record<string, unknown>,
  generated: Record<string, unknown>,
): Record<string, unknown> {
  const events = new Set([...Object.keys(existing), ...Object.keys(generated)]);
  const merged: Record<string, unknown> = {};
  for (const event of events) {
    merged[event] = mergeHookList(existing[event], generated[event], event);
  }
  return merged;
}

function mergeHookList(
  existing: unknown,
  generated: unknown,
  event: string,
): ReadonlyArray<Record<string, unknown>> {
  const current =
    existing === undefined ? [] : requireHookArray(existing, event);
  const incoming =
    generated === undefined ? [] : requireHookArray(generated, event);
  const byCommand = new Map(
    incoming
      .filter((hook) => typeof hook.command === "string")
      .map((hook) => [hook.command as string, hook]),
  );
  const kept = current.map((hook) => {
    const command = hook.command;
    if (typeof command !== "string") return hook;
    return byCommand.get(command) ?? hook;
  });
  const seen = new Set(
    kept
      .map((hook) => hook.command)
      .filter((command): command is string => typeof command === "string"),
  );
  return [
    ...kept,
    ...incoming.filter((hook) => !seen.has(String(hook.command))),
  ];
}

function requireHookArray(
  value: unknown,
  event: string,
): ReadonlyArray<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw new Error(`Malformed hook array for ${event}`);
  }
  return value.map((entry) => asRecord(entry));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function pickDefined(
  source: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  if (!(key in source)) return {};
  return { [key]: source[key] };
}
