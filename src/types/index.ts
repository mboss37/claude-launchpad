// ─── Project Detection Types ───

export interface DetectedProject {
  readonly name: string;
  readonly language: string | null;
  readonly framework: string | null;
  readonly packageManager: string | null;
  readonly hasTests: boolean;
  readonly hasLinter: boolean;
  readonly hasFormatter: boolean;
  readonly formatCommand: string | null;
  readonly lintCommand: string | null;
  readonly testCommand: string | null;
  readonly devCommand: string | null;
  readonly buildCommand: string | null;
}

// ─── Init Types ───

export interface InitOptions {
  readonly name: string;
  readonly description: string;
}

// ─── Doctor Types ───

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface DiagnosticIssue {
  readonly analyzer: string;
  readonly severity: Severity;
  readonly message: string;
  readonly fix?: string;
}

export interface AnalyzerResult {
  readonly name: string;
  readonly issues: ReadonlyArray<DiagnosticIssue>;
  readonly score: number; // 0-100
}

export interface DoctorReport {
  readonly analyzers: ReadonlyArray<AnalyzerResult>;
  readonly overallScore: number;
  readonly timestamp: string;
}

// ─── Eval Types ───

export interface EvalCheck {
  readonly type: "grep" | "file-exists" | "file-absent" | "max-lines" | "custom";
  readonly pattern?: string;
  readonly target: string;
  readonly expect: "present" | "absent";
  readonly points: number;
  readonly label: string;
}

export interface EvalScenario {
  readonly name: string;
  readonly description: string;
  readonly setup: {
    readonly files: ReadonlyArray<{ readonly path: string; readonly content: string }>;
    readonly instructions?: string;
  };
  readonly prompt: string;
  readonly checks: ReadonlyArray<EvalCheck>;
  readonly passingScore: number;
  readonly runs: number;
}

export interface EvalRunResult {
  readonly scenario: string;
  readonly score: number;
  readonly maxScore: number;
  readonly passed: boolean;
  readonly checks: ReadonlyArray<{
    readonly label: string;
    readonly passed: boolean;
    readonly points: number;
  }>;
}

export interface EvalReport {
  readonly results: ReadonlyArray<EvalRunResult>;
  readonly overallScore: number;
  readonly overallMax: number;
  readonly passed: boolean;
  readonly timestamp: string;
}

// ─── Config Parsing Types ───

export type MemoryPlacement = "shared" | "local";

export interface ClaudeConfig {
  readonly claudeMdPath: string | null;
  readonly claudeMdContent: string | null;
  readonly claudeMdInstructionCount: number;
  readonly settingsPath: string | null;
  readonly settings: Record<string, unknown> | null;
  readonly localClaudeMdContent: string | null;
  readonly localSettings: Record<string, unknown> | null;
  readonly hooks: ReadonlyArray<HookConfig>;
  readonly rules: ReadonlyArray<string>;
  readonly mcpServers: ReadonlyArray<McpServerConfig>;
  readonly skills: ReadonlyArray<string>;
  readonly claudeignorePath: string | null;
  readonly claudeignoreContent: string | null;
}

export type HookEvent = "PreToolUse" | "PostToolUse" | "SessionStart" | "SessionEnd" | "PostCompact" | "Stop";

export interface HookConfig {
  readonly event: HookEvent | string;
  readonly type: "command" | "prompt" | "agent" | "http";
  readonly matcher?: string;
  readonly command?: string;
  readonly timeout?: number;
}

export interface McpServerConfig {
  readonly name: string;
  readonly transport: "stdio" | "sse" | "http";
  readonly command?: string;
  readonly url?: string;
}
