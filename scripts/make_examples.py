"""按 examples/recipes 生成三个示例工程并逐一校验。

生成物落在 build/examples/，不提交。

用法：
    python scripts/make_examples.py
"""

from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import subprocess
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent
NEW_SCRIPT = REPO_ROOT / "scripts" / "new.py"
VERIFY_SCRIPT = REPO_ROOT / "scripts" / "verify.py"
RECIPES_DIR = REPO_ROOT / "examples" / "recipes"
RECIPES = ("json-board", "http-board", "session-hud", "memory-board")


def build(name: str, out_root: Path) -> Path:
    """用 new.py 生成一个工程。"""
    target = out_root / name
    subprocess.run(
        [sys.executable, str(NEW_SCRIPT), "--name", name, "--dest", str(target), "--force"],
        check=True,
    )
    return target


def overlay(name: str, target: Path) -> None:
    """把配方里的 data / view 覆盖到工程里。"""
    shutil.copy2(RECIPES_DIR / f"{name}.data.ts", target / "app" / "data.ts")
    shutil.copy2(RECIPES_DIR / f"{name}.view.tsx", target / "app" / "view.tsx")


def main() -> int:
    """命令行入口。"""
    parser = argparse.ArgumentParser(description="生成并校验 pane-kit 示例")
    parser.add_argument("--out", default=str(REPO_ROOT / "build" / "examples"), help="输出目录")
    args = parser.parse_args()
    out_root = Path(args.out).expanduser().resolve()
    out_root.mkdir(parents=True, exist_ok=True)
    failed: list[str] = []
    for name in RECIPES:
        target = build(name, out_root)
        overlay(name, target)
        completed = subprocess.run([sys.executable, str(VERIFY_SCRIPT), str(target)])
        if completed.returncode != 0:
            failed.append(name)
    if failed:
        print(f"失败的示例：{', '.join(failed)}")
        return 1
    print(f"全部通过：{out_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
