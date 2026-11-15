// Small formatting helpers. Every string that reaches the page goes through esc().

/** Escape text for safe insertion into HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/** A dollar amount — '516.00', '0.5' or 500 — as '$516' or '$0.50'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  });
}

/** A whole number with thousands separators. */
export function whole(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
}

/** An ISO timestamp as a date + time in UTC. */
export function dateTime(iso) {
  if (!iso) return '—';
  return `${new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** An ISO timestamp as a short date in UTC. */
export function dateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
}

/** Time left until a deadline: '2d 4h left', '35m left', or 'ended'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

/**
 * Open or closed, decided by the deadline — never by status alone, because a
 * bounty past its deadline can still read "open" until results are published.
 */
export function statusBadge(b) {
  if (!b.deadline) return 'No deadline';
  if (b.winner || b.resolvedAt) return 'Results published';
  return new Date(b.deadline).getTime() > Date.now()
    ? `Open · ${timeLeft(b.deadline)}`
    : `Closed · ended ${dateShort(b.deadline)}`;
}

export function isOpen(b) {
  return Boolean(b.deadline) && new Date(b.deadline).getTime() > Date.now();
}

/** How long ago a fetch happened: 'just now', '2m ago', '3h ago'. */
export function ago(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function plural(n, word) {
  if (word === 'entry') return `${n} ${n === 1 ? 'entry' : 'entries'}`;
  return `${n} ${n === 1 ? word : `${word}s`}`;
}

/**
 * A leaderboard cell value in its column's unit. The API reports most numbers
 * in micro-units (×1,000,000) or as rates (×10,000); see column.source.
 */
export function cellValue(col, entry) {
  const raw = entry.display?.[col.key] ?? entry.values?.[col.key];
  if (raw === undefined || raw === null || raw === '') return '—';
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);
  if (col.key === 'valid') return n ? 'Yes' : 'No';
  const source = col.source || '';
  if (source.includes('artifact_bytes') || col.key === 'bytes') {
    return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
  }
  if (source.includes('_micro') || /micro/i.test(col.title || '')) {
    if (/rate|interval/i.test(col.title || '')) return `${(n / 10000).toFixed(1)}%`;
    return (n / 1000000).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return n.toLocaleString('en-US');
}
