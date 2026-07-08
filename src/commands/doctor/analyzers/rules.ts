import { readFile } from "node:fs/promises";
import { basename, join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileExists } from "../../../lib/fs-utils.js";
import { ENHANCE_SKILL_VERSION } from "../../init/generators/skill-enhance.js";
import { WORKFLOW_RULE_VERSION } from "../../init/generators/workflow-rule.js";
import { HOOKS_RULE_VERSION } from "../../init/generators/hooks-rule.js";
import { VERIFICATION_RULE_VERSION } from "../../init/generators/verification-rule.js";
import { isSuperpowersInstalled } from "../../../lib/plugins.js";
import type {
  ClaudeConfig,
  AnalyzerResult,
  DiagnosticIssue,
} from "../../../types/index.js";

export async function analyzeRules(
  config: ClaudeConfig,
): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [];

  const projectRoot = config.claudeMdPath
    ? dirname(config.claudeMdPath)
    : process.cwd();

  // Check for BACKLOG.md
  const hasBacklog = await fileExists(join(projectRoot, "BACKLOG.md"));
  if (!hasBacklog) {
    issues.push({
      analyzer: "Rules",
      severity: "low",
      message:
        "No BACKLOG.md found — deferred features get lost in conversation history",
      fix: "Run `claude-launchpad init` or `doctor --fix` to generate one",
    });
  }

  // Check for workflow rule (path-scoped BACKLOG/TASKS rules)
  const hasWorkflowRule = await fileExists(
    join(projectRoot, ".claude", "rules", "workflow.md"),
  );
  if (!hasWorkflowRule) {
    issues.push({
      analyzer: "Rules",
      severity: "medium",
      message:
        "No .claude/rules/workflow.md found — BACKLOG/TASKS workflow is unenforced",
      fix: "Run `doctor --fix` to generate it",
    });
  }

  // Independent reviewer agent — same-model self-review misses what fresh eyes catch
  const hasReviewerAgent = await fileExists(
    join(projectRoot, ".claude", "agents", "code-reviewer.md"),
  );
  if (!hasReviewerAgent) {
    issues.push({
      analyzer: "Rules",
      severity: "low",
      message:
        "No .claude/agents/code-reviewer.md — sprint reviews run as same-model self-checks",
      fix: "Run `doctor --fix` to generate a fresh-context reviewer agent",
    });
  }

  // Ecosystem pointer, not a dependency: superpowers adds the discipline layer
  // (brainstorm/plan/TDD/review) that this template intentionally keeps minimal.
  if (!isSuperpowersInstalled()) {
    issues.push({
      analyzer: "Rules",
      severity: "info",
      message:
        "Optional: the superpowers plugin adds brainstorm/plan/TDD/review discipline — /plugin install superpowers@claude-plugins-official",
    });
  }

  // Stale workflow rule — versioned marker lets --fix upgrade shipped copies
  if (hasWorkflowRule) {
    const wfContent = await readFile(
      join(projectRoot, ".claude", "rules", "workflow.md"),
      "utf-8",
    ).catch(() => "");
    const wfMatch = wfContent.match(/<!-- lp-workflow-version: (\d+) -->/);
    const wfVersion = wfMatch ? parseInt(wfMatch[1], 10) : null;
    if (wfVersion !== null && wfVersion < WORKFLOW_RULE_VERSION) {
      issues.push({
        analyzer: "Rules",
        severity: "low",
        message: `workflow.md rule is outdated (v${wfVersion}, latest v${WORKFLOW_RULE_VERSION})`,
        fix: "Run `doctor --fix` to update it",
      });
    }
  }

  // Check for hooks rule (path-scoped settings.json hook authoring rules)
  const hasHooksRule = await fileExists(
    join(projectRoot, ".claude", "rules", "hooks.md"),
  );
  if (!hasHooksRule) {
    issues.push({
      analyzer: "Rules",
      severity: "medium",
      message:
        "No .claude/rules/hooks.md found — hook authoring rules unenforced (env-var bug, exit-code 2 vs 1, multi-matcher caveats)",
      fix: "Run `doctor --fix` to generate it",
    });
  }

  // Stale hooks rule — versioned marker lets --fix upgrade shipped copies
  if (hasHooksRule) {
    const hContent = await readFile(join(projectRoot, ".claude", "rules", "hooks.md"), "utf-8").catch(() => "");
    const hMatch = hContent.match(/<!-- lp-hooks-version: (\d+) -->/);
    const hVersion = hMatch ? parseInt(hMatch[1], 10) : null;
    if (hVersion !== null && hVersion < HOOKS_RULE_VERSION) {
      issues.push({
        analyzer: "Rules",
        severity: "low",
        message: `hooks.md rule is outdated (v${hVersion}, latest v${HOOKS_RULE_VERSION})`,
        fix: "Run \`doctor --fix\` to update it",
      });
    }
  }

  // Check for verification rule (always-on evidence-before-assertion discipline)
  const verificationPath = join(
    projectRoot,
    ".claude",
    "rules",
    "verification.md",
  );
  const hasVerificationRule = await fileExists(verificationPath);
  if (!hasVerificationRule) {
    issues.push({
      analyzer: "Rules",
      severity: "medium",
      message:
        "No .claude/rules/verification.md found — nothing stops premature 'done' claims without evidence",
      fix: "Run `doctor --fix` to generate it",
    });
  } else {
    const vContent = await readFile(verificationPath, "utf-8").catch(() => "");
    const vMatch = vContent.match(/<!-- lp-verification-version: (\d+) -->/);
    const vVersion = vMatch ? parseInt(vMatch[1], 10) : null;
    if (vVersion !== null && vVersion < VERIFICATION_RULE_VERSION) {
      issues.push({
        analyzer: "Rules",
        severity: "low",
        message: `verification.md rule is outdated (v${vVersion}, latest v${VERIFICATION_RULE_VERSION})`,
        fix: "Run `doctor --fix` to update it",
      });
    }
  }

  // Check for .claudeignore
  const hasClaudeignore = await fileExists(join(projectRoot, ".claudeignore"));
  if (!hasClaudeignore) {
    issues.push({
      analyzer: "Rules",
      severity: "low",
      message:
        "No .claudeignore found — Claude may read noise files (node_modules, dist, lockfiles)",
      fix: "Run `claude-launchpad init` or `doctor --fix` to generate one",
    });
  }

  // Check for /lp-enhance skill (new skills/ format or legacy commands/ format)
  const hasSkillInProject = config.skills.some(
    (s) =>
      (basename(s) === "SKILL.md" && s.includes("lp-enhance")) ||
      basename(s) === "lp-enhance.md",
  );
  const hasSkillGlobal =
    (await fileExists(
      join(homedir(), ".claude", "skills", "lp-enhance", "SKILL.md"),
    )) ||
    (await fileExists(join(homedir(), ".claude", "commands", "lp-enhance.md")));
  if (!hasSkillInProject && !hasSkillGlobal) {
    issues.push({
      analyzer: "Rules",
      severity: "low",
      message:
        "No /lp-enhance skill found — use it inside Claude Code to AI-complete your CLAUDE.md",
      fix: "Run `claude-launchpad init` or `doctor --fix` to generate the skill",
    });
  } else {
    const installedVersion = await getSkillVersion(projectRoot);
    if (installedVersion !== null && installedVersion < ENHANCE_SKILL_VERSION) {
      issues.push({
        analyzer: "Rules",
        severity: "low",
        message: `/lp-enhance skill is outdated (v${installedVersion}, latest v${ENHANCE_SKILL_VERSION})`,
        fix: "Run `doctor --fix` to update the skill",
      });
    }
  }

  if (config.rules.length === 0) {
    issues.push({
      analyzer: "Rules",
      severity: "low",
      message: "No .claude/rules/ files found",
      fix: "Move detailed conventions from CLAUDE.md to .claude/rules/*.md (auto-loaded, saves budget)",
    });
    return { name: "Rules", issues, score: 60 };
  }

  // Check for skill authoring conventions in any rules file
  let hasSkillAuthoring = false;
  for (const rulePath of config.rules) {
    try {
      const content = await readFile(rulePath, "utf-8");
      if (/^##\s+Skill\s+Authoring/im.test(content)) {
        hasSkillAuthoring = true;
        break;
      }
    } catch {
      continue;
    }
  }
  if (!hasSkillAuthoring) {
    issues.push({
      analyzer: "Rules",
      severity: "low",
      message: "No skill authoring conventions found in .claude/rules/",
      fix: "Run `doctor --fix` to add a Skill Authoring section to conventions.md",
    });
  }

  // Check for empty or near-empty rule files
  for (const rulePath of config.rules) {
    try {
      const content = await readFile(rulePath, "utf-8");
      const trimmed = content.trim();
      if (trimmed.length === 0) {
        issues.push({
          analyzer: "Rules",
          severity: "low",
          message: `Empty rule file: ${basename(rulePath)}`,
          fix: `Add content to ${basename(rulePath)} or delete it`,
        });
      } else if (trimmed.length < 20) {
        issues.push({
          analyzer: "Rules",
          severity: "info",
          message: `Very short rule file (${trimmed.length} chars): ${basename(rulePath)}`,
        });
      }
    } catch {
      issues.push({
        analyzer: "Rules",
        severity: "low",
        message: `Could not read rule file: ${basename(rulePath)}`,
      });
    }
  }

  const actionable = issues.filter((i) => i.severity !== "info").length;
  const score = Math.max(0, 100 - actionable * 10);
  return { name: "Rules", issues, score };
}

async function getSkillVersion(projectRoot: string): Promise<number | null> {
  const paths = [
    join(projectRoot, ".claude", "skills", "lp-enhance", "SKILL.md"),
    join(homedir(), ".claude", "skills", "lp-enhance", "SKILL.md"),
  ];

  for (const p of paths) {
    try {
      const content = await readFile(p, "utf-8");
      const match = content.match(/<!-- lp-enhance-version: (\d+) -->/);
      if (match) return parseInt(match[1], 10);
      // Skill exists but has no version tag — treat as v0 (pre-versioning)
      return 0;
    } catch {
      continue;
    }
  }
  return null;
}
