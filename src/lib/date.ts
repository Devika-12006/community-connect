export function formatDate(isoString?: string): string {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Invalid date';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'N/A';
  }
}

export function formatTimeAgo(isoString?: string): string {
  if (!isoString) return '';
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return '';
  }
}

export function isOverdue(createdAt: string, targetHours: number = 48): boolean {
  if (!createdAt) return false;
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  const targetMs = targetHours * 3600 * 1000;
  return elapsedMs > targetMs;
}

export function getHoursOverdue(createdAt: string, targetHours: number = 48): number {
  if (!createdAt) return 0;
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  const targetMs = targetHours * 3600 * 1000;
  if (elapsedMs <= targetMs) return 0;
  return Math.floor((elapsedMs - targetMs) / (3600 * 1000));
}
