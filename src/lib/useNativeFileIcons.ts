import { useEffect, useState } from 'react';
import api from '../api';

const cache = new Map<string, string | null>();

export function useNativeFileIcons(paths: string[], large: boolean): Record<string, string | null> {
  const [, force] = useState(0);
  const key = paths.join('|');
  const sizeKey = large ? 'large' : 'normal';

  useEffect(() => {
    if (paths.length === 0) return;
    const missing = paths.filter((path) => !cache.has(`${sizeKey}:${path}`));
    if (missing.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void api.fileIcons(missing, large).then((result) => {
        for (const [path, url] of Object.entries(result)) cache.set(`${sizeKey}:${path}`, url);
        while (cache.size > 800) {
          const first = cache.keys().next().value;
          if (!first) break;
          cache.delete(first);
        }
        if (!cancelled) force((value) => value + 1);
      }).catch(() => {});
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, large, sizeKey, paths]);

  const map: Record<string, string | null> = {};
  for (const path of paths) map[path] = cache.get(`${sizeKey}:${path}`) ?? null;
  return map;
}
