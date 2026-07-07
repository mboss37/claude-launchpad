# Memory Feature Deep Review — 2026-07-07 (pre-v1.13.0-publish)

Four parallel reviewers (core/algorithms, CLI UX, dashboard TUI, competitive landscape), findings spot-checked before acceptance. Full agent evidence lives in session 49; this doc is the durable synthesis. Verified = code read / command run; key claims re-verified independently.

## Verdict

**v1.13.0 can publish** — every memory finding below is pre-existing in the already-published v1.12.0, and v1.13.0 carries a security patch that should not wait. Recommended gate: WP-036 (regression suite) + the S-sized CLI-honesty subset of WP-043. The deeper fixes are the next sprint (v1.14.0), the strategy arc after that.

## Cluster 1 — The CLI lies about success (WP-043, ship ASAP)

1. **Bare `claude-launchpad memory` crashes in non-TTY with exit 0** — the headline command calls `confirm()` with no TTY guard (index.ts:91) while install.ts:75 has the guard. CI sees a stack trace and a green exit.
2. **Sync failures exit 0** — "No sync gist found", "Could not detect project", "No memories found" all `log.error + return` (pull.ts:25-28,47-49,57-59; push.ts:80-82). memory.mdx:222 promises non-zero. Scripted pushes look successful while doing nothing.
3. **`memory stats` / `memory doctor` error cryptically** ("too many arguments") while a complete doctor.ts sits dead — never registered. extract.ts and search.ts are also unreachable (~350 dead lines). architecture.md documents them as real.
4. **`memory context --json` ignores `--json`** (context.ts has no JSON branch) and the generated SessionStart hook passes it.
5. **Hook invocation inconsistent**: context hook uses `npx claude-launchpad`, pull/push hooks use bare `claude-launchpad` — npx-only users get silent sync failure (swallowed by `2>/dev/null`).

## Cluster 2 — The algorithm doesn't do what it claims (WP-044/045/046/047/050)

1. **Decay compounds per session** (re-verified): `decayService.run()` fires on every SessionStart context load; `newImportance = memory.importance * decayFactor` persists onto the already-decayed value. Empirical: importance 0.8 semantic at day 30 = 0.767 pure-age vs 0.480 after 23 sessions (37% over-decay). Active users get punished hardest — backwards. Fix: immutable `base_importance`, decay as pure function of age.
2. **sqlite-vec is 100% dead weight** (re-verified): `memories_vec` table created, extension loaded on every open, `embedding` always null, zero reads/writes. Deleting it removes one of the two native deps users must install.
3. **content_hash UNIQUE is global, not per-project**: same insight can't exist in two projects; sync silently drops same-content/different-id rows while counting them as inserted (sync-merge.ts:74).
4. **"Blocks secrets" guardrail doesn't exist**: memory.md rule and MCP instructions claim it; content-validation.ts only rejects git-logs and >50% code. Memories sync to GitHub Gists — a real leak path.
5. **Benchmark oracle is misleading**: "greedy ≥70% of optimal" asserts ≥0.3 against a mismatched objective; the noise-penalty test has no assertion at all. Green suite ≠ measured quality.
6. Lesser: consolidation dedup is O(n²) and mostly redundant with the unique index; ~40 lines of dead retry/error scaffolding; dead config knobs (`enableReranker`, `accessModifiers`); duplicate prune paths; git-path injection scores exceed 1.0 vs fixed thresholds; accessCount conflates "surfaced" with "used"; several comments state math the code doesn't do.

## Cluster 3 — Dashboard: solid bones, two broken core interactions (WP-048/049)

Strengths: windowed list (scales), lazy-load discipline, keybinding bar + help overlay, rich detail pane, confirmed destructive ops, responsive layouts.

1. **Search can't lead to action**: while searching, j/k/Enter are swallowed; "Enter to keep" is wired to a no-op (`onClose={() => setSearchQuery(searchQuery)}`); Esc wipes the query. Find-then-act — the primary workflow — is impossible.
2. **Tab focus is cosmetic**: `focusedPane` changes a border color; no keybinding reads it.
3. **Relations render raw UUIDs**, not titles.
4. **Hard-delete only, no undo** — `d` purges a whole PROJECT (convention says `d` = one item); repo has softDelete, dashboard bypasses it.
5. **No error boundary** — one bad render strands the terminal in raw mode.
6. Per-keystroke synchronous SQLite relations query; FTS search path dead (hook re-implements substring search); `context` field stored but never shown; selectedIndex not clamped on narrowing; zero tests for hook/keybindings/components.

## Cluster 4 — Market position (strategy, WP-051)

Landscape (July 2026): Claude Code native memory is default-ON with auto-consolidation ("Auto Dream") — owns "Claude remembers" for solo/single-machine. claude-mem (86k stars) owns auto-capture but drags Bun+uv+Chroma and a flagged open localhost port. mem0 needs cloud keys. Zep/cognee need heavy infra. basic-memory proves local embeddings work with zero API cost.

**Real differentiators we hold**: zero-infra footprint; free cross-machine sync (nobody else); injection-time engineering (6-signal + MMR + budget packing — no one else does budget-aware diversity); memory inside a doctor/eval/benchmark toolchain ("we measure whether memory helps" — unique sentence).

**Table stakes we lack**: automatic capture (THE gap — we're a manual notebook in an auto-capture market), semantic search by default, plugin-marketplace install, human-auditable export.

**Ranked strategic moves**: (1) auto-capture via SessionEnd/Stop hooks — extract.ts is a head start; (2) local embeddings default-on (re-introduce sqlite-vec deliberately, wired this time); (3) ship as a Claude Code plugin — distribution is why claude-mem won; (4) native-memory continuous interop + markdown export; (5) git-committed team memory — empty lane, exactly our user.

**Positioning that survives Anthropic**: not "Claude remembers" — "memory as managed, measurable infrastructure": ranked retrieval at scale, free sync, team sharing, and proof via doctor/eval/benchmarks (including auditing native's own memory dir).
