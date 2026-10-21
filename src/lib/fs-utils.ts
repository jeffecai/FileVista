import type { Entry, SortState } from '../types';

export const THIS_PC = '::thispc';

export function isThisPc(path: string): boolean {
  return path === THIS_PC;
}

export function sortEntries(entries: Entry[], sort: SortState): Entry[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let result = 0;
    if (sort.key === 'size') result = (a.size ?? 0) - (b.size ?? 0);
    else if (sort.key === 'mtime') result = (a.mtime ?? 0) - (b.mtime ?? 0);
    else if (sort.key === 'category') result = a.category.localeCompare(b.category);
    else result = a.name.localeCompare(b.name, 'zh-CN', { numeric: true, sensitivity: 'base' });
    if (result === 0) {
      result = a.name.localeCompare(b.name, 'zh-CN', { numeric: true, sensitivity: 'base' });
    }
    return result * dir;
  });
}

export function formatSize(size: number | null): string {
  if (size === null) return '';
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[index]}`;
}

export function formatDate(ms: number | null): string {
  if (!ms) return '';
  const date = new Date(ms);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  if (sameDay) return time;
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export function joinPath(dir: string, name: string): string {
  return `${dir.replace(/[\\/]+$/, '')}\\${name}`;
}

export function baseName(p: string): string {
  if (isThisPc(p)) return '此电脑';
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

export function dirName(p: string): string {
  if (isThisPc(p)) return '';
  const normalized = p.replace(/[\\/]+$/, '');
  const index = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'));
  if (index <= 1) return normalized.slice(0, index + 1);
  return normalized.slice(0, index);
}

export function splitPath(p: string): Array<{ label: string; path: string }> {
  if (isThisPc(p)) return [{ label: '此电脑', path: THIS_PC }];
  const normalized = p.replace(/\//g, '\\');
  const parts = normalized.split('\\').filter(Boolean);
  if (parts.length === 0) return [{ label: p, path: p }];
  const segments: Array<{ label: string; path: string }> = [];
  if (/^[A-Za-z]:$/.test(parts[0])) {
    segments.push({ label: parts[0], path: `${parts[0]}\\` });
    let acc = `${parts[0]}\\`;
    for (let i = 1; i < parts.length; i += 1) {
      acc = acc.endsWith('\\') ? acc + parts[i] : `${acc}\\${parts[i]}`;
      segments.push({ label: parts[i], path: acc });
    }
  } else {
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}\\${part}` : part;
      segments.push({ label: part, path: acc });
    }
  }
  return segments;
}

export function isValidName(name: string): string | null {
  if (!name.trim()) return '名称不能为空';
  if (/[\\/:*?"<>|]/.test(name)) return '名称不能包含 \\ / : * ? " < > |';
  if (name === '.' || name === '..') return '名称无效';
  return null;
}
