import { useEffect, useState } from 'react';
import api from '../api';

const cache = new Map<string, string | null>();

export function useThumbnails(paths: string[], size: number): Record<string, string | null> {
  const [, force] = useState(0);
  const key = paths.join('|');

  useEffect(() => {
    if (paths.length === 0) return;
    const missing = paths.filter((path) => !cache.has(`${size}:${path}`));
    if (missing.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void api.thumbnails(missing, size).then((result) => {
        for (const [path, url] of Object.entries(result)) cache.set(`${size}:${path}`, url);
        while (cache.size > 1200) {
          const first = cache.keys().next().value;
          if (!first) break;
          cache.delete(first);
        }
        if (!cancelled) force((value) => value + 1);
      }).catch(() => {});
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, size]);

  const map: Record<string, string | null> = {};
  for (const path of paths) map[path] = cache.get(`${size}:${path}`) ?? null;
  return map;
}
