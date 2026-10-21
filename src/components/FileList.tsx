import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AppWindow, File, FileArchive, FileImage, FileText, Film, Folder,
} from 'lucide-react';
import api from '../api';
import { activeTabOf, runtimeOf, useApp } from '../store';
import { formatDate, formatSize, sortEntries, THIS_PC } from '../lib/fs-utils';
import { useThumbnails } from '../lib/useThumbnails';
import { useNativeFileIcons } from '../lib/useNativeFileIcons';
import { iconForEntry } from '../lib/fileIcons';
import DriveView from './DriveView';
import type { Entry, PaneId, SortState } from '../types';

function EntryIcon({ entry, size = 15, colorMode = false, nativeUrl }: {
  entry: Entry;
  size?: number;
  colorMode?: boolean;
  nativeUrl?: string | null;
}) {
  if (colorMode) {
    const { src } = iconForEntry(entry);
    return (
      <img
        className="file-icon"
        src={nativeUrl ?? src}
        width={size}
        height={size}
        alt=""
        draggable={false}
      />
    );
  }
  const props = { size, strokeWidth: 1.5 } as const;
  if (entry.category === 'folder') {
    return <Folder {...props} fill="currentColor" fillOpacity={0.09} />;
  }
  if (entry.category === 'image') return <FileImage {...props} />;
  if (entry.category === 'media') return <Film {...props} />;
  if (entry.category === 'archive') return <FileArchive {...props} />;
  if (entry.category === 'app') return <AppWindow {...props} />;
  if (entry.category === 'text' || entry.category === 'doc') return <FileText {...props} />;
  return <File {...props} />;
}

const COLUMNS: Array<{ key: SortState['key']; label: string; className: string }> = [
  { key: 'name', label: 'Name', className: 'col-name' },
  { key: 'size', label: 'Size', className: 'col-size' },
  { key: 'mtime', label: 'Modified', className: 'col-mtime' },
];

