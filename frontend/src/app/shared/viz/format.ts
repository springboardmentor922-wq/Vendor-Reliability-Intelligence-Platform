/** Number formatting shared by the dashboards. */

export function money(value: number | null | undefined, currency = 'USD', compact = true): string {
  const v = Number(value ?? 0);
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    notation: compact && Math.abs(v) >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: compact && Math.abs(v) >= 10_000 ? 2 : 0,
  }).format(v);
}

export function num(value: number | null | undefined, digits = 0): string {
  const v = Number(value ?? 0);
  return new Intl.NumberFormat('en-US', {
    notation: Math.abs(v) >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(v) >= 100_000 ? 1 : digits,
  }).format(v);
}

export function pct(value: number | null | undefined, digits = 1): string {
  return `${Number(value ?? 0).toFixed(digits)}%`;
}

export function bytes(value: number | null | undefined): string {
  let v = Number(value ?? 0);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function monthLabel(period: string): string {
  const [y, m] = period.split('-');
  if (!y || !m) return period;
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function monthShort(period: string): string {
  const [y, m] = period.split('-');
  if (!y || !m) return period;
  const d = new Date(Number(y), Number(m) - 1, 1);
  const label = d.toLocaleDateString('en-US', { month: 'short' });
  return Number(m) === 1 ? `${label} '${y.slice(2)}` : label;
}

export function monthLong(period: string): string {
  const [y, m] = period.split('-');
  if (!y || !m) return period;
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function duration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const diff = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** ISO date n days before today. */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
