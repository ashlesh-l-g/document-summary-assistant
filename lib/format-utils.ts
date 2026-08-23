/**
 * Format byte count into human-readable string (e.g. 1.2 MB, 450 KB)
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const formatted = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${formatted} ${units[i]}`;
}

/**
 * Format large numbers with comma separators (e.g. 12,450)
 */
export function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '0';
  return num.toLocaleString();
}
