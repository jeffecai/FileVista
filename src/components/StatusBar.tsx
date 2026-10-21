import { useMemo } from 'react';
import { X } from 'lucide-react';
import { activeTabOf, runtimeOf, useApp } from '../store';
import { formatSize, sortEntries, THIS_PC } from '../lib/fs-utils';
import CapacityBar from './CapacityBar';
import type { PaneId } from '../types';

export default function StatusBar({ paneId }: { paneId: PaneId }) {
  const tab = useApp((s) => activeTabOf(s, paneId));
  const listing = useApp((s) => runtimeOf(s, tab.id).listing);
  const entries = useMemo(() => sortEntries(listing?.entries ?? [], tab.sort), [listing, tab.sort]);
  const runtime = useApp((s) => runtimeOf(s, tab.id));
  const drives = useApp((s) => s.drives);
  const ops = useApp((s) => s.ops);

  const isPc = tab.path === THIS_PC;
  const drive = !isPc ? drives.find((d) => tab.path.toLowerCase().startsWith(d.path.toLowerCase())) : undefined;
  const running = Object.values(ops).find((op) => op.state === 'running');

  const selectedBytes = entries
    .filter((entry) => runtime.selection.includes(entry.path))
    .reduce((sum, entry) => sum + (entry.size ?? 0), 0);

  const totalBytes = isPc
    ? drives.reduce((sum, item) => sum + (item.total ?? 0), 0)
    : (drive?.total ?? 0);
  const freeBytes = isPc
    ? drives.reduce((sum, item) => sum + (item.free ?? 0), 0)
    : (drive?.free ?? 0);
  const usedPercent = totalBytes > 0 ? ((totalBytes - freeBytes) / totalBytes) * 100 : 0;

  return (
    <div className="statusbar">
      <div className="status-left">
        <span>{isPc ? `${entries.length} 个驱动器` : `${entries.length} 项`}</span>
        {!isPc && runtime.selection.length > 0 && (
          <>
            <span className="status-dot">·</span>
            <span>选中 {runtime.selection.length}</span>
            {selectedBytes > 0 && (
              <>
                <span className="status-dot">·</span>
                <span>{formatSize(selectedBytes)}</span>
              </>
            )}
          </>
        )}
      </div>
      <div className="status-right">
        {running ? (
          <span className="status-op">
            <span>{running.op === 'copy' ? '复制中' : '移动中'} · {running.done} 项</span>
            <span className="status-current" title={running.current}>{running.current}</span>
            <button type="button" className="op-cancel" aria-label="取消操作" onClick={() => useApp.getState().cancelOp(running.opId)}>
              <X size={11} strokeWidth={1.8} />
            </button>
          </span>
        ) : isPc ? (
          <span className="status-cap">
            <CapacityBar percent={usedPercent} mini />
            <span>{drives.length} 个驱动器 · 可用 {formatSize(freeBytes)}</span>
          </span>
        ) : drive ? (
          <span className="status-cap">
            <CapacityBar percent={usedPercent} mini />
            <span>{drive.label} 可用 {formatSize(drive.free)}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
