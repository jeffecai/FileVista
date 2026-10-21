import { HardDrive } from 'lucide-react';
import api from '../api';
import { activeTabOf, runtimeOf, useApp } from '../store';
import { formatSize } from '../lib/fs-utils';
import CapacityBar from './CapacityBar';
import type { PaneId } from '../types';

export default function DriveView({ paneId }: { paneId: PaneId }) {
  const tab = useApp((s) => activeTabOf(s, paneId));
  const runtime = useApp((s) => runtimeOf(s, tab.id));
  const listing = useApp((s) => runtimeOf(s, tab.id).listing);
  const entries = listing?.entries ?? [];

  return (
    <div className="driveview">
      <div className="drive-head">
        <span className="drive-title">此电脑</span>
        <span className="drive-count">{entries.length} 个驱动器</span>
      </div>
      <div className="drive-list">
        {entries.map((entry, index) => {
          const total = entry.total ?? null;
          const free = entry.free ?? null;
          const used = total && free !== null ? ((total - free) / total) * 100 : 0;
          const selected = runtime.selection.includes(entry.path);
          const cursor = runtime.cursor === index;
          return (
            <div
              key={entry.path}
              className={`drive-row ${selected ? 'is-selected' : ''} ${cursor ? 'is-cursor' : ''}`}
              onClick={(event) => useApp.getState().selectAt(
                paneId,
                index,
                event.shiftKey ? 'range' : (event.ctrlKey || event.metaKey) ? 'toggle' : 'single',
              )}
              onDoubleClick={() => useApp.getState().openEntry(paneId, entry)}
              onContextMenu={(event) => {
                event.preventDefault();
                void api.shellMenu(entry.path).catch((err: unknown) => {
                  useApp.getState().showToast(err instanceof Error ? err.message : '无法打开系统菜单', 'error');
                });
              }}
            >
              <span className="drive-icon"><HardDrive size={19} strokeWidth={1.4} /></span>
              <span className="drive-id">
                <span className="drive-letter">{entry.name}</span>
                <span className="drive-sub">本地磁盘</span>
              </span>
              <span className="drive-bar"><CapacityBar percent={used} /></span>
              <span className="drive-space">
                <span className="drive-free">可用 {free !== null ? formatSize(free) : '—'}</span>
                <span className="drive-total">共 {total !== null ? formatSize(total) : '—'}</span>
              </span>
              <span className="drive-percent">{total ? `${Math.round(used)}%` : '—'}</span>
            </div>
          );
        })}
        {entries.length === 0 && (
          <div className="empty">
            <p className="empty-title">没有可显示的驱动器。</p>
          </div>
        )}
      </div>
    </div>
  );
}
