# Code Structure Analysis Skill

A platform-agnostic Agent Skill for evidence-based repository analysis.

## Contents
- `SKILL.md`: skill metadata, trigger conditions, workflow, safety constraints, output contract.
- `scripts/project_scan.py`: read-only repository inventory helper (Python standard library only).
- `references/report-template.md`: report template.
- `tests/test-scenarios.md`: evaluation scenarios and acceptance criteria.

## Quick start
1. Place this folder in the skills directory supported by your coding agent.
2. Ask the agent: "Use code-structure-analysis to analyze this repository."
3. Provide the repository root and, optionally, a feature to trace.
4. The agent should inspect source files after the inventory; the helper script alone is not a complete analysis.

## Compatibility
The skill follows the common `SKILL.md` frontmatter convention. Exact installation paths and supported tool permissions depend on the host agent.
