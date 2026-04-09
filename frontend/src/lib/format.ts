export const formatTime = (iso: string): string => {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0').slice(0, 2);
  return `${h}:${m}:${s}.${ms}`;
};
