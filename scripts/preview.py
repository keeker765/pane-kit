"""把面板数据渲染成终端文字，用来在不开面板的情况下看排版。

版面规则与 `templates/pane-app` 的 `app/view.tsx` 一致：页眉、页签、卡片、
定高列表、右侧滚动条、以及带计数进度的第二行。只画第一个页签。

用法：
    python scripts/preview.py pane-data.json
    python scripts/preview.py pane-data.json --rows 24 --columns 60
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any
import unicodedata

# 页眉 1 + 页签 1 + 卡片上下边框 2 + 标题与副标题 2 + 外边距 1 + 余量 2
CHROME_ROWS = 9
TONE_MARK = {"done": "✓", "doing": "▶", "blocked": "⏸", "todo": "·"}
SPARK_BLOCKS = "▁▂▃▄▅▆▇█"
COLUMN_UNITS = " ▁▂▃▄▅▆▇█"
DOT_BITS = ((0x01, 0x08), (0x02, 0x10), (0x04, 0x20), (0x40, 0x80))
SPARK_WIDTH = 12


def width_of(text: str) -> int:
    """按终端格子算宽度：东亚宽字符占两格。"""
    return sum(2 if unicodedata.east_asian_width(one) in ("W", "F") else 1 for one in text)


def clip(text: str, cells: int) -> str:
    """按格子截断并补省略号，不切断半个宽字符。"""
    if cells <= 0:
        return ""
    if width_of(text) <= cells:
        return text
    used = 0
    out = []
    for one in text:
        step = 2 if unicodedata.east_asian_width(one) in ("W", "F") else 1
        if used + step > cells - 1:
            break
        used += step
        out.append(one)
    return "".join(out) + "…"


def pad(text: str, cells: int) -> str:
    """补空格到固定宽度；超宽先截断。"""
    head = clip(text, cells)
    return head + " " * max(0, cells - width_of(head))


def bar_cells(offset: int, rows: int, content: int, height: int) -> list[str]:
    """与 `kit/scroll.tsx` 的 scrollBarCells 同一套算法。"""
    if height <= 0 or content <= rows or rows <= 0:
        return [" "] * max(0, height)
    thumb = max(1, min(height, round(rows * height / content)))
    travel = height - thumb
    last = max(1, content - rows)
    start = round(max(0, min(offset, last)) / last * travel)
    return ["█" if start <= i < start + thumb else "│" for i in range(height)]


def tree_rows(items: list[dict[str, Any]], collapsed: list[str]) -> list[tuple[dict[str, Any], int, bool, bool]]:
    """与 `kit/tree.tsx` 的 buildTree 同一套算法：比自己深的下一行算子节点。"""
    closed = set(collapsed)
    rows: list[tuple[dict[str, Any], int, bool, bool]] = []
    hiding: int | None = None
    for index, one in enumerate(items):
        depth = max(0, int(one.get("depth", 0)))
        # 在折叠节点内部：比它深的继续跳过，回到同层就退出
        if hiding is not None:
            if depth > hiding:
                continue
            hiding = None
        nxt = items[index + 1] if index + 1 < len(items) else None
        has_children = nxt is not None and max(0, int(nxt.get("depth", 0))) > depth
        opened = one.get("id") not in closed
        rows.append((one, depth, has_children, opened))
        if has_children and not opened:
            hiding = depth
    return rows


def reduce_values(values: list[Any], cells: int) -> list[float]:
    """读数字并把超长序列按段平均压到 `cells` 格；负数与非数字归零。"""
    clean = [max(0.0, float(one)) if isinstance(one, (int, float)) else 0.0 for one in values]
    if len(clean) <= cells:
        return clean
    reduced = []
    for index in range(cells):
        start = index * len(clean) // cells
        end = (index + 1) * len(clean) // cells
        part = clean[start : max(start + 1, end)]
        reduced.append(sum(part) / len(part))
    return reduced


def fit_width(values: list[float], cells: int) -> list[float]:
    """把序列铺满 `cells` 格：长了按段平均，短了线性插值。"""
    if len(values) >= cells:
        return reduce_values(values, cells)
    last = max(1, len(values) - 1)
    out = []
    for index in range(cells):
        position = index / max(1, cells - 1) * last
        left = int(position)
        right = min(len(values) - 1, left + 1)
        ratio = position - left
        out.append(values[left] * (1 - ratio) + values[right] * ratio)
    return out


def sparkline(values: list[Any], width: int = SPARK_WIDTH) -> str:
    """与 `kit/chart.tsx` 的 sparkline 同一套算法：按峰值折成八档。"""
    clean = reduce_values(values, max(4, min(120, width)))
    if not clean:
        return ""
    peak = max(max(clean), 1.0)
    # int(x + 0.5) 对应 JS 的 Math.round；Python 的 round 在 .5 处取偶
    return "".join(SPARK_BLOCKS[int(one / peak * 7 + 0.5)] for one in clean)


def column_chart(values: list[float], height: int) -> list[str]:
    """与 `kit/chart.tsx` 的 columnChart 同一套算法，返回从顶到底的各行。"""
    rows = max(1, min(12, height))
    if not values:
        return []
    peak = max(max(values), 1.0)
    units = [int(one / peak * rows * 8 + 0.5) for one in values]
    out = []
    for index in range(rows):
        below = (rows - 1 - index) * 8
        out.append("".join(COLUMN_UNITS[max(0, min(8, one - below))] for one in units))
    return out


def js_round(value: float) -> int:
    """JS `Math.round` 的口径：.5 一律向上。"""
    return int(value + 0.5)


def draw_segment(grid: list[list[int]], start: tuple[int, int], end: tuple[int, int]) -> None:
    """在点阵上连一条线；按较长的一轴步进。"""
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    steps = max(abs(dx), abs(dy))
    for step in range(steps + 1):
        ratio = 0 if steps == 0 else step / steps
        grid[js_round(start[1] + dy * ratio)][js_round(start[0] + dx * ratio)] = 1


def line_chart(values: list[float], height: int) -> list[str]:
    """与 `kit/chart.tsx` 的 lineChart 同一套算法：2×4 盲文点阵。"""
    rows = max(2, min(12, height))
    if not values:
        return []
    peak = max(max(values), 1.0)
    dot_width = len(values) * 2
    dot_height = rows * 4
    grid = [[0] * dot_width for _ in range(dot_height)]
    previous = (0, dot_height - 1)
    last = max(1, len(values) - 1)
    for index, one in enumerate(values):
        point = (
            js_round(index / last * (dot_width - 1)),
            max(0, min(dot_height - 1, dot_height - 1 - js_round(one / peak * (dot_height - 1)))),
        )
        if index == 0:
            grid[point[1]][point[0]] = 1
        else:
            draw_segment(grid, previous, point)
        previous = point
    return [braille_row(grid, row, len(values)) for row in range(rows)]


def braille_row(grid: list[list[int]], row: int, cells: int) -> str:
    """把一行的 2×4 点阵合成盲文字符；没有点的格子退回空格。"""
    out = []
    for col in range(cells):
        code = 0
        for dy in range(4):
            for dx in range(2):
                if grid[row * 4 + dy][col * 2 + dx]:
                    code |= DOT_BITS[dy][dx]
        out.append(" " if code == 0 else chr(0x2800 + code))
    return "".join(out)


def chart_lines(chart: dict[str, Any], width: int, height: int) -> list[str]:
    """按区块的 chart 配置画整块图；非法配置返回空。"""
    values = chart.get("values")
    if not isinstance(values, list) or not values:
        return []
    shown = fit_width(reduce_values(values, 480), max(4, min(120, width)))
    if chart.get("kind") == "line":
        return line_chart(shown, height)
    return column_chart(shown, height)


def meter_line(meter: dict[str, Any]) -> str:
    """`█████░░░░░ 37% 700/1886 成功 420（60%） 剩 2 小时 10 分`。"""
    total = max(0, int(meter.get("total", 0)))
    done = max(0, min(total, int(meter.get("done", 0))))
    filled = round(done / total * 10) if total else 0
    parts = [f"{'█' * filled}{'░' * (10 - filled)}", f"{round(done / total * 100) if total else 0}% {done}/{total}"]
    if "ok" in meter:
        ok = max(0, min(done, int(meter["ok"])))
        parts.append(f"成功 {ok}（{round(ok / done * 100) if done else 0}%）")
    if "eta" in meter:
        seconds = max(0, int(meter["eta"]))
        if seconds < 60:
            parts.append(f"剩 {seconds} 秒")
        elif seconds < 3600:
            parts.append(f"剩 {seconds // 60} 分 {seconds % 60} 秒")
        else:
            parts.append(f"剩 {seconds // 3600} 小时 {seconds % 3600 // 60} 分")
    else:
        parts.append("估算中")
    # 有采样点时行尾补一行折线，与面板的进度行一致
    samples = meter.get("samples")
    if isinstance(samples, list):
        spell = sparkline(samples)
        if spell:
            parts.append(spell)
    return "  ".join(parts)


def render_tree_lines(items: list[dict[str, Any]], collapsed: list[str], inner: int) -> list[str]:
    """按树的样子画：缩进 + 三角 + 状态符号 + 标签。"""
    out = []
    for one, depth, has_children, opened in tree_rows(items, collapsed):
        triangle = ("▾" if opened else "▸") if has_children else " "
        body = "  " * depth + triangle + f" {TONE_MARK.get(one.get('state', 'todo'), '·')} {one.get('label', '')}"
        out.append("│ " + pad(body, inner) + " │")
    return out


def chart_card_lines(chart: dict[str, Any], inner: int, window: int) -> list[str]:
    """图表卡片的正文：图、说明、补齐的空行。"""
    height = chart.get("height")
    rows_wanted = height if isinstance(height, int) else min(12, max(2, window - 2))
    body = chart_lines(chart, inner - 2, rows_wanted)
    out = ["│ " + pad(one, inner) + " │" for one in body]
    note = chart.get("note")
    note_text = note if isinstance(note, str) else ""
    if note_text:
        out.append("│ " + pad(note_text, inner) + " │")
    used = len(body) + (1 if note_text else 0)
    for _ in range(max(0, window - used)):
        out.append("│ " + " " * inner + " │")
    return out


def render(
    board: dict[str, Any],
    rows: int,
    columns: int,
    collapsed: list[str] | None = None,
    section_id: str | None = None,
) -> list[str]:
    """画整块看板，返回逐行文本；给了 `collapsed` 就按树画，`section_id` 选页签。"""
    sections = board.get("sections") or []
    if not sections:
        return ["（没有数据）"]
    section = next((one for one in sections if one.get("id") == section_id), sections[0])
    items = [one for one in section.get("items", []) if isinstance(one, dict)]
    inner = columns - 4
    window = max(3, rows - CHROME_ROWS)
    lines = [f"{clip(str(board.get('head') or '面板'), inner)}"]

    # 页签行
    labels = " ".join(f"[{i + 1}] {one.get('title', '')}" for i, one in enumerate(sections))
    lines.append(clip(labels, inner))

    done = sum(1 for one in items if one.get("state") == "done")
    lines.append("┌" + "─" * (columns - 2) + "┐")
    lines.append("│ " + pad(str(section.get("title", "")), inner) + " │")
    raw_chart = section.get("chart")
    chart = raw_chart if isinstance(raw_chart, dict) else None
    subtitle = f"{done}/{len(items)} 完成"
    if chart is not None:
        kind = "折线" if chart.get("kind") == "line" else "柱状"
        subtitle = f"{kind} · {len(chart.get('values') or [])} 点"
    lines.append("│ " + pad(subtitle, inner) + " │")

    # 图表模式：整块画图，填满卡片正文
    if chart is not None:
        lines.extend(chart_card_lines(chart, inner, window))
        lines.append("└" + "─" * (columns - 2) + "┘")
        return lines

    # 树模式：不画滚动条，直接按折叠状态铺开
    if collapsed is not None:
        lines.extend(render_tree_lines(items, collapsed, inner))
        lines.append("└" + "─" * (columns - 2) + "┘")
        return lines

    content_lines = sum(2 if isinstance(one.get("meter"), dict) else 1 for one in items)
    bars = bar_cells(0, window, content_lines, window)
    line = 0
    for one in items:
        # 带进度的条目占两行，窗口按屏幕行算
        cost = 2 if isinstance(one.get("meter"), dict) else 1
        if line + cost > window:
            break
        tone = one.get("state", "todo")
        body = f"{TONE_MARK.get(tone, '·')} {one.get('label', '')}"
        lines.append("│ " + pad(body, inner - 2) + " " + bars[line] + " │")
        if cost == 2:
            lines.append("│   " + pad(meter_line(one["meter"]), inner - 2) + " " + bars[line + 1] + " │")
        line += cost
    # 行数不足时补空行，让卡片高度稳定
    for _ in range(max(0, window - line)):
        lines.append("│ " + " " * inner + " │")
    lines.append("└" + "─" * (columns - 2) + "┘")
    return lines


def main() -> int:
    """命令行入口。"""
    parser = argparse.ArgumentParser(description="把面板数据渲染成终端文字")
    parser.add_argument("data", help="面板数据文件")
    parser.add_argument("--rows", type=int, default=24, help="终端行数，默认 24")
    parser.add_argument("--columns", type=int, default=60, help="终端列数，默认 60")
    parser.add_argument("--tree", action="store_true", help="按折叠树画，而不是平铺列表")
    parser.add_argument("--collapsed", default="", help="已收起的节点 id，逗号分隔")
    parser.add_argument("--tab", default="", help="要画的区块 id；省略画第一个")
    args = parser.parse_args()
    path = Path(args.data).expanduser()
    board = json.loads(path.read_text(encoding="utf-8"))
    # 只有显式要树时才传 collapsed，否则按平铺列表画
    collapsed = [one for one in args.collapsed.split(",") if one] if args.tree else None
    for line in render(board, args.rows, args.columns, collapsed, args.tab or None):
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
