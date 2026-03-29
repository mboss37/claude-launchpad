import { join, basename } from "node:path";
import { fileExists, readFileOrNull, readJsonOrNull } from "./fs-utils.js";
import type { DetectedProject } from "../types/index.js";

/**
 * Detect project characteristics by scanning manifest files and directory structure.
 * Works with any stack — no hardcoded list of supported frameworks.
 */
export async function detectProject(root: string): Promise<DetectedProject> {
  const name = basename(root);

  const [pkgJson, goMod, pyProject, gemfile, cargo, pubspec, composerJson, pomXml, buildGradle, packageSwift, mixExs, csproj, lockfiles] = await Promise.all([
    readJsonOrNull<PackageJson>(join(root, "package.json")),
    fileExists(join(root, "go.mod")),
    readFileOrNull(join(root, "pyproject.toml")),
    fileExists(join(root, "Gemfile")),
    fileExists(join(root, "Cargo.toml")),
    fileExists(join(root, "pubspec.yaml")),
    readJsonOrNull<ComposerJson>(join(root, "composer.json")),
    fileExists(join(root, "pom.xml")),
    fileExists(join(root, "build.gradle")) || fileExists(join(root, "build.gradle.kts")),
    fileExists(join(root, "Package.swift")),
    fileExists(join(root, "mix.exs")),
    globExists(root, "*.csproj"),
    detectLockfiles(root),
  ]);

  const manifests: ManifestState = {
    pkgJson, goMod, pyProject, gemfile, cargo, pubspec,
    composerJson, pomXml, buildGradle, packageSwift, mixExs, csproj,
  };

  const language = detectLanguage(manifests);
  const framework = detectFramework(manifests);
  const packageManager = detectPackageManager(manifests, lockfiles);
  const scripts = detectScripts({ pkgJson, pyProject, goMod, gemfile, composerJson, language });

  return {
    name,
    language,
    framework,
    packageManager,
    hasTests: scripts.testCommand !== null,
    hasLinter: scripts.lintCommand !== null,
    hasFormatter: scripts.formatCommand !== null,
    ...scripts,
  };
}

// ─── Language Detection ───

interface ManifestState {
  pkgJson: PackageJson | null;
  goMod: boolean;
  pyProject: string | null;
  gemfile: boolean;
  cargo: boolean;
  pubspec: boolean;
  composerJson: ComposerJson | null;
  pomXml: boolean;
  buildGradle: boolean;
  packageSwift: boolean;
  mixExs: boolean;
  csproj: boolean;
}

function detectLanguage(m: ManifestState): string | null {
  if (m.pkgJson?.devDependencies?.typescript || m.pkgJson?.dependencies?.typescript) return "TypeScript";
  if (m.pkgJson) return "JavaScript";
  if (m.goMod) return "Go";
  if (m.pyProject) return "Python";
  if (m.gemfile) return "Ruby";
  if (m.cargo) return "Rust";
  if (m.pubspec) return "Dart";
  if (m.composerJson) return "PHP";
  if (m.buildGradle) return "Kotlin";
  if (m.pomXml) return "Java";
  if (m.packageSwift) return "Swift";
  if (m.mixExs) return "Elixir";
  if (m.csproj) return "C#";
  return null;
}

// ─── Framework Detection ───

function detectFramework(m: ManifestState): string | null {
  const deps = { ...m.pkgJson?.dependencies, ...m.pkgJson?.devDependencies };

  // JS/TS frameworks
  if (deps.next) return "Next.js";
  if (deps.nuxt) return "Nuxt";
  if (deps.svelte || deps["@sveltejs/kit"]) return "SvelteKit";
  if (deps.astro) return "Astro";
  if (deps["@angular/core"]) return "Angular";
  if (deps.remix || deps["@remix-run/react"]) return "Remix";
  if (deps.vue) return "Vue";
  if (deps.react && !deps.next) return "React";
  if (deps.express) return "Express";
  if (deps.fastify) return "Fastify";
  if (deps.hono) return "Hono";
  if (deps.nestjs || deps["@nestjs/core"]) return "NestJS";

  // Python frameworks
  if (m.pyProject) {
    if (m.pyProject.includes("fastapi")) return "FastAPI";
    if (m.pyProject.includes("django")) return "Django";
    if (m.pyProject.includes("flask")) return "Flask";
  }

  // PHP frameworks
  if (m.composerJson) {
    const phpDeps = { ...m.composerJson.require, ...m.composerJson["require-dev"] };
    if (phpDeps["laravel/framework"]) return "Laravel";
    if (phpDeps["symfony/framework-bundle"]) return "Symfony";
  }

  // Ruby
  if (m.gemfile) return "Rails";

  // JVM
  if (m.buildGradle) return "Gradle"; // Could be Spring Boot, Android, etc.
  if (m.pomXml) return "Maven";

  return null;
}

// ─── Package Manager Detection ───

interface DetectedLockfiles {
  pnpmLock: boolean;
  yarnLock: boolean;
  bunLock: boolean;
  npmLock: boolean;
}

async function detectLockfiles(root: string): Promise<DetectedLockfiles> {
  const [pnpmLock, yarnLock, bunLock, npmLock] = await Promise.all([
    fileExists(join(root, "pnpm-lock.yaml")),
    fileExists(join(root, "yarn.lock")),
    fileExists(join(root, "bun.lockb")),
    fileExists(join(root, "package-lock.json")),
  ]);
  return { pnpmLock, yarnLock, bunLock, npmLock };
}

