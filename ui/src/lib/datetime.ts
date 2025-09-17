export function toDate(value: string | number): Date {
  if (typeof value === 'string') {
    // Assume ISO 8601 from API
    return new Date(value);
  }
  // Heuristics for numeric epochs
  // ns: ~1e18, µs: ~1e15, ms: ~1e12, s: ~1e9
  if (value > 1e17) return new Date(value / 1_000_000); // ns -> ms
  if (value > 1e14) return new Date(value / 1_000); // µs -> ms
  if (value > 1e12) return new Date(value); // already ms
  return new Date(value * 1000); // assume seconds
}

export function formatDate(value: string | number) {
  const d = toDate(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}
