import type { EvalScenario, EvalCheck } from "../../types/index.js";

/**
 * Validates a raw parsed YAML object against the EvalScenario schema.
 * Returns a validated scenario or throws with a descriptive error.
 */
export function validateScenario(raw: unknown, filePath: string): EvalScenario {
  if (!raw || typeof raw !== "object") {
    throw new ScenarioError(filePath, "Scenario must be a YAML object");
  }

  const obj = raw as Record<string, unknown>;

  const name = requireString(obj, "name", filePath);
  const description = requireString(obj, "description", filePath);
  const prompt = requireString(obj, "prompt", filePath);
  const setup = validateSetup(obj.setup, filePath);
  const checks = validateChecks(obj.checks, filePath);
  const passingScore = requireNumber(obj, "passingScore", filePath);
  const runs = optionalNumber(obj, "runs") ?? 3;

  return { name, description, setup, prompt, checks, passingScore, runs };
}

// ─── Field Validators ───

function validateSetup(
  raw: unknown,
  filePath: string,
): EvalScenario["setup"] {
  if (!raw || typeof raw !== "object") {
    throw new ScenarioError(filePath, '"setup" must be an object with a "files" array');
  }

  const obj = raw as Record<string, unknown>;
  const files = obj.files;

  if (!Array.isArray(files)) {
    throw new ScenarioError(filePath, '"setup.files" must be an array');
  }

  const validatedFiles = files.map((f, i) => {
    if (!f || typeof f !== "object") {
      throw new ScenarioError(filePath, `setup.files[${i}] must be an object`);
    }
    const file = f as Record<string, unknown>;
    if (typeof file.path !== "string" || typeof file.content !== "string") {
      throw new ScenarioError(filePath, `setup.files[${i}] must have "path" and "content" strings`);
    }
    return { path: file.path, content: file.content };
  });

  const instructions = typeof obj.instructions === "string" ? obj.instructions : undefined;

  return { files: validatedFiles, instructions };
}

function validateChecks(raw: unknown, filePath: string): ReadonlyArray<EvalCheck> {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ScenarioError(filePath, '"checks" must be a non-empty array');
  }

  return raw.map((c, i) => {
    if (!c || typeof c !== "object") {
      throw new ScenarioError(filePath, `checks[${i}] must be an object`);
    }
    const check = c as Record<string, unknown>;

    const validTypes = ["grep", "file-exists", "file-absent", "custom"];
    if (!validTypes.includes(check.type as string)) {
      throw new ScenarioError(filePath, `checks[${i}].type must be one of: ${validTypes.join(", ")}`);
    }

    if (typeof check.target !== "string") {
      throw new ScenarioError(filePath, `checks[${i}].target must be a string`);
    }

    const validExpect = ["present", "absent"];
    if (!validExpect.includes(check.expect as string)) {
      throw new ScenarioError(filePath, `checks[${i}].expect must be "present" or "absent"`);
    }

    if (typeof check.points !== "number" || check.points < 0) {
      throw new ScenarioError(filePath, `checks[${i}].points must be a non-negative number`);
    }

    if (typeof check.label !== "string") {
      throw new ScenarioError(filePath, `checks[${i}].label must be a string`);
    }

    return {
      type: check.type as EvalCheck["type"],
      pattern: typeof check.pattern === "string" ? check.pattern : undefined,
      target: check.target,
      expect: check.expect as EvalCheck["expect"],
      points: check.points,
      label: check.label,
    };
  });
}

// ─── Helpers ───

function requireString(obj: Record<string, unknown>, key: string, filePath: string): string {
  if (typeof obj[key] !== "string" || obj[key] === "") {
    throw new ScenarioError(filePath, `"${key}" must be a non-empty string`);
  }
  return obj[key] as string;
}

function requireNumber(obj: Record<string, unknown>, key: string, filePath: string): number {
  if (typeof obj[key] !== "number") {
    throw new ScenarioError(filePath, `"${key}" must be a number`);
  }
  return obj[key] as number;
}

function optionalNumber(obj: Record<string, unknown>, key: string): number | undefined {
  if (obj[key] === undefined) return undefined;
  if (typeof obj[key] !== "number") return undefined;
  return obj[key] as number;
}

class ScenarioError extends Error {
  constructor(filePath: string, message: string) {
    super(`Invalid scenario ${filePath}: ${message}`);
    this.name = "ScenarioError";
  }
}
