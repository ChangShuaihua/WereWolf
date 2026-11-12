# Review rubric

## Severity

| Level | Meaning | Guidance |
|---|---|---|
| P0 Critical | Severe, immediate impact such as broad compromise or irreversible data loss | Rare; explain why urgent mitigation is required |
| P1 High | Serious security, correctness, or availability impact under realistic conditions | Usually blocks merge |
| P2 Medium | Meaningful user-visible defect or operational risk with bounded scope | Should normally be fixed |
| P3 Low | Limited edge-case defect or concrete maintainability concern | Fix when practical |
| Info | Non-blocking question or optional improvement | Keep separate from defects |

Severity is based on impact and exploitability/reproducibility, not code complexity or personal preference.

## Confidence

- **High**: directly demonstrated by code and call path, or reproduced by an authorized test.
- **Medium**: strong evidence, but one relevant runtime/configuration detail is unavailable.
- **Low**: plausible concern with incomplete evidence. Prefer asking a question or omitting it.

## Finding quality checklist

A valid finding should answer:
1. Where is the problem? Exact changed line(s) or relevant location.
2. What is wrong? State the violated invariant or faulty behavior.
3. When does it happen? Give a concrete input, state, or environment.
4. Why does it matter? Explain user, security, data, or operational impact.
5. What is the smallest useful fix? Recommend a focused change, not an unnecessary rewrite.

Do not flag:
- formatting or naming preferences without a project rule;
- hypothetical vulnerabilities without an attack path;
- unchanged pre-existing issues unless they are directly exposed or worsened by this change;
- missing tests as a defect unless risk or project requirements make the gap actionable;
- issues already caught by a required automated check, unless the check is absent or ineffective.
