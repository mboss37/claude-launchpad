import { describe, expect, it } from "vitest";
import {
  parseMemoryInstallHarness,
  resolveMemoryInstallTargets,
} from "../src/commands/memory/install-targets.js";

describe("parseMemoryInstallHarness", () => {
  it("accepts claude, cursor, and both", () => {
    expect(parseMemoryInstallHarness("claude")).toBe("claude");
    expect(parseMemoryInstallHarness("cursor")).toBe("cursor");
    expect(parseMemoryInstallHarness("both")).toBe("both");
  });

  it("rejects unknown harness names", () => {
    expect(() => parseMemoryInstallHarness("auto")).toThrow(
      /claude, cursor, or both/i,
    );
    expect(() => parseMemoryInstallHarness("")).toThrow(
      /claude, cursor, or both/i,
    );
  });
});

describe("resolveMemoryInstallTargets", () => {
  it("refuses to install when no harness is detected", () => {
    expect(() =>
      resolveMemoryInstallTargets({
        detected: [],
        allDetectedWhenUnspecified: true,
      }),
    ).toThrow(/init/i);
  });

  it("selects the only detected harness without a prompt", () => {
    expect(
      resolveMemoryInstallTargets({
        detected: ["cursor"],
        allDetectedWhenUnspecified: true,
      }),
    ).toEqual(["cursor"]);
    expect(
      resolveMemoryInstallTargets({
        detected: ["claude"],
        allDetectedWhenUnspecified: true,
      }),
    ).toEqual(["claude"]);
  });

  it("installs to every detected harness in non-interactive mode", () => {
    expect(
      resolveMemoryInstallTargets({
        detected: ["claude", "cursor"],
        allDetectedWhenUnspecified: true,
      }),
    ).toEqual(["claude", "cursor"]);
  });

  it("honors an explicit harness that is installed", () => {
    expect(
      resolveMemoryInstallTargets({
        detected: ["claude", "cursor"],
        explicit: "cursor",
        allDetectedWhenUnspecified: false,
      }),
    ).toEqual(["cursor"]);
  });

  it("rejects an explicit harness that is not installed", () => {
    expect(() =>
      resolveMemoryInstallTargets({
        detected: ["claude"],
        explicit: "cursor",
        allDetectedWhenUnspecified: false,
      }),
    ).toThrow(/cursor/i);
  });

  it("rejects --harness both when only one harness is installed", () => {
    expect(() =>
      resolveMemoryInstallTargets({
        detected: ["claude"],
        explicit: "both",
        allDetectedWhenUnspecified: false,
      }),
    ).toThrow(/cursor/i);
  });

  it("uses the checkbox selection when both harnesses are present", () => {
    expect(
      resolveMemoryInstallTargets({
        detected: ["claude", "cursor"],
        allDetectedWhenUnspecified: false,
        selected: ["cursor"],
      }),
    ).toEqual(["cursor"]);
  });

  it("rejects an empty checkbox selection", () => {
    expect(() =>
      resolveMemoryInstallTargets({
        detected: ["claude", "cursor"],
        allDetectedWhenUnspecified: false,
        selected: [],
      }),
    ).toThrow(/at least one/i);
  });
});
