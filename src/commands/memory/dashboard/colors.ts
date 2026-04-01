import type { MemoryType, RelationType } from "../types.js";

// -- Type Colors (blessed-compatible color names) -----------------------------

export const TYPE_COLORS: Record<MemoryType, string> = {
  working: "red",
  episodic: "yellow",
  semantic: "cyan",
  procedural: "green",
  pattern: "magenta",
};

// -- Type Abbreviations (4-char max) ------------------------------------------

export const TYPE_ABBREV: Record<MemoryType, string> = {
  working: "WORK",
  episodic: "EPIS",
  semantic: "SEMA",
  procedural: "PROC",
  pattern: "PTRN",
};

// -- Relation Colors ----------------------------------------------------------

export const RELATION_COLORS: Record<RelationType, string> = {
  relates_to: "white",
  depends_on: "blue",
  contradicts: "red",
  extends: "green",
  implements: "cyan",
  derived_from: "yellow",
};
