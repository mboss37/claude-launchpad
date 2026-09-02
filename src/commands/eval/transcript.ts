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
    } catch {}
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
  const blocked = findBlockedEvidence(record);
  if (blocked) events.push({ kind: "blocked", reason: blocked });
  const command = findShellCommand(record);
  if (command) events.push({ kind: "shell", command });
  const text = findAssistantText(record);
  if (text) events.push({ kind: "text", role: "assistant", content: text });
  return events;
}

function findBlockedText(value: unknown): string | null {
  if (typeof value === "string" && /BLOCKED/i.test(value)) {
    return blockedReason(value);
  }
  if (typeof value === "string" && /permission denied/i.test(value)) {
    return `BLOCKED: ${value.trim()}`;
  }
  if (value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findBlockedText(entry);
      if (found) return found;
    }
    return null;
  }
  for (const entry of Object.values(value as Record<string, unknown>)) {
    const found = findBlockedText(entry);
    if (found) return found;
  }
  return null;
}

function findBlockedEvidence(record: Record<string, unknown>): string | null {
  for (const candidate of denyCandidates(record)) {
    const blocked = findBlockedText(candidate);
    if (blocked) return blocked;
  }
  return null;
}

function denyCandidates(record: Record<string, unknown>): unknown[] {
  const candidates: unknown[] = [];
  if (record.type === "tool_result") {
    candidates.push(record.error, record.rejected);
    if (typeof record.content === "string") candidates.push(record.content);
    candidates.push(...structuredDenials(record.result));
  }
  if (record.type === "tool_call") {
    candidates.push(record.error, record.rejected);
    candidates.push(...structuredDenials(record.result));
    const toolCall = asRecord(record.tool_call);
    if (toolCall) {
      for (const value of Object.values(toolCall)) {
        const call = asRecord(value);
        if (!call) continue;
        candidates.push(call.error, call.rejected);
        candidates.push(...structuredDenials(call.result));
      }
    }
  }
  const message = asRecord(record.message);
  if (message && Array.isArray(message.content)) {
    for (const part of message.content) {
      const block = asRecord(part);
      if (block?.type === "tool_result") {
        candidates.push(...denyCandidates(block));
      }
    }
  }
  return candidates;
}

function structuredDenials(value: unknown): unknown[] {
  const record = asRecord(value);
  if (!record) return [];
  const denials: unknown[] = [];
  if (record.error != null) denials.push(record.error);
  if (record.rejected != null) denials.push(record.rejected);
  if (typeof record.errorMessage === "string")
    denials.push(record.errorMessage);
  return denials;
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
  const message = asRecord(record.message);
  if (record.type !== "assistant" && message?.role !== "assistant") return null;
  if (record.type === "assistant" && typeof record.content === "string") {
    return record.content;
  }
  if (message) {
    const content = message.content;
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
  const blocked = findBlockedEvidence(record);
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
  const nested = findNestedCursorTool(record);
  return nested?.name === "shell" ? commandFromArgs(nested.args) : null;
}

function findCursorTool(
  record: Record<string, unknown>,
): Extract<CanonicalEvent, { kind: "tool" }> | null {
  if (record.type !== "tool_call") return null;
  const name = typeof record.name === "string" ? record.name : "";
  if (name && name.toLowerCase() !== "shell") {
    return { kind: "tool", name, summary: summarizeArgs(record.args) };
  }
  const nested = findNestedCursorTool(record);
  if (!nested || nested.name === "shell") return null;
  return {
    kind: "tool",
    name: nested.name,
    summary: summarizeArgs(nested.args),
  };
}

function findNestedCursorTool(
  record: Record<string, unknown>,
): { readonly name: string; readonly args: unknown } | null {
  const toolCall = asRecord(record.tool_call);
  if (!toolCall) return null;
  for (const [key, value] of Object.entries(toolCall)) {
    if (!key.endsWith("ToolCall")) continue;
    const call = asRecord(value);
    if (!call) continue;
    const name = key.slice(0, -"ToolCall".length);
    return { name, args: call.args };
  }
  const generic = asRecord(toolCall.function);
  return generic && typeof generic.name === "string"
    ? { name: generic.name, args: generic.args }
    : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
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
