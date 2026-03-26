/**
 * Computes runtime context (dates, calendar info, etc.) that LLMs cannot
 * determine on their own. Injected into the system prompt on every request
 * so the model can correctly resolve "今天", "昨天", "本周", "上月" etc.
 */

const TIMEZONE = "Asia/Shanghai";
const LOCALE = "zh-CN";

function toShanghai(date: Date = new Date()): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60_000;
  const offset = 8 * 60 * 60_000; // UTC+8
  return new Date(utc + offset);
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtBQ(d: Date): string {
  return fmt(d).replace(/-/g, "");
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday as start
  r.setDate(r.getDate() - diff);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function getQuarter(d: Date): number {
  return Math.ceil((d.getMonth() + 1) / 3);
}

function startOfQuarter(d: Date): Date {
  const q = getQuarter(d);
  return new Date(d.getFullYear(), (q - 1) * 3, 1);
}

function endOfQuarter(d: Date): Date {
  const q = getQuarter(d);
  return new Date(d.getFullYear(), q * 3, 0);
}

function weekOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  return Math.ceil((diff / 86_400_000 + start.getDay() + 1) / 7);
}

export function buildRuntimeContext(): string {
  const now = toShanghai();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = addDays(today, -1);
  const dayBeforeYesterday = addDays(today, -2);
  const tomorrow = addDays(today, 1);

  const thisWeekStart = startOfWeek(today);
  const thisWeekEnd = addDays(thisWeekStart, 6);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekStart, -1);

  const thisMonthStart = startOfMonth(today);
  const thisMonthEnd = endOfMonth(today);
  const lastMonthEnd = addDays(thisMonthStart, -1);
  const lastMonthStart = startOfMonth(lastMonthEnd);

  const thisQuarterStart = startOfQuarter(today);
  const thisQuarterEnd = endOfQuarter(today);
  const lastQuarterEnd = addDays(thisQuarterStart, -1);
  const lastQuarterStart = startOfQuarter(lastQuarterEnd);

  const last7Start = addDays(today, -6);
  const last14Start = addDays(today, -13);
  const last30Start = addDays(today, -29);

  const weekday = now.toLocaleDateString(LOCALE, {
    weekday: "long",
    timeZone: TIMEZONE,
  });
  const quarter = getQuarter(today);
  const week = weekOfYear(today);
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `# 当前运行时上下文（程序自动计算，UTC+8 中国时区）

## 当前时间
- 现在：${fmt(today)} ${hours}:${minutes}（${weekday}）
- 年份：${today.getFullYear()}年  第${week}周  Q${quarter}

## 常用日期
- 今天：${fmt(today)}
- 昨天：${fmt(yesterday)}
- 前天：${fmt(dayBeforeYesterday)}
- 明天：${fmt(tomorrow)}

## 本周（周一至周日）
- 本周：${fmt(thisWeekStart)} ~ ${fmt(thisWeekEnd)}
- 上周：${fmt(lastWeekStart)} ~ ${fmt(lastWeekEnd)}

## 月份
- 本月：${fmt(thisMonthStart)} ~ ${fmt(thisMonthEnd)}
- 上月：${fmt(lastMonthStart)} ~ ${fmt(lastMonthEnd)}

## 季度
- 本季度（Q${quarter}）：${fmt(thisQuarterStart)} ~ ${fmt(thisQuarterEnd)}
- 上季度（Q${quarter === 1 ? 4 : quarter - 1}）：${fmt(lastQuarterStart)} ~ ${fmt(lastQuarterEnd)}

## 近 N 天
- 近7天：${fmt(last7Start)} ~ ${fmt(today)}
- 近14天：${fmt(last14Start)} ~ ${fmt(today)}
- 近30天：${fmt(last30Start)} ~ ${fmt(today)}

## BigQuery 事件表日期（YYYYMMDD 格式，用于 _TABLE_SUFFIX）
- 今天：${fmtBQ(today)}
- 昨天：${fmtBQ(yesterday)}
- 本周起：${fmtBQ(thisWeekStart)}
- 本月起：${fmtBQ(thisMonthStart)}
- 近7天起：${fmtBQ(last7Start)}
- 近30天起：${fmtBQ(last30Start)}`;
}
