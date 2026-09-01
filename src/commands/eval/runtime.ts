import type { EvalScenario } from "../../types/index.js";
import type { CanonicalEvent } from "./transcript.js";

export interface RuntimeMetadata {
  readonly harness: "claude" | "cursor";
  readonly runtime: "sdk-local" | "cli-local";
  readonly productVersion: string;
  readonly model: string;
  readonly configSources: ReadonlyArray<string>;
}

export interface RuntimeTranscript {
  readonly raw: string;
  readonly events: ReadonlyArray<CanonicalEvent>;
  readonly metadata: RuntimeMetadata;
}

export interface RuntimeRunOptions {
  readonly cwd: string;
  readonly prompt: string;
  readonly timeout: number;
  readonly model?: string;
}

export interface EvalRuntime {
  readonly id: "claude" | "cursor";
  isAvailable(): Promise<boolean>;
  prepareSandbox(
    sandboxDir: string,
    projectRoot: string,
    scenario: EvalScenario,
  ): Promise<void>;
  run(options: RuntimeRunOptions): Promise<RuntimeTranscript>;
}
