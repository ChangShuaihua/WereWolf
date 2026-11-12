#!/usr/bin/env python3
"""Summarize changed files and hunk locations in a unified diff (stdlib only)."""
from pathlib import Path
import argparse
import re

def main():
    parser = argparse.ArgumentParser(description="Summarize a unified diff without executing project code.")
    parser.add_argument("diff_file", type=Path)
    args = parser.parse_args()
    if not args.diff_file.is_file():
        parser.error(f"Diff file not found: {args.diff_file}")

    text = args.diff_file.read_text(encoding="utf-8", errors="replace")
    current = None
    files = {}
    for line in text.splitlines():
        if line.startswith("+++ "):
            current = line[4:].strip()
            if current != "/dev/null":
                files.setdefault(current, {"hunks": [], "added": 0, "removed": 0})
        elif current and line.startswith("@@ "):
            match = re.search(r"\+(\d+)(?:,(\d+))?", line)
            if match:
                start = int(match.group(1))
                count = int(match.group(2) or "1")
                files[current]["hunks"].append((start, max(start, start + count - 1)))
        elif current and line.startswith("+") and not line.startswith("+++"):
            files[current]["added"] += 1
        elif current and line.startswith("-") and not line.startswith("---"):
            files[current]["removed"] += 1

    print(f"Changed files: {len(files)}")
    for name, data in files.items():
        ranges = ", ".join(f"{a}-{b}" for a, b in data["hunks"]) or "no hunks detected"
        print(f"\n{name}")
        print(f"  added: {data['added']} | removed: {data['removed']}")
        print(f"  new-line ranges: {ranges}")
    print("\nNote: This is a diff inventory only; it does not identify bugs or assess severity.")

if __name__ == "__main__":
    main()
