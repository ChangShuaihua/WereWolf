# Code Review Skill

A reusable, evidence-based code review skill for AI coding agents.

## Contents
- `SKILL.md`: metadata, trigger conditions, review workflow, safety rules, output contract.
- `references/review-rubric.md`: severity, confidence, and finding-quality rubric.
- `references/report-template.md`: standard review report.
- `scripts/diff_summary.py`: read-only unified-diff inventory helper.
- `tests/review-cases.md`: evaluation scenarios and acceptance criteria.

## Quick start
Ask your coding agent:
"Use the code-review skill to review this branch's diff against main. Focus on correctness, security, and regression risks. Do not modify files."

Provide the diff or repository access. The skill should inspect changed lines and relevant surrounding code before reporting findings.

## Compatibility
Uses the common `SKILL.md` frontmatter convention. Installation path and tool permissions depend on the host agent.
