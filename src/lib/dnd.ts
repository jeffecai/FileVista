export function parsePathsFromDrop(data: DataTransfer): string[] {
  try {
    const raw = data.getData('application/x-folio');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

export function encodePaths(paths: string[]): string {
  return JSON.stringify(paths);
}

export function samePathSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a.map((p) => p.toLowerCase()));
  return b.every((p) => set.has(p.toLowerCase()));
}
