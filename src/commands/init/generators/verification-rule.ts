export const VERIFICATION_RULE_VERSION = 1;

export function generateVerificationRule(): string {
  return `# Verification Rules

<!-- lp-verification-version: ${VERIFICATION_RULE_VERSION} -->

These rules govern every claim of "done", "fixed", "passing", or "works". A claim without evidence is a defect, no matter how good the code is.

## Evidence before assertion

- Never claim done/fixed/passing without having run the thing this session and quoting the output. The claim and its evidence travel together: "Done — 14/14 tests pass (output below)", never a bare "done".
- Verify the behavior, not the build. Compiling is not working; typechecking is not working. Exercise the changed flow end-to-end: run the command, hit the endpoint, click the path.
- For bug fixes: reproduce the failure FIRST and capture the exact error. Then fix, then re-run the original reproduction AND the surrounding tests. If you cannot explain the root cause, you have hidden the bug, not fixed it.
- Test the failure case, not just the happy path: feed the change the input that used to break it and confirm it now lands safely.

## Label your claims

Sort every load-bearing statement into one of three buckets, and say which out loud:

- **verified** — you read it or ran it this session
- **inferred** — follows logically from verified facts; state the chain
- **assumed** — plausible from prior knowledge; check it before building on it

Never let an assumption silently graduate into a fact. APIs, config keys, CLI flags, and package names cited from memory are the #1 hallucination vector — open the real source or current docs before citing them.

## When you can't verify

- If a step cannot be run (missing env, no credentials, no test data), the result is **done-with-gaps** — name each gap explicitly. Never round done-with-gaps up to done.
- Report failure plainly. Failing tests, skipped steps, and partial work get named with the output shown. "2 failures remain, here's the state" preserves trust; a false "all green" destroys it.

## End-of-turn check

Before ending a turn, re-read your last paragraph. If it is a promise ("I'll…", "next I would…"), a plan, or a question you could answer yourself — do that work now, then end. A turn ends on delivered results, not intentions.
`;
}
