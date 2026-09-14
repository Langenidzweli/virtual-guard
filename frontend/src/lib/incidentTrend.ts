// Calendar-day buckets cover every selected incident, including old all-time data.
export function incidentTrend(items: { detectedAt: string }[], days: number | null, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(today);
  if (days) start.setDate(start.getDate() - days + 1);
  const counts = new Map<string, number>();
  for (const item of items) {
    const date = new Date(item.detectedAt);
    if (!Number.isFinite(date.getTime())) continue;
    date.setHours(0, 0, 0, 0);
    if (!days && date < start) start.setTime(date.getTime());
    counts.set(date.toDateString(), (counts.get(date.toDateString()) ?? 0) + 1);
  }
  const trend: { date: Date; count: number }[] = [];
  for (const date = new Date(start); date <= today; date.setDate(date.getDate() + 1)) {
    trend.push({ date: new Date(date), count: counts.get(date.toDateString()) ?? 0 });
  }
  return trend;
}
