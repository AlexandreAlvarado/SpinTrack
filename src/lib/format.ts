export function formatDate(dateIso: string) {
  const [year, month, day] = dateIso.split("-").map(Number);
  if (!year || !month || !day) return dateIso;
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric" }).format(new Date(year, month - 1, day));
}

const santiagoShortDateTimeFormatter = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Formato estable para HTML SSR y el primer render del navegador. */
export function formatSantiagoShortDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const parts = Object.fromEntries(santiagoShortDateTimeFormatter.formatToParts(date).map(part => [part.type, part.value]));
  const hour24 = Number(parts.hour);
  const hour = hour24 % 12 || 12;
  const period = hour24 < 12 ? "a. m." : "p. m.";
  return `${parts.day}-${parts.month}-${parts.year.slice(-2)}, ${hour}:${parts.minute} ${period}`;
}
