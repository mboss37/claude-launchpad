import { describe, it, expect, beforeEach } from "vitest";
import { detectProject } from "../src/lib/detect.js";
import { resolve, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `detect-test-${randomUUID()}`);
  await mkdir(testDir, { recursive: true });
});

describe("detectProject", () => {
  it("detects this project as TypeScript", async () => {
    const result = await detectProject(PROJECT_ROOT);
    expect(result.language).toBe("TypeScript");
    expect(result.packageManager).toBe("pnpm");
    expect(result.name).toBe("claude-launchpad");
  });

  it("detects dev and test commands from package.json scripts", async () => {
    const result = await detectProject(PROJECT_ROOT);
    expect(result.devCommand).toBe("pnpm dev");
    expect(result.testCommand).toBe("pnpm test");
    expect(result.buildCommand).toBe("pnpm build");
  });

  it("returns null language for empty directory", async () => {
    const result = await detectProject("/tmp");
    expect(result.language).toBeNull();
    expect(result.framework).toBeNull();
  });
});

describe("detectScripts via detectProject", () => {
  it("Go: returns go commands", async () => {
    await writeFile(join(testDir, "go.mod"), "module example.com/test\n");
    const result = await detectProject(testDir);
    expect(result.language).toBe("Go");
    expect(result.testCommand).toBe("go test ./...");
    expect(result.buildCommand).toBe("go build .");
    expect(result.devCommand).toBe("go run .");
    expect(result.lintCommand).toBe("golangci-lint run");
    expect(result.formatCommand).toBe("gofmt -w .");
  });

  it("Python (pip): returns python -m commands", async () => {
    await writeFile(join(testDir, "pyproject.toml"), '[project]\nname = "test"\n');
    const result = await detectProject(testDir);
    expect(result.language).toBe("Python");
    expect(result.testCommand).toBe("python -m pytest");
    expect(result.lintCommand).toBe("python -m ruff check .");
    expect(result.formatCommand).toBe("python -m ruff format .");
  });

  it("Python (uv): returns uv run commands", async () => {
    await writeFile(join(testDir, "pyproject.toml"), '[project]\nname = "test"\n\n[tool.uv]\n');
    const result = await detectProject(testDir);
    expect(result.language).toBe("Python");
    expect(result.packageManager).toBe("uv");
    expect(result.testCommand).toBe("uv run pytest");
    expect(result.lintCommand).toBe("uv run ruff check .");
    expect(result.formatCommand).toBe("uv run ruff format .");
  });

  it("Ruby: returns rails commands", async () => {
    await writeFile(join(testDir, "Gemfile"), 'source "https://rubygems.org"\n');
    const result = await detectProject(testDir);
    expect(result.language).toBe("Ruby");
    expect(result.testCommand).toBe("bin/rails test");
    expect(result.devCommand).toBe("bin/dev");
    expect(result.lintCommand).toBe("bin/rubocop");
    expect(result.formatCommand).toBeNull();
  });

  it("Rust: returns cargo commands", async () => {
    await writeFile(join(testDir, "Cargo.toml"), '[package]\nname = "test"\n');
    const result = await detectProject(testDir);
    expect(result.language).toBe("Rust");
    expect(result.testCommand).toBe("cargo test");
    expect(result.buildCommand).toBe("cargo build");
    expect(result.devCommand).toBe("cargo run");
    expect(result.lintCommand).toBe("cargo clippy");
    expect(result.formatCommand).toBe("cargo fmt");
  });

  it("Swift: returns swift commands", async () => {
    await writeFile(join(testDir, "Package.swift"), "// swift-tools-version: 5.9\n");
    const result = await detectProject(testDir);
    expect(result.language).toBe("Swift");
    expect(result.testCommand).toBe("swift test");
    expect(result.buildCommand).toBe("swift build");
    expect(result.lintCommand).toBe("swiftlint");
    expect(result.formatCommand).toBe("swift-format format -r .");
  });

  it("Elixir: returns mix commands", async () => {
    await writeFile(join(testDir, "mix.exs"), "defmodule Test.MixProject do\nend\n");
    const result = await detectProject(testDir);
    expect(result.language).toBe("Elixir");
    expect(result.testCommand).toBe("mix test");
    expect(result.buildCommand).toBe("mix compile");
    expect(result.devCommand).toBe("mix phx.server");
    expect(result.lintCommand).toBe("mix credo");
    expect(result.formatCommand).toBe("mix format");
  });

  it("C#: returns dotnet commands", async () => {
    await writeFile(join(testDir, "Test.csproj"), "<Project></Project>\n");
    const result = await detectProject(testDir);
    expect(result.language).toBe("C#");
    expect(result.testCommand).toBe("dotnet test");
    expect(result.buildCommand).toBe("dotnet build");
    expect(result.devCommand).toBe("dotnet run");
    expect(result.formatCommand).toBe("dotnet format");
  });

  it("PHP: returns artisan/composer commands", async () => {
    await writeFile(join(testDir, "composer.json"), JSON.stringify({ require: {} }));
    const result = await detectProject(testDir);
    expect(result.language).toBe("PHP");
    expect(result.testCommand).toBe("php artisan test");
    expect(result.devCommand).toBe("php artisan serve");
    expect(result.lintCommand).toBe("vendor/bin/phpstan analyse");
    expect(result.formatCommand).toBe("vendor/bin/pint");
  });

  it("Java (pom.xml): returns mvn commands", async () => {
    await writeFile(join(testDir, "pom.xml"), "<project></project>\n");
    const result = await detectProject(testDir);
    expect(result.language).toBe("Java");
    expect(result.testCommand).toBe("mvn test");
    expect(result.buildCommand).toBe("mvn package");
  });

  it("JS with npm: returns npm run commands", async () => {
    await writeFile(join(testDir, "package.json"), JSON.stringify({
      scripts: { dev: "node index.js", test: "jest", build: "tsc", lint: "eslint .", format: "prettier --write ." },
    }));
    const result = await detectProject(testDir);
    expect(result.language).toBe("JavaScript");
    expect(result.devCommand).toBe("npm run dev");
    expect(result.testCommand).toBe("npm run test");
    expect(result.buildCommand).toBe("npm run build");
    expect(result.lintCommand).toBe("npm run lint");
    expect(result.formatCommand).toBe("npm run format");
  });

  it("JS with pnpm: returns pnpm commands", async () => {
    await writeFile(join(testDir, "package.json"), JSON.stringify({
      packageManager: "pnpm@9.0.0",
      scripts: { dev: "vite", test: "vitest" },
    }));
    const result = await detectProject(testDir);
    expect(result.devCommand).toBe("pnpm dev");
    expect(result.testCommand).toBe("pnpm test");
  });

  it("unknown language: returns all nulls", async () => {
    await writeFile(join(testDir, "main.zig"), "const std = @import(\"std\");\n");
    const result = await detectProject(testDir);
    expect(result.language).toBeNull();
    expect(result.testCommand).toBeNull();
    expect(result.devCommand).toBeNull();
    expect(result.buildCommand).toBeNull();
    expect(result.lintCommand).toBeNull();
    expect(result.formatCommand).toBeNull();
  });
});