function detectPackageManager(
  m: Pick<ManifestState, "pkgJson" | "goMod" | "pyProject" | "gemfile" | "cargo" | "composerJson">,
  lockfiles: DetectedLockfiles,
): string | null {
  if (m.pkgJson) {
    // Check packageManager field first (most explicit)
    const pm = m.pkgJson.packageManager;
    if (pm?.startsWith("pnpm")) return "pnpm";
    if (pm?.startsWith("yarn")) return "yarn";
    if (pm?.startsWith("bun")) return "bun";
    if (pm?.startsWith("npm")) return "npm";

    // Fall back to lockfile detection
    if (lockfiles.pnpmLock) return "pnpm";
    if (lockfiles.yarnLock) return "yarn";
    if (lockfiles.bunLock) return "bun";
    if (lockfiles.npmLock) return "npm";

    return "npm";
  }
  if (m.goMod) return "go modules";
  if (m.pyProject) {
    if (m.pyProject.includes("[tool.uv]")) return "uv";
    if (m.pyProject.includes("[tool.poetry]")) return "poetry";
    return "pip";
  }
  if (m.gemfile) return "bundler";
  if (m.cargo) return "cargo";
  if (m.composerJson) return "composer";
  return null;
}

// ─── Script Detection ───

interface DetectedScripts {
  formatCommand: string | null;
  lintCommand: string | null;
  testCommand: string | null;
  devCommand: string | null;
  buildCommand: string | null;
}

// Language → default scripts config
const LANGUAGE_SCRIPTS: Record<string, DetectedScripts> = {
  Go:     { devCommand: "go run .",         buildCommand: "go build .",   testCommand: "go test ./...", lintCommand: "golangci-lint run",       formatCommand: "gofmt -w ." },
  Ruby:   { devCommand: "bin/dev",          buildCommand: null,           testCommand: "bin/rails test", lintCommand: "bin/rubocop",            formatCommand: null },
  PHP:    { devCommand: "php artisan serve", buildCommand: null,          testCommand: "php artisan test", lintCommand: "vendor/bin/phpstan analyse", formatCommand: "vendor/bin/pint" },
  Rust:   { devCommand: "cargo run",        buildCommand: "cargo build",  testCommand: "cargo test",   lintCommand: "cargo clippy",             formatCommand: "cargo fmt" },
  Java:   { devCommand: null,               buildCommand: "mvn package",  testCommand: "mvn test",     lintCommand: null,                       formatCommand: null },
  Kotlin: { devCommand: null,               buildCommand: "mvn package",  testCommand: "mvn test",     lintCommand: null,                       formatCommand: null },
  Swift:  { devCommand: null,               buildCommand: "swift build",  testCommand: "swift test",   lintCommand: "swiftlint",                formatCommand: "swift-format format -r ." },
  Elixir: { devCommand: "mix phx.server",   buildCommand: "mix compile",  testCommand: "mix test",     lintCommand: "mix credo",                formatCommand: "mix format" },
  "C#":   { devCommand: "dotnet run",       buildCommand: "dotnet build", testCommand: "dotnet test",  lintCommand: null,                       formatCommand: "dotnet format" },
};

function detectScripts(m: {
  pkgJson: PackageJson | null;
  pyProject: string | null;
  goMod: boolean;
  gemfile: boolean;
  composerJson: ComposerJson | null;
  language: string | null;
}): DetectedScripts {
  // JS/TS: read from package.json scripts
  if (m.pkgJson) {
    const scripts = m.pkgJson.scripts ?? {};
    const run = pmRun(m.pkgJson);
    return {
      devCommand: scripts.dev ? `${run} dev` : null,
      buildCommand: scripts.build ? `${run} build` : null,
      testCommand: scripts.test ? `${run} test` : null,
      lintCommand: scripts.lint ? `${run} lint` : null,
      formatCommand: scripts.format ? `${run} format` : null,
    };
  }

  // Python: runner depends on uv vs pip
  if (m.language === "Python") {
    const r = m.pyProject?.includes("[tool.uv]") ? "uv run" : "python -m";
    return { devCommand: null, buildCommand: null, testCommand: `${r} pytest`, lintCommand: `${r} ruff check .`, formatCommand: `${r} ruff format .` };
  }

  // Everything else: lookup table
  if (m.language && LANGUAGE_SCRIPTS[m.language]) {
    return LANGUAGE_SCRIPTS[m.language];
  }

  return { devCommand: null, buildCommand: null, testCommand: null, lintCommand: null, formatCommand: null };
}

function pmRun(pkg: PackageJson): string {
  const pm = pkg.packageManager;
  if (pm?.startsWith("pnpm")) return "pnpm";
  if (pm?.startsWith("yarn")) return "yarn";
  if (pm?.startsWith("bun")) return "bun";
  return "npm run";
}

// ─── Utilities ───

interface PackageJson {
  name?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface ComposerJson {
  require?: Record<string, string>;
  "require-dev"?: Record<string, string>;
}

async function globExists(dir: string, pattern: string): Promise<boolean> {
  const { readdir } = await import("node:fs/promises");
  try {
    const entries = await readdir(dir);
    return entries.some((e) => e.endsWith(pattern.replace("*", "")));
  } catch {
    return false;
  }
}
