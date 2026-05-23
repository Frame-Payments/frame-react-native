export function truncateToLimit(value: string, limit?: number): string {
  if (limit === undefined) return value;
  if (!Number.isInteger(limit) || limit <= 0) return value;
  return value.length > limit ? value.slice(0, limit) : value;
}
