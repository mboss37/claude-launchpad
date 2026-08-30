export type HarnessId = "claude" | "cursor";
export type HarnessSelection = HarnessId | "auto" | "both";

export interface HarnessProfile<TConfig> {
  readonly id: HarnessId;
  readonly displayName: string;
  detect(projectRoot: string): Promise<boolean>;
  parse(projectRoot: string): Promise<TConfig>;
}
