"""对生成的面板工程跑 manifest 校验、结构闸和可选测试。

用法：
    python scripts/verify.py <工程目录> [--test]
"""

from __future__ import annotations

import argparse
import glob
import os
from pathlib import Path
import subprocess
import sys

SKILL_GLOB = (
    ".claude/plugins/cache/code-arch-review/*/*/skills/code-arch-review/scripts/check.py"
)
CHECK_TARGETS = ("hooks", "app", "kit", "types")
SOURCE_SUFFIXES = (".ts", ".tsx", ".js", ".mjs", ".cjs")


def find_check_script() -> Path | None:
    """找结构闸脚本：先看环境变量，再找插件缓存里最新的一份。"""
    override = os.environ.get("CODE_ARCH_REVIEW_CHECK")
    if override and Path(override).is_file():
        return Path(override)
    pattern = str(Path.home() / SKILL_GLOB)
    matches = [Path(one) for one in glob.glob(pattern)]
    if not matches:
        return None
    # 缓存里可能有多份版本；按修改时间取最新，参数集才最新
    return max(matches, key=lambda path: path.stat().st_mtime)


def collect_sources(project: Path) -> list[str]:
    """列出要扫的源文件；闸不接受目录，必须给显式文件。"""
    files: list[str] = []
    for name in CHECK_TARGETS:
        root = project / name
        if not root.is_dir():
            continue
        for path in sorted(root.rglob("*")):
            if path.is_file() and path.suffix in SOURCE_SUFFIXES:
                files.append(str(path))
    return files


def run_command(argv: list[str], label: str) -> bool:
    """跑一条命令并原样输出；返回是否成功。"""
    print(f"\n== {label} ==")
    completed = subprocess.run(argv, text=True, encoding="utf-8", errors="replace")
    if completed.returncode != 0:
        print(f"失败：{label}（退出码 {completed.returncode}）")
    return completed.returncode == 0


def verify(project: Path, with_tests: bool) -> bool:
    """逐项校验，全部通过才返回 True。"""
    ok = run_command(["claude", "plugin", "validate", str(project)], "manifest 校验")
    check_script = find_check_script()
    if check_script is None:
        print("找不到 check.py；设置 CODE_ARCH_REVIEW_CHECK 指向它")
        return False
    targets = collect_sources(project)
    if not targets:
        print("工程里没有可扫的源文件")
        return False
    ok = run_command(
        [sys.executable, str(check_script), *targets, "--no-comments"],
        "结构闸",
    ) and ok
    tests = project / "tests"
    if with_tests and tests.is_dir():
        ok = run_command(["claude", "plugin", "test", str(project)], "插件测试") and ok
    return ok


def main() -> int:
    """命令行入口。"""
    parser = argparse.ArgumentParser(description="校验一个 pane-kit 面板工程")
    parser.add_argument("project", help="工程目录")
    parser.add_argument("--test", action="store_true", help="额外跑 claude plugin test")
    args = parser.parse_args()
    project = Path(args.project).expanduser().resolve()
    if not (project / ".claude-plugin" / "plugin.json").is_file():
        print(f"不是面板工程：{project}", file=sys.stderr)
        return 2
    return 0 if verify(project, args.test) else 1


if __name__ == "__main__":
    raise SystemExit(main())
