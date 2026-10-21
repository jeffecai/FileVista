import { useEffect, useRef, useState } from 'react';
import api from './api';
import { activeTabOf, runtimeOf, sortedEntries, useApp, visiblePanes } from './store';
import TitleBar from './components/TitleBar';
import Pane from './components/Pane';
import PreviewDrawer from './components/PreviewDrawer';
import CommandPalette from './components/CommandPalette';
import Dialogs from './components/Dialogs';
import Toast from './components/Toast';

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

function handleKey(event: KeyboardEvent): void {
  const state = useApp.getState();
  if (state.paletteOpen) return;
  if (state.inputDialog || state.confirmDialog || state.conflictDialog) return;
  if (isTypingTarget(event.target)) return;

  const pane = state.activePane;
  const tab = activeTabOf(state, pane);
  const runtime = runtimeOf(state, tab.id);
  const entries = sortedEntries(state, pane);
  const ctrl = event.ctrlKey || event.metaKey;

  if (ctrl && event.altKey) {
    if (event.key === '1') { event.preventDefault(); state.setLayout('dual'); return; }
    if (event.key === '2') { event.preventDefault(); state.setLayout('quad'); return; }
    if (event.key === '3') { event.preventDefault(); state.setViewMode('list'); return; }
    if (event.key === '4') { event.preventDefault(); state.setViewMode('icons'); return; }
    if (event.key === '5') { event.preventDefault(); state.setViewMode('xlarge'); return; }
  }

  const grid = state.viewMode !== 'list';
  const cols = grid ? Math.max(1, state.gridCols[pane] || 1) : 1;
  const move = (delta: number) => {
    event.preventDefault();
    state.setCursor(pane, runtime.cursor + delta, event.shiftKey);
  };

  if (ctrl) {
    switch (event.key.toLowerCase()) {
      case 'k':
        event.preventDefault();
        state.openPalette();
        return;
      case 'l':
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('folio:focus-path'));
        return;
      case 't':
        event.preventDefault();
        state.newTab(pane);
        return;
      case 'w':
        event.preventDefault();
        state.closeTab(pane, tab.id);
        return;
      case 'a':
        event.preventDefault();
        state.selectAll(pane);
        return;
      case 'r':
        event.preventDefault();
        state.refreshPane(pane);
        return;
      case 'tab': {
        event.preventDefault();
        const tabs = state.panes[pane].tabs;
        const index = tabs.findIndex((t) => t.id === tab.id);
        const next = tabs[(index + 1) % tabs.length];
        state.activateTab(pane, next.id);
        return;
      }
      default:
        break;
    }
    if (event.shiftKey && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      state.promptMkdir(pane);
      return;
    }
    if (event.shiftKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      void api.copyText(runtime.selection.length > 0 ? runtime.selection.join('\n') : entries[runtime.cursor]?.path ?? '');
      state.showToast('路径已复制');
      return;
    }
  }

  switch (event.key) {
    case 'ArrowDown':
      move(cols);
      break;
    case 'ArrowUp':
      move(-cols);
      break;
    case 'ArrowLeft':
      if (grid) move(-1);
      break;
    case 'ArrowRight':
      if (grid) move(1);
      break;
    case 'PageDown':
      move(grid ? cols * 3 : 12);
      break;
    case 'PageUp':
      move(grid ? -cols * 3 : -12);
      break;
    case 'Home':
      event.preventDefault();
      state.setCursor(pane, 0, event.shiftKey);
      break;
    case 'End':
      event.preventDefault();
      state.setCursor(pane, entries.length - 1, event.shiftKey);
      break;
    case 'Enter': {
      event.preventDefault();
      const entry = entries[runtime.cursor];
      if (entry) state.openEntry(pane, entry);
      break;
    }
    case 'Backspace':
      event.preventDefault();
      state.goUp(pane);
      break;
    case 'Tab':
      event.preventDefault();
      state.cyclePane();
      break;
    case 'Delete':
      event.preventDefault();
      state.askTrash(pane);
      break;
    case 'F2':
      event.preventDefault();
      state.promptRename(pane);
      break;
    case 'F5':
      event.preventDefault();
      state.transferSelection(pane, 'copy');
      break;
    case 'F6':
      event.preventDefault();
      state.transferSelection(pane, 'move');
      break;
    case ' ':
      event.preventDefault();
      state.togglePreview();
      break;
    case 'Escape':
      if (state.previewOpen) {
        event.preventDefault();
        state.togglePreview();
      }
      break;
    default:
      break;
  }
}

