/**
 * LP-STUB markers wrap AI-recommended boilerplate injected by `doctor --fix`.
 * The intent analyzer treats a marked section as "not satisfied" so the user
 * sees the flag until they replace the stub with real content (or delete the markers).
 */

export const LP_STUB_OPEN = "<!-- LP-STUB: ai-recommended -->";
export const LP_STUB_CLOSE = "<!-- /LP-STUB -->";

export function wrapStub(content: string): string {
  return `${LP_STUB_OPEN}\n${content}\n${LP_STUB_CLOSE}`;
}

export function hasStubMarker(text: string): boolean {
  return text.includes(LP_STUB_OPEN);
}
