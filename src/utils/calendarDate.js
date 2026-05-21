/** Local calendar YYYY-MM-DD (matches browser-style civil dates). */
export function calendarDateStringLocal(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isPastCalendarDate(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return true;
  return ymd < calendarDateStringLocal();
}

export function filterQueueEntriesForCalendarDay(queueEntries, appointments, dayYmd) {
  const dates = new Map(appointments.map((a) => [a.id, a.date]));
  return queueEntries.filter((e) => dates.get(e.appointmentId) === dayYmd);
}
