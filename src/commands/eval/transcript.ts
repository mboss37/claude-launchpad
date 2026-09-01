export type CanonicalEvent =
  | { readonly kind: "tool"; readonly name: string; readonly summary: string }
  | { readonly kind: "shell"; readonly command: string }
  | { readonly kind: "blocked"; readonly reason: string }
  | {
      readonly kind: "text";
      readonly role: "user" | "assistant";
      readonly content: string;
    }
  | { readonly kind: "error"; readonly message: string };

export function serializeCanonicalEvents(
  events: ReadonlyArray<CanonicalEvent>,
): string {
  return events.map(formatCanonicalEvent).join("\n");
}

export function normalizeClaudeRaw(raw: string): ReadonlyArray<CanonicalEvent> {
  return normalizeJsonLines(raw, eventsFromUnknown);
}

export function normalizeCursorRaw(raw: string): ReadonlyArray<CanonicalEvent> {
  return normalizeJsonLines(raw, eventsFromCursorValue);
}

export function normalizeCursorSdkEvent(
  event: unknown,
): ReadonlyArray<CanonicalEvent> {
  return eventsFromCursorValue(event);
}

function normalizeJsonLines(
  raw: string,
  parse: (value: unknown) => ReadonlyArray<CanonicalEvent>,
): ReadonlyArray<CanonicalEvent> {
  const events: CanonicalEvent[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(...parse(JSON.parse(trimmed)));
    } catch {
      if (/BLOCKED/i.test(trimmed)) {
        events.push({ kind: "blocked", reason: blockedReason(trimmed) });
      }
    }
  }
  return events;
}

function formatCanonicalEvent(event: CanonicalEvent): string {
  switch (event.kind) {
    case "tool":
      return `tool: ${event.name} ${event.summary}`;
    case "shell":
      return `shell: ${event.command}`;
    case "blocked":
      return `blocked: ${event.reason}`;
    case "text":
      return `${event.role}: ${event.content}`;
    case "error":
      return `error: ${event.message}`;
  }
}

function eventsFromUnknown(value: unknown): ReadonlyArray<CanonicalEvent> {
  if (value === null || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const events: CanonicalEvent[] = [];
  const blocked = findBlocked(record);
  if (blocked) events.push({ kind: "blocked", reason: blocked });
  const command = findShellCommand(record);
  if (command) events.push({ kind: "shell", command });
  const text = findAssistantText(record);
  if (text) events.push({ kind: "text", role: "assistant", content: text });
  return events;
}

function findBlocked(value: unknown): string | null {
  if (typeof value === "string" && /BLOCKED/i.test(value)) {
    return blockedReason(value);
  }
  if (value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findBlocked(entry);
      if (found) return found;
    }
    return null;
  }
  for (const entry of Object.values(value as Record<string, unknown>)) {
    const found = findBlocked(entry);
    if (found) return found;
  }
  return null;
}

function findShellCommand(value: unknown): string | null {
  if (value === null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name : "";
  const input = record.input;
  if (
    name.toLowerCase() === "bash" &&
    input !== null &&
    typeof input === "object" &&
    "command" in input &&
    typeof (input as { command: unknown }).command === "string"
  ) {
    return (input as { command: string }).command;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findShellCommand(entry);
      if (found) return found;
    }
    return null;
  }
  for (const entry of Object.values(record)) {
    const found = findShellCommand(entry);
    if (found) return found;
  }
  return null;
}

function findAssistantText(value: unknown): string | null {
  if (value === null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type === "assistant" && typeof record.content === "string") {
    return record.content;
  }
  const message = record.message;
  if (message !== null && typeof message === "object") {
    const content = (message as { content?: unknown }).content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      const texts = content
        .filter(
          (part): part is { type: string; text: string } =>
            part !== null &&
            typeof part === "object" &&
            (part as { type?: unknown }).type === "text" &&
            typeof (part as { text?: unknown }).text === "string",
        )
        .map((part) => part.text);
      if (texts.length > 0) return texts.join("\n");
    }
  }
  return null;
}

function eventsFromCursorValue(value: unknown): ReadonlyArray<CanonicalEvent> {
  if (value === null || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const events: CanonicalEvent[] = [];
  const blocked = findBlocked(record);
  if (blocked) events.push({ kind: "blocked", reason: blocked });
  const command = findCursorShell(record);
  if (command) events.push({ kind: "shell", command });
  const tool = findCursorTool(record);
  if (tool) events.push(tool);
  const text = findAssistantText(record);
  if (text) events.push({ kind: "text", role: "assistant", content: text });
  return events;
}

function findCursorShell(record: Record<string, unknown>): string | null {
  const fromClaude = findShellCommand(record);
  if (fromClaude) return fromClaude;
  if (record.name === "shell" || record.name === "Shell") {
    return commandFromArgs(record.args);
  }
  const toolCall = record.tool_call;
  if (toolCall !== null && typeof toolCall === "object") {
    const shell = (toolCall as { shellToolCall?: { args?: unknown } })
      .shellToolCall;
    return commandFromArgs(shell?.args);
  }
  return null;
}

function findCursorTool(
  record: Record<string, unknown>,
): Extract<CanonicalEvent, { kind: "tool" }> | null {
  if (record.type !== "tool_call") return null;
  const name = typeof record.name === "string" ? record.name : "";
  if (!name || name.toLowerCase() === "shell") return null;
  return { kind: "tool", name, summary: summarizeArgs(record.args) };
}

function commandFromArgs(args: unknown): string | null {
  if (args !== null && typeof args === "object" && "command" in args) {
    const command = (args as { command: unknown }).command;
    return typeof command === "string" ? command : null;
  }
  return null;
}

function summarizeArgs(args: unknown): string {
  if (args === null || args === undefined) return "";
  if (typeof args === "string") return args;
  if (typeof args !== "object") return String(args);
  const record = args as Record<string, unknown>;
  for (const key of ["path", "query", "pattern", "command"] as const) {
    if (typeof record[key] === "string") return `${key}=${record[key]}`;
  }
  return "";
}

function blockedReason(text: string): string {
  const match = text.match(/BLOCKED[^"\\]*/i);
  return (match?.[0] ?? "BLOCKED").trim();
}
