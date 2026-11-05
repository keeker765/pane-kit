"""用一条命令更新面板数据，或直接算出一行进度。

三段式：`--from` 导入初始清单，`--where` 筛出要算的条目，其余参数写进面板。
面板每 3 秒读一次同一个文件；本脚本改一处就整份重写，先写 `.tmp` 再替换。

用法：
    python scripts/push.py --from tasks.md --file pane-data.json
    python scripts/push.py --file pane-data.json --where state=doing --stats
    python scripts/push.py --file pane-data.json --section tasks --item t1 \\
        --label "跑测试" --state doing --done 700 --total 1886 --ok 420 --eta 7800
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import sys
import time
from typing import Any, Callable

STATES = ("done", "doing", "blocked", "todo")
BAR_WIDTH = 10
# Markdown 清单的一行：`- [x] 文字`、`- [ ] 文字` 或 `- 文字`
CHECKBOX = re.compile(r"^\s*[-*]\s*(?:\[([ xX])\]\s*)?(.+?)\s*$")
# 筛选表达式：字段 运算符 值
WHERE = re.compile(r"^(state|label|id|progress|done)\s*(>=|<=|=|~|>|<)\s*(.+)$")


def load(path: Path) -> dict[str, Any]:
    """读现有面板数据；文件不存在或坏了都从空看板开始。"""
    if not path.is_file():
        return {"head": "", "sections": []}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"head": "", "sections": []}
    if not isinstance(raw, dict) or not isinstance(raw.get("sections"), list):
        return {"head": "", "sections": []}
    return raw


def seed_from_markdown(path: Path) -> dict[str, Any]:
    """把 `- [ ] 任务` 形式的清单读成看板；勾上的记为完成。"""
    text = path.read_text(encoding="utf-8")
    items = []
    for number, line in enumerate(text.splitlines()):
        match = CHECKBOX.match(line)
        if match is None:
            continue
        box, label = match.group(1), match.group(2)
        if label.endswith(":") or label.startswith("#"):
            continue
        state = "done" if box in ("x", "X") else "todo"
        entry: dict[str, Any] = {"id": f"t{number}", "label": label, "state": state}
        # 缩进每两级算一层，与 Markdown 惯例一致；顶格不写 depth
        level = (len(line) - len(line.lstrip())) // 2
        if level > 0:
            entry["depth"] = level
        items.append(entry)
    return {"head": path.stem, "sections": [{"id": "tasks", "title": "任务", "items": items}]}


def seed(path: Path) -> dict[str, Any]:
    """按后缀选导入方式：JSON 原样读，其余按 Markdown 清单解析。"""
    if path.suffix.lower() == ".json":
        return load(path)
    return seed_from_markdown(path)


def flatten(board: dict[str, Any]) -> list[dict[str, Any]]:
    """把各区块的条目摊平成一份列表，筛选用。"""
    out: list[dict[str, Any]] = []
    for section in board.get("sections", []):
        if isinstance(section, dict) and isinstance(section.get("items"), list):
            out.extend(one for one in section["items"] if isinstance(one, dict))
    return out


def make_predicate(expr: str) -> Callable[[dict[str, Any]], bool]:
    """把 `state=doing` 这类表达式变成一个判断函数。"""
    match = WHERE.match(expr.strip())
    if match is None:
        raise ValueError(f"筛选表达式看不懂：{expr}")
    field, op, raw = match.group(1), match.group(2), match.group(3)
    if op in (">", "<", ">=", "<="):
        try:
            limit = float(raw)
        except ValueError as error:
            raise ValueError(f"比较值不是数字：{raw}") from error
        pick = {
            ">": lambda v: v > limit,
            "<": lambda v: v < limit,
            ">=": lambda v: v >= limit,
            "<=": lambda v: v <= limit,
        }[op]
        return lambda item: isinstance(number_of(item, field), (int, float)) and pick(number_of(item, field))
    if op == "~":
        return lambda item: raw in str(item.get(field, ""))
    return lambda item: str(item.get(field, "")) == raw


def number_of(item: dict[str, Any], field: str) -> Any:
    """取条目上的一个数值；`done` 读的是 meter 里的已完成数。"""
    if field == "done":
        meter = item.get("meter")
        return meter.get("done") if isinstance(meter, dict) else item.get("progress", 0)
    return item.get(field, 0)


def render_bar(done: int, total: int, width: int = BAR_WIDTH) -> str:
    """画一条进度条，与面板里的 Meter 同形。"""
    if total <= 0:
        return "░" * width
    filled = max(0, min(width, round(done / total * width)))
    return "█" * filled + "░" * (width - filled)


def stats_line(items: list[dict[str, Any]]) -> str:
    """把一组成员算成一行进度：条、百分比、完成数、各状态计数。"""
    total = len(items)
    done = sum(1 for one in items if one.get("state") == "done")
    percent = round(done / total * 100) if total else 0
    buckets: dict[str, int] = {}
    for one in items:
        key = str(one.get("state", "todo"))
        buckets[key] = buckets.get(key, 0) + 1
    detail = " ".join(f"{key} {buckets[key]}" for key in STATES if key in buckets)
    return f"{render_bar(done, total)} {percent}% {done}/{total}  {detail}"


def find_section(board: dict[str, Any], section_id: str, title: str | None) -> dict[str, Any]:
    """按键取区块；没有就建一个，并接受顺手改标题。"""
    for one in board["sections"]:
        if isinstance(one, dict) and one.get("id") == section_id:
            if title is not None:
                one["title"] = title
            elif "title" not in one:
                one["title"] = section_id
            one.setdefault("items", [])
            return one
    section = {"id": section_id, "title": title or section_id, "items": []}
    board["sections"].append(section)
    return section


def find_item(section: dict[str, Any], item_id: str) -> dict[str, Any]:
    """按键取条目；没有就建一个占位条目，标签由调用方补。"""
    for one in section["items"]:
        if isinstance(one, dict) and one.get("id") == item_id:
            return one
    item: dict[str, Any] = {"id": item_id, "label": item_id, "state": "todo"}
    section["items"].append(item)
    return item


def apply_meter(item: dict[str, Any], args: argparse.Namespace) -> None:
    """按 --done/--total/--ok/--eta 更新计数进度；缺一项就沿用旧值。"""
    if args.clear_meter:
        item.pop("meter", None)
        return
    if args.done is None and args.total is None and args.ok is None and args.eta is None:
        return
    meter = item.get("meter") if isinstance(item.get("meter"), dict) else {}
    for key in ("done", "total", "ok", "eta"):
        value = getattr(args, key)
        if value is not None:
            meter[key] = value
    # 只有 done 没有 total 时补成 done，否则画不出比例
    meter.setdefault("total", meter.get("done", 0))
    meter.setdefault("done", 0)
    item["meter"] = meter


def update(item: dict[str, Any], args: argparse.Namespace) -> None:
    """把命令行给的字段写进一条条目。"""
    # 三个纯文本字段共用一条赋值路径，省得逐项重复
    for key in ("label", "state", "note"):
        value = getattr(args, key)
        if value is not None:
            item[key] = value
    if args.progress is not None:
        item["progress"] = max(0, min(100, args.progress))
    if args.depth is not None:
        item["depth"] = max(0, args.depth)
    apply_meter(item, args)


def save(path: Path, board: dict[str, Any]) -> None:
    """整份重写：先写 .tmp 再替换，面板不会读到半份文件。"""
    board["updated"] = int(time.time() * 1000)
    target = path.with_suffix(path.suffix + ".tmp")
    target.write_text(json.dumps(board, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(target, path)


def main() -> int:
    """命令行入口。"""
    parser = argparse.ArgumentParser(description="一条命令更新 pane-kit 面板数据")
    parser.add_argument("--file", default="pane-data.json", help="面板数据文件")
    parser.add_argument("--from", dest="seed_path", help="初始清单：Markdown 或 JSON")
    parser.add_argument("--where", help="筛选条目，如 state=doing、label~测试")
    parser.add_argument("--stats", action="store_true", help="只打印一行进度，不写文件")
    parser.add_argument("--head", help="页眉那行字")
    parser.add_argument("--section", help="区块 id；没有就创建")
    parser.add_argument("--title", help="区块标题；与 --section 同用")
    parser.add_argument("--item", help="条目 id；没有就创建")
    parser.add_argument("--label", help="条目文字")
    parser.add_argument("--state", choices=STATES, help="条目状态")
    parser.add_argument("--note", help="条目备注")
    parser.add_argument("--progress", type=int, help="0–100 的完成度")
    parser.add_argument("--done", type=int, help="计数进度的已完成数")
    parser.add_argument("--total", type=int, help="计数进度的总数")
    parser.add_argument("--ok", type=int, help="其中成功数")
    parser.add_argument("--eta", type=int, help="预计剩余秒数")
    parser.add_argument("--clear-meter", action="store_true", help="删掉计数进度")
    args = parser.parse_args()

    # 条目必须落在某个区块里
    if args.item is not None and args.section is None:
        parser.error("--item 需要同时给 --section")
    path = Path(args.file).expanduser()
    board = seed(Path(args.seed_path).expanduser()) if args.seed_path else load(path)
    if args.where is not None:
        chosen = [one for one in flatten(board) if make_predicate(args.where)(one)]
    else:
        chosen = flatten(board)
    if args.stats:
        print(stats_line(chosen))
        return 0
    if args.head is not None:
        board["head"] = args.head
    if args.section is not None:
        section = find_section(board, args.section, args.title)
        if args.item is not None:
            update(find_item(section, args.item), args)
    save(path, board)
    print(f"已写入 {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
