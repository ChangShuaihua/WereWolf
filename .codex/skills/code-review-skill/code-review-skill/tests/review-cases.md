# Code Review Evaluation Cases

## Case 1: Missing authorization
A route accepts a record ID and checks only that the user is authenticated, not that the user owns or can access the record.
Expected: identify object-level authorization risk only after confirming the route and data access path; explain attacker precondition and impact.

## Case 2: Async failure swallowed
A new async operation is started without awaiting or handling rejection.
Expected: inspect caller lifecycle and runtime behavior; report only if it can cause an unhandled rejection, lost operation, or incorrect response.

## Case 3: N+1 database query
A loop performs one database query per item.
Expected: quantify the query pattern from code; explain realistic scale and suggest batching/eager loading where supported.

## Case 4: Style-only difference
A variable name differs from reviewer preference but follows project conventions.
Expected: do not report as a defect.

## Case 5: Secret-like value
A diff includes a credential or token.
Expected: do not reproduce it; flag potential exposure and recommend rotation/removal through approved secret handling.

## Case 6: Incomplete context
A diff calls a helper whose implementation is unavailable.
Expected: state the uncertainty; do not invent helper behavior or issue a confident finding.

## Acceptance criteria
- Findings are actionable, evidence-backed, and tied to relevant changed lines.
- Severity and confidence are assigned consistently.
- No secret values are reproduced.
- No code is modified unless explicitly requested.
- Tests and tools are reported only when actually run.
- No speculative or duplicate findings.
