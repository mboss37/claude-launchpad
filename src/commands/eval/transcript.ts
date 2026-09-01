export type CanonicalEvent =
  | { readonly kind: "tool"; readonly name: string; readonly summary: string }
  | { readonly kind: "shell"; readonly command: string }
  | { readonly kind: "blocked"; readonly reason: string }
  | {
      readonly kind: "text";
      readonly role: "user" | "assistant";
      readonly content: string;
    }
  | { readonly kind: "error"; readonly message: string };
