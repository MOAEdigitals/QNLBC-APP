/** datetime-local is deliberately interpreted as Philippine time on every device. */
export function philippineScheduleISO(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Choose a date and time.');
  const date = new Date(value + ':00+08:00');
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new Error('Choose a future date and time in Philippine time.');
  return date.toISOString();
}
