/**
 * 行宽计算。
 *
 * 终端一列一格，东亚宽字符占两格：中日韩文字、全角符号、多数 emoji 都是。
 * 折行仍交给 `Text wrap`；这里只做两件事：发现过宽的行，以及确实要截断时按格子截。
 */

/** 宽度为两格的区段，闭区间；表外一律按一格算。 */
const WIDE: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f], // 谚文字母
  [0x2e80, 0x303e], // 中日韩部首与标点
  [0x3041, 0x33ff], // 假名、注音、中日韩兼容
  [0x3400, 0x4dbf], // 中日韩扩展 A
  [0x4e00, 0x9fff], // 中日韩统一表意文字
  [0xa000, 0xa4cf], // 彝文
  [0xac00, 0xd7a3], // 谚文音节
  [0xf900, 0xfaff], // 中日韩兼容表意文字
  [0xfe30, 0xfe6f], // 中日韩兼容形式与小写变体
  [0xff00, 0xff60], // 全角 ASCII
  [0xffe0, 0xffe6], // 全角符号
  [0x1f300, 0x1f64f], // 符号与表情
  [0x1f900, 0x1f9ff], // 补充符号与表情
  [0x20000, 0x3fffd], // 中日韩扩展 B 及以后
];

/** 组合用附加符号，占用 0 格。 */
const ZERO: readonly (readonly [number, number])[] = [
  [0x0300, 0x036f],
  [0x200b, 0x200f],
  [0xfe00, 0xfe0f],
];

/** 某个码点落在哪个区段；返回它占的格子数。 */
function cellOf(code: number): number {
  for (const [low, high] of ZERO) {
    if (code >= low && code <= high) return 0;
  }
  for (const [low, high] of WIDE) {
    if (code >= low && code <= high) return 2;
  }
  return 1;
}

/** 一段文字在终端里占几格。 */
export function displayWidth(text: string): number {
  let cells = 0;
  for (const one of text) {
    cells += cellOf(one.codePointAt(0) ?? 0);
  }
  return cells;
}

/** 按格子截断，超出时补省略号；永远不会切断半个宽字符。 */
export function clipToWidth(text: string, cells: number): string {
  if (cells <= 0) return '';
  if (displayWidth(text) <= cells) return text;
  const room = cells - 1;
  let used = 0;
  let out = '';
  for (const one of text) {
    const width = cellOf(one.codePointAt(0) ?? 0);
    if (used + width > room) break;
    used += width;
    out += one;
  }
  return `${out}…`;
}

/** 给某个宽度预算留白：把文字截到 `cells` 格以内。 */
export function padToWidth(text: string, cells: number): string {
  const clipped = clipToWidth(text, cells);
  return clipped + ' '.repeat(Math.max(0, cells - displayWidth(clipped)));
}
