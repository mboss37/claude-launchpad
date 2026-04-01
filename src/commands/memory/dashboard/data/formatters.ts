import type { Memory, MemoryType } from "../../types.js";
import { DEFAULT_DECAY_PARAMS } from "../../config.js";

// -- Blessed Tag Escaping -----------------------------------------------------

/** Escape curly braces so Blessed doesn't interpret them as markup tags.
 *  Uses fullwidth brackets (U+FF5B / U+FF5D) - visually identical in terminal fonts. */
export function escapeBlessedTags(text: string): string {
  return text.replace(/\{/g, "\uFF5B").replace(/\}/g, "\uFF5D");
}

// -- Relative Time ------------------------------------------------------------

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();

  if (diff < 0) return "just now";
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < MONTH) return `${Math.floor(diff / DAY)}d ago`;
  if (diff < YEAR) return `${Math.floor(diff / MONTH)}mo ago`;
  return `${Math.floor(diff / YEAR)}y ago`;
}

// -- Importance Bar -----------------------------------------------------------

const FILLED = "\u2588"; // full block
const EMPTY = "\u2591"; // light shade

export function formatImportanceBar(
  value: number,
  width: number = 8,
): string {
  const clamped = Math.max(0, Math.min(1, value));
  const filled = Math.round(clamped * width);
  return FILLED.repeat(filled) + EMPTY.repeat(width - filled);
}

// -- Truncation ---------------------------------------------------------------

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  if (maxLen <= 1) return "\u2026";
  return text.slice(0, maxLen - 1) + "\u2026";
}

// -- Byte Formatting ----------------------------------------------------------

const UNITS = ["B", "KB", "MB", "GB"] as const;

export function formatBytes(bytes: number): string {
  if (bytes < 0) return "0B";
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  if (unitIndex === 0) return `${value}B`;
  return `${value.toFixed(1)}${UNITS[unitIndex]}`;
}

// -- Lifespan Helpers ---------------------------------------------------------

export type LifespanStatus = "healthy" | "fading" | "stale" | "session";

export interface LifespanInfo {
  readonly status: LifespanStatus;
  readonly tauDays: number;
  readonly ageDays: number;
  readonly remaining: number;
}

export function tauDaysForType(type: MemoryType): number {
  return DEFAULT_DECAY_PARAMS.tauByType[type];
}

export function computeLifespan(memory: Memory): LifespanInfo {
  const tauDays = tauDaysForType(memory.type);
  if (tauDays === 0) {
    return {
      status: "session",
      tauDays,
      ageDays: 0,
      remaining: 0,
    };
  }

  const ageDays = Math.max(
    0,
    (Date.now() - new Date(memory.updatedAt).getTime()) / DAY,
  );
  const remaining = Math.max(0, Math.min(1, 1 - ageDays / (tauDays * 2)));
  const status: LifespanStatus =
    remaining > 0.62 ? "healthy" : remaining > 0.32 ? "fading" : "stale";
  return { status, tauDays, ageDays, remaining };
}

export function formatLifespanLabel(status: LifespanStatus): string {
  switch (status) {
    case "healthy":
      return "HEALTHY";
    case "fading":
      return "FADING ";
    case "stale":
      return "STALE  ";
    case "session":
      return "SESSION";
  }
}