export default function App() {
  const ready = useApp((s) => s.ready);
  const layout = useApp((s) => s.layout);
  const previewOpen = useApp((s) => s.previewOpen);
  const leftPath = useApp((s) => activeTabOf(s, 'a').path);
  const rightPath = useApp((s) => activeTabOf(s, 'b').path);
  const thirdPath = useApp((s) => activeTabOf(s, 'c').path);
  const fourthPath = useApp((s) => activeTabOf(s, 'd').path);
  const [colRatio, setColRatio] = useState(0.5);
  const [rowRatio, setRowRatio] = useState(0.5);
  const panesRef = useRef<HTMLDivElement>(null);
  const quadRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'col' | 'row' | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void useApp.getState().init();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const paths = [leftPath, rightPath, ...(layout === 'quad' ? [thirdPath, fourthPath] : [])]
      .filter((path) => path && path !== '::thispc');
    void api.watch(paths);
  }, [ready, layout, leftPath, rightPath, thirdPath, fourthPath]);

  useEffect(() => {
    if (!ready) return;
    const listener = (event: KeyboardEvent) => handleKey(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const onFocus = () => {
      const state = useApp.getState();
      for (const id of visiblePanes(state.layout)) state.refreshPane(id);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [ready]);

  const beginDrag = (kind: 'col' | 'row') => (event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = kind;
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = kind === 'col' ? 'col-resize' : 'row-resize';
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    if (dragging.current === 'col' && panesRef.current) {
      const rect = panesRef.current.getBoundingClientRect();
      const next = (event.clientX - rect.left) / rect.width;
      setColRatio(Math.min(0.75, Math.max(0.25, next)));
    } else if (dragging.current === 'row' && quadRef.current) {
      const rect = quadRef.current.getBoundingClientRect();
      const next = (event.clientY - rect.top) / rect.height;
      setRowRatio(Math.min(0.75, Math.max(0.25, next)));
    }
  };

  const endDrag = () => {
    dragging.current = null;
    document.body.style.cursor = '';
  };

  const spine = (kind: 'col' | 'row', extraClass = '') => (
    <div
      className={`spine ${kind === 'row' ? 'spine-h' : ''} ${extraClass}`}
      onPointerDown={beginDrag(kind)}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="separator"
      aria-orientation={kind === 'col' ? 'vertical' : 'horizontal'}
    >
      <span className="spine-grip" />
    </div>
  );

  return (
    <div className="app">
      <TitleBar />
      <div className="workspace">
        <div className={`panes ${layout}`} ref={panesRef}>
          {layout === 'dual' ? (
            <>
              <section className="pane-slot" style={{ flexBasis: `${colRatio * 100}%` }}>
                <Pane paneId="a" />
              </section>
              {spine('col')}
              <section className="pane-slot pane-slot-right">
                <Pane paneId="b" />
              </section>
            </>
          ) : (
            <div className="quad" ref={quadRef}>
              <div className="quad-row" style={{ flex: `${rowRatio} 1 0` }}>
                <section className="pane-slot" style={{ flexBasis: `${colRatio * 100}%` }}>
                  <Pane paneId="a" />
                </section>
                {spine('col')}
                <section className="pane-slot pane-slot-right">
                  <Pane paneId="b" />
                </section>
              </div>
              {spine('row')}
              <div className="quad-row" style={{ flex: `${1 - rowRatio} 1 0` }}>
                <section className="pane-slot" style={{ flexBasis: `${colRatio * 100}%` }}>
                  <Pane paneId="c" />
                </section>
                {spine('col')}
                <section className="pane-slot pane-slot-right">
                  <Pane paneId="d" />
                </section>
              </div>
            </div>
          )}
        </div>
        {previewOpen && <PreviewDrawer />}
      </div>
      <Toast />
      <CommandPalette />
      <Dialogs />
    </div>
  );
}
