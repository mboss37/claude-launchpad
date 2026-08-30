import type { HookConfig, McpServerConfig } from "../../types/index.js";

export interface CursorHookConfig extends HookConfig {
  readonly failClosed?: boolean;
}

export interface CursorParseError {
  readonly path: string;
  readonly message: string;
}

export interface CursorConfig {
  readonly instructionsPath: string | null;
  readonly instructionsContent: string | null;
  readonly instructionCount: number;
  readonly hooksPath: string | null;
  readonly hooks: ReadonlyArray<CursorHookConfig>;
  readonly rules: ReadonlyArray<string>;
  readonly skills: ReadonlyArray<string>;
  readonly agents: ReadonlyArray<string>;
  readonly mcpServers: ReadonlyArray<McpServerConfig>;
  readonly ignorePath: string | null;
  readonly ignoreContent: string | null;
  readonly sandbox: Record<string, unknown> | null;
  readonly parseErrors: ReadonlyArray<CursorParseError>;
}