export default function FileList({ paneId }: { paneId: PaneId }) {
  const tab = useApp((s) => activeTabOf(s, paneId));
  const runtime = useApp((s) => runtimeOf(s, tab.id));
  const listing = useApp((s) => runtimeOf(s, tab.id).listing);
  const entries = useMemo(() => sortEntries(listing?.entries ?? [], tab.sort), [listing, tab.sort]);
  const compact = useApp((s) => s.compact);
  const active = useApp((s) => s.activePane === paneId);
  const viewMode = useApp((s) => s.viewMode);
  const colorMode = useApp((s) => s.colorMode);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(1);

  const isGrid = viewMode !== 'list';
  const rowHeight = viewMode === 'list' ? (compact ? 26 : 30) : (viewMode === 'icons' ? 88 : 212);
  const rows = isGrid ? Math.max(1, Math.ceil(entries.length / Math.max(1, cols))) : entries.length;

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: isGrid ? 4 : 16,
  });
  const virtualizerRef = useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  useEffect(() => {
    virtualizerRef.current.measure();
  }, [rowHeight, cols]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab.path, viewMode]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isGrid) return;
    const update = () => {
      const width = Math.max(120, el.clientWidth - 24);
      const tile = viewMode === 'icons' ? 104 : 196;
      const next = Math.max(1, Math.floor(width / tile));
      setCols(next);
      useApp.getState().setGridCols(paneId, next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isGrid, viewMode, paneId]);

  useEffect(() => {
    if (!active || entries.length === 0) return;
    const index = isGrid ? Math.floor(runtime.cursor / Math.max(1, cols)) : runtime.cursor;
    virtualizerRef.current.scrollToIndex(index, { align: 'auto' });
  }, [active, runtime.cursor, entries.length, isGrid, cols]);

  const virtualRows = virtualizer.getVirtualItems();
  const thumbPaths = useMemo(() => {
    if (viewMode !== 'xlarge' || virtualRows.length === 0) return [] as string[];
    const start = Math.max(0, (virtualRows[0].index - 1) * cols);
    const end = (virtualRows[virtualRows.length - 1].index + 2) * cols;
    return entries
      .slice(start, end)
      .filter((entry) => entry.category === 'image' || entry.category === 'media')
      .map((entry) => entry.path);
  }, [viewMode, virtualRows, cols, entries]);
  const thumbs = useThumbnails(thumbPaths, 240);

  const visibleEntries = useMemo(() => {
    if (virtualRows.length === 0) return [] as Entry[];
    if (viewMode === 'list') {
      const start = Math.max(0, virtualRows[0].index - 2);
      const end = virtualRows[virtualRows.length - 1].index + 3;
      return entries.slice(start, end);
    }
    const start = Math.max(0, (virtualRows[0].index - 1) * cols);
    const end = (virtualRows[virtualRows.length - 1].index + 2) * cols;
    return entries.slice(start, end);
  }, [virtualRows, entries, cols, viewMode]);

  const nativePaths = useMemo(
    () => (colorMode ? visibleEntries.filter((entry) => iconForEntry(entry).native).map((entry) => entry.path) : [] as string[]),
    [colorMode, visibleEntries],
  );
  const nativeIcons = useNativeFileIcons(nativePaths, viewMode === 'xlarge');

  const showMenu = async (event: React.MouseEvent, entry?: Entry, index?: number) => {
    event.preventDefault();
    event.stopPropagation();
    const state = useApp.getState();
    const rt = runtimeOf(state, activeTabOf(state, paneId).id);
    if (entry && rt.selection.length <= 1 && !event.ctrlKey) {
      const shown = await api.shellMenu(entry.path).catch(() => false);
      if (shown) return;
    }
    const partner = paneId === 'a' ? 'b' : paneId === 'b' ? 'a' : paneId === 'c' ? 'd' : 'c';
    const partnerPath = runtimeOf(state, activeTabOf(state, partner).id).selection[0];
    let targets = rt.selection.length > 0 ? rt.selection : (entry ? [entry.path] : []);
    if (entry && index !== undefined && !rt.selection.includes(entry.path)) {
      state.selectAt(paneId, index, 'single');
      targets = [entry.path];
    }
    const canCompareTwo = targets.length === 2;
    const canComparePane = targets.length === 1
      && Boolean(partnerPath)
      && partnerPath!.toLowerCase() !== targets[0].toLowerCase();
    const compareItems = [
      ...(canCompareTwo ? [{ id: 'compare', label: '用 Beyond Compare 比较' }] : []),
      ...(canComparePane ? [{ id: 'compare-pane', label: '与另一栏选中项比较' }] : []),
      ...(canCompareTwo || canComparePane ? [{ id: 'sep-compare', type: 'separator' }] : []),
    ];
    const items = entry
      ? [
        { id: 'open', label: '打开' },
        { id: 'reveal', label: '在资源管理器中显示' },
        { id: 'sep-1', type: 'separator' },
        ...compareItems,
        { id: 'rename', label: '重命名' },
        { id: 'copy', label: `复制到${partner === 'a' || partner === 'c' ? '左' : '右'}栏` },
        { id: 'move', label: `移动到${partner === 'a' || partner === 'c' ? '左' : '右'}栏` },
        { id: 'sep-2', type: 'separator' },
        { id: 'copy-path', label: '复制路径' },
        { id: 'trash', label: '移到回收站' },
      ]
      : [
        { id: 'mkdir', label: '新建文件夹' },
        { id: 'refresh', label: '刷新' },
        { id: 'sep-3', type: 'separator' },
        { id: 'hidden', label: state.showHidden ? '隐藏隐藏文件' : '显示隐藏文件' },
        { id: 'preview', label: state.previewOpen ? '关闭预览' : '打开预览' },
        { id: 'compact', label: state.compact ? '舒适行距' : '紧凑行距' },
        { id: 'sep-4', type: 'separator' },
        { id: 'compare-locate', label: '定位 Beyond Compare…' },
      ];
    const action = await api.menu(items);
    if (!action) return;
    const now = useApp.getState();
    switch (action) {
      case 'open':
        if (entry) now.openEntry(paneId, entry);
        break;
      case 'reveal':
        if (entry) void api.reveal(entry.path);
        break;
      case 'rename':
        now.promptRename(paneId);
        break;
      case 'copy':
        now.transferSelection(paneId, 'copy');
        break;
      case 'move':
        now.transferSelection(paneId, 'move');
        break;
      case 'copy-path':
        void api.copyText(targets.join('\n'));
        now.showToast('路径已复制');
        break;
      case 'trash':
        now.askTrash(paneId);
        break;
      case 'mkdir':
        now.promptMkdir(paneId);
        break;
      case 'refresh':
        now.refreshPane(paneId);
        break;
      case 'hidden':
        now.toggleHidden();
        break;
      case 'preview':
        now.togglePreview();
        break;
      case 'compact':
        now.toggleCompact();
        break;
      case 'compare':
        void api.compare(targets)
          .then(() => now.showToast('已在 Beyond Compare 中打开'))
          .catch((err: unknown) => now.showToast(err instanceof Error ? err.message : '无法启动 Beyond Compare', 'error'));
        break;
      case 'compare-pane':
        if (partnerPath) {
          void api.compare([targets[0], partnerPath])
            .then(() => now.showToast('已在 Beyond Compare 中打开'))
            .catch((err: unknown) => now.showToast(err instanceof Error ? err.message : '无法启动 Beyond Compare', 'error'));
        }
        break;
      case 'compare-locate':
        void api.locateCompare()
          .then((chosen) => { if (chosen) now.showToast('已设置 Beyond Compare 路径'); })
          .catch((err: unknown) => now.showToast(err instanceof Error ? err.message : '定位失败', 'error'));
        break;
      default:
        break;
    }
  };

  const select = (index: number, event: React.MouseEvent) => {
    useApp.getState().selectAt(
      paneId,
      index,
      event.shiftKey ? 'range' : (event.ctrlKey || event.metaKey) ? 'toggle' : 'single',
    );
  };

  const beginDrag = (entry: Entry) => (event: React.DragEvent) => {
    const state = useApp.getState();
    const rt = runtimeOf(state, activeTabOf(state, paneId).id);
    const paths = rt.selection.includes(entry.path) ? rt.selection : [entry.path];
    event.preventDefault();
    void api.startDrag(paths);
  };

  if (tab.path === THIS_PC) return <DriveView paneId={paneId} />;

  const emptyBlock = entries.length === 0 && (
    <div className="empty">
      {runtime.listing?.error ? (
        <>
          <p className="empty-title">{runtime.listing.error}</p>
          <button type="button" className="text-btn" onClick={() => useApp.getState().refreshPane(paneId)}>重试</button>
        </>
      ) : (
        <>
          <p className="empty-title">{runtime.listing ? '这个文件夹是空的。' : '读取中…'}</p>
          <p className="empty-hint">Ctrl+Shift+N 新建文件夹 · Ctrl+K 打开命令面板</p>
        </>
      )}
    </div>
  );

  return (
    <div className={`filelist ${isGrid ? 'is-grid' : ''}`}>
      {!isGrid && (
        <div className="list-head" role="row">
          {COLUMNS.map((column) => (
            <button
              key={column.key}
              type="button"
              className={`col ${column.className} ${tab.sort.key === column.key ? 'is-sorted' : ''}`}
              onClick={() => useApp.getState().setSort(paneId, column.key)}
            >
              <span>{column.label}</span>
              {tab.sort.key === column.key && <span className="sort-mark">{tab.sort.dir === 'asc' ? '↑' : '↓'}</span>}
            </button>
          ))}
        </div>
      )}

      <div
        className={`list-scroll ${active ? 'is-active' : ''} ${isGrid ? 'grid-scroll' : ''}`}
        ref={scrollRef}
        onContextMenu={(event) => { void showMenu(event); }}
      >
        <div className="list-body" style={{ height: virtualizer.getTotalSize() }}>
          {virtualRows.map((virtualRow) => {
            if (!isGrid) {
              const entry = entries[virtualRow.index];
              const selected = runtime.selection.includes(entry.path);
              const isCursor = runtime.cursor === virtualRow.index;
              return (
                <div
                  key={entry.path}
                  className={`row ${selected ? 'is-selected' : ''} ${isCursor ? 'is-cursor' : ''}`}
                  style={{ height: rowHeight, transform: `translateY(${virtualRow.start}px)` }}
                  draggable
                  onClick={(event) => select(virtualRow.index, event)}
                  onDoubleClick={() => useApp.getState().openEntry(paneId, entry)}
                  onContextMenu={(event) => { void showMenu(event, entry, virtualRow.index); }}
                  onDragStart={beginDrag(entry)}
                >
                  <span className={`cell col-name ${entry.isDir ? 'is-dir' : ''}`}>
                    <span className="entry-icon"><EntryIcon entry={entry} size={colorMode ? 18 : 16} colorMode={colorMode} nativeUrl={nativeIcons[entry.path]} /></span>
                    <span className="entry-name" title={entry.name}>{entry.name}</span>
                    {entry.isSymlink && <span className="symlink-mark">link</span>}
                  </span>
                  <span className="cell col-size mono">{formatSize(entry.size)}</span>
                  <span className="cell col-mtime mono">{formatDate(entry.mtime)}</span>
                </div>
              );
            }

            const start = virtualRow.index * cols;
            const rowEntries = entries.slice(start, start + cols);
            return (
              <div
                key={`row-${virtualRow.index}`}
                className="grid-row"
                style={{
                  height: rowHeight,
                  transform: `translateY(${virtualRow.start}px)`,
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                }}
              >
                {rowEntries.map((entry, offset) => {
                  const index = start + offset;
                  const selected = runtime.selection.includes(entry.path);
                  const isCursor = runtime.cursor === index;
                  const thumb = viewMode === 'xlarge' ? thumbs[entry.path] : null;
                  return (
                    <div
                      key={entry.path}
                      className={`tile ${viewMode} ${selected ? 'is-selected' : ''} ${isCursor ? 'is-cursor' : ''}`}
                      draggable
                      title={entry.path}
                      onClick={(event) => select(index, event)}
                      onDoubleClick={() => useApp.getState().openEntry(paneId, entry)}
                      onContextMenu={(event) => { void showMenu(event, entry, index); }}
                      onDragStart={beginDrag(entry)}
                    >
                      <div className={`tile-thumb ${entry.isDir ? 'is-dir' : ''}`}>
                        {thumb ? (
                          <img src={thumb} alt="" draggable={false} loading="lazy" />
                        ) : (
                          <span className="tile-icon"><EntryIcon entry={entry} size={viewMode === 'xlarge' ? 44 : 26} colorMode={colorMode} nativeUrl={nativeIcons[entry.path]} /></span>
                        )}
                      </div>
                      <div className="tile-name">{entry.name}</div>
                      {viewMode === 'xlarge' && (
                        <div className="tile-meta">
                          {entry.isDir ? '文件夹' : formatSize(entry.size)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {runtime.loading && runtime.listing && <div className="loading-line" />}
        {emptyBlock}
      </div>
    </div>
  );
}
