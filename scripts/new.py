"""把模板与 kit 复制成一个可运行的面板插件目录。

用法：
    python scripts/new.py --name my-board --dest D:/py_projects/my-board
"""

from __future__ import annotations

import argparse
from pathlib import Path
import re
import shutil
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = REPO_ROOT / "templates" / "pane-app"
KIT_DIR = REPO_ROOT / "kit"
NAME_PATTERN = re.compile(r"^[a-z][a-z0-9_-]{0,40}$")
NAME_FILES = (
    "README.md",
    ".claude-plugin/plugin.json",
    "hooks/register.tsx",
    "types/index.d.ts",
    "tests/smoke.test.ts",
)


def check_name(name: str) -> str:
    """校验插件名。"""
    if not NAME_PATTERN.fullmatch(name):
        raise ValueError(f"名字不合法：{name}，只允许小写字母、数字、_、-，且以字母开头")
    return name


def copy_tree(target: Path) -> None:
    """复制模板与轮子；目标目录由 create_project 准备。"""
    shutil.copytree(TEMPLATE_DIR, target)
    shutil.copytree(KIT_DIR, target / "kit")


def rename_plugin(target: Path, name: str) -> None:
    """把模板里的 pane-app 字面量替换成实际名字。"""
    for relative in NAME_FILES:
        path = target / relative
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        path.write_text(text.replace("pane-app", name), encoding="utf-8")


def create_project(name: str, dest: Path, force: bool) -> Path:
    """生成工程，返回目标目录。"""
    if dest.exists() and any(dest.iterdir()) and not force:
        raise FileExistsError(f"目标目录非空：{dest}，加 --force 覆盖")
    if dest.exists() and force:
        shutil.rmtree(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    copy_tree(dest)
    rename_plugin(dest, name)
    return dest


def main() -> int:
    """命令行入口。"""
    parser = argparse.ArgumentParser(description="生成一个 pane-kit 面板插件")
    parser.add_argument("--name", required=True, help="插件名与命令名")
    parser.add_argument("--dest", required=True, help="目标目录")
    parser.add_argument("--force", action="store_true", help="覆盖非空目标目录")
    args = parser.parse_args()
    try:
        name = check_name(args.name)
        target = create_project(name, Path(args.dest).expanduser().resolve(), args.force)
    except (ValueError, FileExistsError) as error:
        print(error, file=sys.stderr)
        return 2
    print(f"已生成：{target}")
    print("下一步：改 app/data.ts 与 app/view.tsx，再跑 scripts/verify.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
