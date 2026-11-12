#!/usr/bin/env python3
"""只读仓库清点工具，仅使用 Python 标准库。"""
from __future__ import annotations

import argparse
import json
import os
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
    """只提取不含秘密的高层元数据。"""
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
            result["parse_note"] = f"无法解析 package.json：{type(exc).__name__}"
    elif path.name == "requirements.txt":
        try:
            deps = []
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith(("#", "-")):
                    deps.append(line.split(";")[0].split("[")[0])
            result["declared_dependencies"] = deps[:100]
        except Exception as exc:
            result["parse_note"] = f"无法解析 requirements.txt：{type(exc).__name__}"
    else:
        result["note"] = "已发现清单文件；请手动检查技术栈和配置细节。"
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="在不修改文件的前提下清点源码仓库。")
    parser.add_argument("root", type=Path, help="仓库根目录")
    parser.add_argument("--depth", type=int, default=3, help="最大目录深度，默认 3")
    args = parser.parse_args()

    root = args.root.expanduser().resolve()
    if not root.is_dir():
        parser.error(f"不是目录：{root}")

    print(f"# 仓库清点：{root}")
    print("\n## 目录树")
    print(f"{root.name}/")

    manifests = []
    file_count = 0
    for current, dirs, files in os.walk(root):
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
                print(f"{indent}{filename} [敏感配置文件；未读取内容]")
            else:
                print(f"{indent}{filename}")

    print(f"\n## 清点摘要\n- 遇到的文件数：{file_count}")
    print(f"- 发现的清单/配置文件数：{len(manifests)}")
    for path in manifests:
        print("\n### " + str(path.relative_to(root)))
        print(json.dumps(safe_manifest(path), ensure_ascii=False, indent=2))

    print("\n## 限制")
    print("- 这是浅层清点工具，不是语义代码解析器。")
    print("- 它不能证明运行时调用链，也不验证依赖是否安装。")
    print("- 隐藏目录、依赖目录和生成目录会被主动跳过。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
