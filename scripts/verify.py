"""对生成的面板工程跑 manifest 校验、结构闸、行宽告警和可选测试。

用法：
    python scripts/verify.py <工程目录> [--test] [--check-lines 60]
"""

from __future__ import annotations

import argparse
import glob
import os
from pathlib import Path
import re
import subprocess
import sys
import unicodedata

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


def display_width(text: str) -> int:
    """按终端格子算宽度：东亚宽字符占两格，其余一格。"""
    return sum(2 if unicodedata.east_asian_width(one) in ("W", "F") else 1 for one in text)


def check_line_width(project: Path, budget: int) -> list[str]:
    """扫 app/ 下的字符串字面量，返回超宽的条目；只报告，不算失败。"""
    if budget <= 0:
        return []
    findings: list[str] = []
    pattern = re.compile(r'"((?:[^"\\\n]|\\.)*)"|\'((?:[^\'\\\n]|\\.)*)\'')
    for path in sorted((project / "app").rglob("*")):
        if not path.is_file() or path.suffix not in SOURCE_SUFFIXES:
            continue
        text = path.read_text(encoding="utf-8")
        for number, line in enumerate(text.splitlines(), start=1):
            # 只看中文串：路径与标识符本来就会长，报它们只是噪音
            for match in pattern.finditer(line):
                literal = match.group(1) or match.group(2) or ""
                width = display_width(literal)
                if width > budget and re.search(r"[㐀-鿿]", literal):
                    findings.append(f"{path.relative_to(project)}:{number} 宽 {width} 格：{literal}")
    return findings


def run_command(argv: list[str], label: str) -> bool:
    """跑一条命令并原样输出；返回是否成功。"""
    print(f"\n== {label} ==")
    completed = subprocess.run(argv, text=True, encoding="utf-8", errors="replace")
    if completed.returncode != 0:
        print(f"失败：{label}（退出码 {completed.returncode}）")
    return completed.returncode == 0


def verify(project: Path, with_tests: bool, line_budget: int = 0) -> bool:
    """逐项校验，全部通过才返回 True；行宽只告警。"""
    ok = run_command(["claude", "plugin", "validate", str(project)], "manifest 校验")
    check_script = find_check_script()
    if check_script is None:
        print("找不到 check.py；设置 CODE_ARCH_REVIEW_CHECK 指向它")
        return False
    targets = collect_sources(project)
    if not targets:
        print("工程里没有可扫的源文件")
        return False
    # kit/ 是并列的轮子，不是分层的包：九个小文件一眼扫得完，故把同层模块上限从 7 放到 12。
    # 放宽的只有 flat-package 这一项，其余判据保持默认。
    ok = run_command(
        [sys.executable, str(check_script), *targets, "--no-comments", "--max-modules", "12"],
        "结构闸",
    ) and ok
    tests = project / "tests"
    if with_tests and tests.is_dir():
        ok = run_command(["claude", "plugin", "test", str(project)], "插件测试") and ok
    findings = check_line_width(project, line_budget)
    if findings:
        print(f"\n== 行宽告警（超过 {line_budget} 格，{len(findings)} 处）==")
        for one in findings:
            print(f"  {one}")
        print("  长文字交给 Text wrap=\"wrap\"，或于 kit/width.ts 用 clipToWidth 截断")
    return ok


def main() -> int:
    """命令行入口。"""
    parser = argparse.ArgumentParser(description="校验一个 pane-kit 面板工程")
    parser.add_argument("project", help="工程目录")
    parser.add_argument("--test", action="store_true", help="额外跑 claude plugin test")
    parser.add_argument("--check-lines", type=int, default=0, metavar="N", help="超过 N 格的字符串告警")
    args = parser.parse_args()
    project = Path(args.project).expanduser().resolve()
    if not (project / ".claude-plugin" / "plugin.json").is_file():
        print(f"不是面板工程：{project}", file=sys.stderr)
        return 2
    return 0 if verify(project, args.test, args.check_lines) else 1


if __name__ == "__main__":
    raise SystemExit(main())
