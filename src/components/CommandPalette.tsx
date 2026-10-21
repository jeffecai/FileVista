import { useEffect, useRef, useState } from 'react';
import { activeTabOf, partnerOf, runtimeOf, useApp } from '../store';
import api from '../api';

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export default function CommandPalette() {
  const open = useApp((s) => s.paletteOpen);
  const state = useApp();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const pane = state.activePane;
  const other = partnerOf(pane);
  const tab = activeTabOf(state, pane);
  const selection = runtimeOf(state, tab.id).selection;
  const partnerSelection = runtimeOf(state, activeTabOf(state, other).id).selection;
  const go = (path: string) => {
    state.navigate(pane, path);
    state.closePalette();
  };

  const commands: Command[] = [
    { id: 'layout-dual', label: '双栏模式', hint: 'Ctrl+Alt+1', run: () => { state.setLayout('dual'); state.closePalette(); } },
    { id: 'layout-quad', label: '四宫格模式', hint: 'Ctrl+Alt+2', run: () => { state.setLayout('quad'); state.closePalette(); } },
    { id: 'view-list', label: '视图：列表', hint: 'Ctrl+Alt+3', run: () => { state.setViewMode('list'); state.closePalette(); } },
    { id: 'view-icons', label: '视图：小图标', hint: 'Ctrl+Alt+4', run: () => { state.setViewMode('icons'); state.closePalette(); } },
    { id: 'view-xlarge', label: '视图：超大图标 + 预览', hint: 'Ctrl+Alt+5', run: () => { state.setViewMode('xlarge'); state.closePalette(); } },
    {
      id: 'compare',
      label: '用 Beyond Compare 比较选中两项',
      hint: `${selection.length}/2`,
      run: () => {
        if (selection.length !== 2) { state.showToast('请先选中两个项目'); return; }
        void api.compare(selection)
          .then(() => state.showToast('已在 Beyond Compare 中打开'))
          .catch((err: unknown) => state.showToast(err instanceof Error ? err.message : '无法启动 Beyond Compare', 'error'));
        state.closePalette();
      },
    },
    {
      id: 'compare-pane',
      label: '与另一栏选中项比较',
      run: () => {
        if (selection.length !== 1 || !partnerSelection[0]) { state.showToast('当前栏选 1 项，另一栏也要选 1 项'); return; }
        void api.compare([selection[0], partnerSelection[0]])
          .then(() => state.showToast('已在 Beyond Compare 中打开'))
          .catch((err: unknown) => state.showToast(err instanceof Error ? err.message : '无法启动 Beyond Compare', 'error'));
        state.closePalette();
      },
    },
    {
      id: 'compare-locate',
      label: '定位 Beyond Compare 可执行文件…',
      run: () => {
        void api.locateCompare()
          .then((chosen) => { if (chosen) state.showToast('已设置 Beyond Compare 路径'); })
          .catch((err: unknown) => state.showToast(err instanceof Error ? err.message : '定位失败', 'error'));
        state.closePalette();
      },
    },
    { id: 'sort-name', label: '排序：名称', run: () => { state.setSort(pane, 'name'); state.closePalette(); } },
    { id: 'sort-size', label: '排序：大小', run: () => { state.setSort(pane, 'size'); state.closePalette(); } },
    { id: 'sort-mtime', label: '排序：修改时间', run: () => { state.setSort(pane, 'mtime'); state.closePalette(); } },
    { id: 'thispc', label: '此电脑（驱动器与剩余空间）', run: () => go('::thispc') },
    { id: 'new-tab', label: '新建标签', hint: 'Ctrl+T', run: () => { state.newTab(pane); state.closePalette(); } },
    { id: 'close-tab', label: '关闭当前标签', hint: 'Ctrl+W', run: () => { state.closeTab(pane, tab.id); state.closePalette(); } },
    { id: 'switch-pane', label: '切换到另一栏', hint: 'Tab', run: () => { state.activatePane(other); state.closePalette(); } },
    { id: 'up', label: '上一级文件夹', hint: 'Backspace', run: () => { state.goUp(pane); state.closePalette(); } },
    { id: 'mkdir', label: '新建文件夹', hint: 'Ctrl+Shift+N', run: () => { state.promptMkdir(pane); state.closePalette(); } },
    { id: 'rename', label: '重命名', hint: 'F2', run: () => { state.promptRename(pane); state.closePalette(); } },
    { id: 'copy', label: '复制到另一栏', hint: 'F5', run: () => { state.transferSelection(pane, 'copy'); state.closePalette(); } },
    { id: 'move', label: '移动到另一栏', hint: 'F6', run: () => { state.transferSelection(pane, 'move'); state.closePalette(); } },
    { id: 'trash', label: '移到回收站', hint: 'Del', run: () => { state.askTrash(pane); state.closePalette(); } },
    { id: 'preview', label: state.previewOpen ? '关闭预览' : '打开预览', hint: 'Space', run: () => { state.togglePreview(); state.closePalette(); } },
    { id: 'hidden', label: state.showHidden ? '隐藏隐藏文件' : '显示隐藏文件', run: () => { state.toggleHidden(); state.closePalette(); } },
    { id: 'compact', label: state.compact ? '切换为舒适行距' : '切换为紧凑行距', run: () => { state.toggleCompact(); state.closePalette(); } },
    { id: 'refresh', label: '刷新当前文件夹', hint: 'Ctrl+R', run: () => { state.refreshPane(pane); state.closePalette(); } },
    { id: 'select-all', label: '全选', hint: 'Ctrl+A', run: () => { state.selectAll(pane); state.closePalette(); } },
    { id: 'copy-path', label: '复制当前路径', hint: 'Ctrl+Shift+C', run: () => { void api.copyText(tab.path); state.showToast('路径已复制'); state.closePalette(); } },
    ...state.places.map((place) => ({
      id: `place-${place.kind}`,
      label: `跳转到 ${place.label}`,
      hint: place.path,
      run: () => go(place.path),
    })),
    ...state.drives.map((drive) => ({
      id: `drive-${drive.path}`,
      label: `转到 ${drive.label}`,
      hint: drive.path,
      run: () => go(drive.path),
    })),
  ];

  const q = query.trim().toLowerCase();
  const matched = q ? commands.filter((command) => command.label.toLowerCase().includes(q)) : commands;
  const shown = matched.slice(0, 10);
  const directPath = q && (/^[a-z]:[\\/]/i.test(query.trim()) || query.includes('\\'))
    ? [{ id: 'direct', label: `跳转到 ${query.trim()}`, hint: 'Enter', run: () => go(query.trim()) }]
    : [];
  const list = [...directPath, ...shown].slice(0, 11);

  return (
    <div className="palette-scrim" onMouseDown={() => state.closePalette()}>
      <div className="palette" onMouseDown={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="搜索命令或输入路径…"
          value={query}
          spellCheck={false}
          onChange={(event) => { setQuery(event.target.value); setIndex(0); }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setIndex((i) => Math.min(i + 1, list.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              list[index]?.run();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              state.closePalette();
            }
          }}
        />
        <div className="palette-list">
          {list.map((command, i) => (
            <button
              key={command.id}
              type="button"
              className={`palette-row ${i === index ? 'is-active' : ''}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => command.run()}
            >
              <span className="palette-label">{command.label}</span>
              {command.hint && <span className="palette-hint">{command.hint}</span>}
            </button>
          ))}
          {list.length === 0 && <div className="palette-empty">没有匹配的命令。</div>}
        </div>
        <div className="palette-foot">↑↓ 选择 · Enter 执行 · Esc 关闭</div>
      </div>
    </div>
  );
}
