#!/usr/bin/env python3
"""Read-only repository inventory helper. Uses only the Python standard library."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

SKIP_DIRS = {
    ".git", "node_modules", "vendor", "dist", "build", ".next", ".nuxt",
    "coverage", "__pycache__", ".venv", "venv", "target", ".idea", ".vscode"
}
MANIFESTS = {
    "package.json", "pyproject.toml", "requirements.txt", "Pipfile",
    "pom.xml", "build.gradle", "build.gradle.kts", "go.mod", "Cargo.toml",
    "composer.json", "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
    "pnpm-workspace.yaml", "nx.json", "turbo.json"
}
SECRET_LIKE = {".env", ".env.local", ".env.production", "id_rsa", "id_ed25519"}


def safe_manifest(path: Path) -> dict:
    """Extract non-secret, high-level metadata only."""
    result = {"file": str(path)}
    if path.name == "package.json":
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            result.update({
                "name": data.get("name"),
                "scripts": sorted((data.get("scripts") or {}).keys()),
                "dependencies": sorted((data.get("dependencies") or {}).keys()),
                "devDependencies": sorted((data.get("devDependencies") or {}).keys()),
            })
        except Exception as exc:
            result["parse_note"] = f"Could not parse package.json: {type(exc).__name__}"
    elif path.name in {"requirements.txt"}:
        try:
            deps = []
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith(("#", "-")):
                    deps.append(line.split(";")[0].split("[")[0])
            result["declared_dependencies"] = deps[:100]
        except Exception as exc:
            result["parse_note"] = f"Could not parse requirements: {type(exc).__name__}"
    else:
        result["note"] = "Manifest detected; inspect manually for stack/config details."
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Inventory a source repository without modifying it.")
    parser.add_argument("root", type=Path, help="Repository root")
    parser.add_argument("--depth", type=int, default=3, help="Maximum directory depth (default: 3)")
    args = parser.parse_args()

    root = args.root.expanduser().resolve()
    if not root.is_dir():
        parser.error(f"Not a directory: {root}")

    print(f"# Repository inventory: {root}")
    print("\n## Directory tree")
    print(f"{root.name}/")

    manifests = []
    file_count = 0
    for current, dirs, files in __import__("os").walk(root):
        current_path = Path(current)
        rel = current_path.relative_to(root)
        depth = len(rel.parts)
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith(".cache"))
        if depth >= args.depth:
            dirs[:] = []
        indent = "  " * (depth + 1)
        for dirname in dirs:
            print(f"{indent}{dirname}/")
        for filename in sorted(files):
            file_count += 1
            file_path = current_path / filename
            if filename in MANIFESTS:
                manifests.append(file_path)
            if filename in SECRET_LIKE or filename.startswith(".env."):
                print(f"{indent}{filename} [sensitive config file; contents not read]")
            else:
                print(f"{indent}{filename}")

    print(f"\n## Inventory summary\n- Files encountered: {file_count}")
    print(f"- Manifest/config files found: {len(manifests)}")
    for path in manifests:
        print("\n### " + str(path.relative_to(root)))
        print(json.dumps(safe_manifest(path), ensure_ascii=False, indent=2))

    print("\n## Limitations")
    print("- This is a shallow inventory, not a semantic code parser.")
    print("- It does not establish runtime call chains or validate dependency installation.")
    print("- Hidden and generated directories are intentionally skipped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
