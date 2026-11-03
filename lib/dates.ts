import { TIME_ZONE } from "./config";

export type PeriodId = "today" | "yesterday" | "7" | "14" | "30" | "custom";

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "7", label: "7 dias" },
  { id: "14", label: "14 dias" },
  { id: "30", label: "30 dias" },
  { id: "custom", label: "Personalizado" },
];

export function isPeriodId(value: string): value is PeriodId {
  return PERIODS.some((period) => period.id === value);
}

/** Data YYYY-MM-DD no fuso da Cidade do México. */
export function mexicoToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const start = Date.UTC(y1, m1 - 1, d1);
  const end = Date.UTC(y2, m2 - 1, d2);
  return Math.round((end - start) / 86_400_000);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Período inclusivo. Personalizado usa as datas informadas, no máximo 90 dias. */
export function periodRange(
  today: string,
  period: PeriodId,
  custom?: { from: string; to: string },
): { from: string; to: string } {
  if (period === "custom") {
    if (!custom || !ISO_DATE.test(custom.from) || !ISO_DATE.test(custom.to) || custom.from > custom.to) {
      return { from: addDays(today, -6), to: today };
    }
    const span = daysBetween(custom.from, custom.to);
    if (span > 90 || custom.to > today) return { from: addDays(today, -6), to: today };
    return { from: custom.from, to: custom.to };
  }
  if (period === "today") return { from: today, to: today };
  if (period === "yesterday") {
    const yesterday = addDays(today, -1);
    return { from: yesterday, to: yesterday };
  }
  const length = period === "7" ? 7 : period === "14" ? 14 : 30;
  return { from: addDays(today, -(length - 1)), to: today };
}

export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}`;
}
