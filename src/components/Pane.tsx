import { useState } from 'react';
import api from '../api';
import { parsePathsFromDrop, samePathSet } from '../lib/dnd';
import { activeTabOf, useApp } from '../store';
import TabStrip from './TabStrip';
import PathBar from './PathBar';
import FileList from './FileList';
import StatusBar from './StatusBar';

export default function Pane({ paneId }: { paneId: 'a' | 'b' | 'c' | 'd' }) {
  const active = useApp((s) => s.activePane === paneId);
  const [dropActive, setDropActive] = useState(false);

  const acceptsDrop = (data: DataTransfer) => (
    data.types.includes('application/x-folio') || data.types.includes('Files')
  );

  return (
    <div
      className={`pane ${active ? 'is-active' : ''} ${dropActive ? 'is-drop' : ''}`}
      onMouseDown={() => useApp.getState().activatePane(paneId)}
      onDragOver={(event) => {
        if (!acceptsDrop(event.dataTransfer)) return;
        event.preventDefault();
        const internal = event.dataTransfer.types.includes('application/x-folio');
        event.dataTransfer.dropEffect = internal
          ? (event.ctrlKey ? 'copy' : 'move')
          : (event.shiftKey ? 'move' : 'copy');
        if (!dropActive) setDropActive(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const data = event.dataTransfer;
        const internalPaths = parsePathsFromDrop(data);
        const files = Array.from(data.files);
        const paths = internalPaths.length > 0
          ? internalPaths
          : files.map((file) => api.getPathForFile(file)).filter((p): p is string => Boolean(p));

        void (async () => {
          setDropActive(false);
          if (paths.length === 0) {
            if (files.length > 0) {
              useApp.getState().showToast('无法读取拖入项目的路径（压缩包、虚拟文件或权限不同）', 'error');
            }
            return;
          }
          let fromSelf = internalPaths.length > 0;
          if (!fromSelf) {
            const source = await api.takeDragSource();
            fromSelf = Boolean(source && samePathSet(source, paths));
          } else {
            await api.takeDragSource();
          }
          const state = useApp.getState();
          const tab = activeTabOf(state, paneId);
          const op = event.ctrlKey ? 'copy' : event.shiftKey ? 'move' : (fromSelf ? 'move' : 'copy');
          state.transferPaths(op, paths, tab.path);
        })();
      }}
    >
      <TabStrip paneId={paneId} />
      <PathBar paneId={paneId} />
      <FileList paneId={paneId} />
      <StatusBar paneId={paneId} />
      {dropActive && <div className="drop-hint">放开以放入</div>}
    </div>
  );
}
