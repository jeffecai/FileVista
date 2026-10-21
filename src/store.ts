import { create } from 'zustand';
import type {
  Conflict, ConflictPolicy, DirListing, Drive, Entry, Layout, PaneId, Place, PreviewData, Progress,
  SessionData, SortState, TabState, ViewMode,
} from './types';
import api from './api';
import { dirName, joinPath, isValidName, sortEntries, THIS_PC } from './lib/fs-utils';

export const ALL_PANES: PaneId[] = ['a', 'b', 'c', 'd'];

export function visiblePanes(layout: Layout): PaneId[] {
  return layout === 'dual' ? ['a', 'b'] : ALL_PANES;
}

export function partnerOf(paneId: PaneId): PaneId {
  if (paneId === 'a') return 'b';
  if (paneId === 'b') return 'a';
  if (paneId === 'c') return 'd';
  return 'c';
}

export function paneLabel(layout: Layout, paneId: PaneId): string {
  if (layout === 'dual') return paneId === 'a' ? 'Left' : 'Right';
  return ({ a: 'I', b: 'II', c: 'III', d: 'IV' } as Record<PaneId, string>)[paneId];
}

export interface Runtime {
  listing: DirListing | null;
  loading: boolean;
  cursor: number;
  selection: string[];
  anchor: number;
}

export interface InputDialog {
  title: string;
  label: string;
  value: string;
  confirmLabel: string;
  kind: 'rename' | 'mkdir';
  target?: string;
}

export interface ConfirmDialog {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

export interface ConflictDialog {
  op: 'copy' | 'move';
  sources: string[];
  destDir: string;
  conflicts: Conflict[];
}

interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

interface AppState {
  layout: Layout;
  viewMode: ViewMode;
  panes: Record<PaneId, { tabs: TabState[]; activeTabId: string }>;
  activePane: PaneId;
  showHidden: boolean;
  compact: boolean;
  gridCols: Record<PaneId, number>;
  runtimes: Record<string, Runtime>;
  ops: Record<string, Progress>;
  previewOpen: boolean;
  colorMode: boolean;
  previewPath: string | null;
  previewData: PreviewData | null;
  paletteOpen: boolean;
  inputDialog: InputDialog | null;
  confirmDialog: ConfirmDialog | null;
  conflictDialog: ConflictDialog | null;
  toast: Toast | null;
  drives: Drive[];
  places: Place[];
  ready: boolean;

  init(): Promise<void>;
  setLayout(layout: Layout): void;
  setViewMode(mode: ViewMode): void;
  setGridCols(paneId: PaneId, cols: number): void;
  cyclePane(): void;
  navigate(paneId: PaneId, path: string, push?: boolean): void;
  goUp(paneId: PaneId): void;
  goBack(paneId: PaneId): void;
  goForward(paneId: PaneId): void;
  activatePane(paneId: PaneId): void;
  activateTab(paneId: PaneId, tabId: string): void;
  newTab(paneId: PaneId, path?: string): void;
  closeTab(paneId: PaneId, tabId: string): void;
  setSort(paneId: PaneId, key: SortState['key']): void;
  toggleHidden(): void;
  toggleCompact(): void;
  refreshPane(paneId: PaneId): void;
  refreshPath(path: string): void;
  setCursor(paneId: PaneId, index: number, extend: boolean): void;
  selectAt(paneId: PaneId, index: number, mode: 'single' | 'toggle' | 'range'): void;
  selectAll(paneId: PaneId): void;
  openEntry(paneId: PaneId, entry: Entry): void;
  promptRename(paneId: PaneId): void;
  promptMkdir(paneId: PaneId): void;
  submitInput(value: string): void;
  closeInput(): void;
  askTrash(paneId: PaneId): void;
  transferSelection(paneId: PaneId, op: 'copy' | 'move'): void;
  transferPaths(op: 'copy' | 'move', sources: string[], destDir: string): void;
  resolveConflicts(policy: ConflictPolicy): void;
  closeConflict(): void;
  cancelOp(opId: string): void;
  togglePreview(): void;
  toggleColorMode(): void;
  setPreview(path: string | null): void;
  loadPreview(path: string): Promise<void>;
  openPalette(): void;
  closePalette(): void;
  showToast(text: string, tone?: 'info' | 'error'): void;
  closeConfirm(): void;
}

const OP_META = new Map<string, { destDir: string; sources: string[]; op: 'copy' | 'move' }>();
let toastSeq = 0;
let tabSeq = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function newId(): string {
  tabSeq += 1;
  return `t${Date.now().toString(36)}${tabSeq}`;
}

function makeTab(path: string, sort: SortState = { key: 'name', dir: 'asc' }): TabState {
  return { id: newId(), path, history: [path], histIndex: 0, sort };
}

const EMPTY_TAB: TabState = {
  id: '',
  path: '',
  history: [''],
  histIndex: 0,
  sort: { key: 'name', dir: 'asc' },
};

const EMPTY_PANE = { tabs: [] as TabState[], activeTabId: '' };

export function activeTabOf(state: { panes: Record<PaneId, { tabs: TabState[]; activeTabId: string }> }, paneId: PaneId): TabState {
  const pane = state.panes[paneId] ?? EMPTY_PANE;
  return pane.tabs.find((t) => t.id === pane.activeTabId) ?? pane.tabs[0] ?? EMPTY_TAB;
}

function tabById(state: { panes: Record<PaneId, { tabs: TabState[]; activeTabId: string }> }, id: string): TabState | undefined {
  for (const paneId of ALL_PANES) {
    const found = state.panes[paneId]?.tabs.find((t) => t.id === id);
    if (found) return found;
  }
  return undefined;
}

const EMPTY_RUNTIME: Runtime = { listing: null, loading: false, cursor: 0, selection: [], anchor: 0 };

export function runtimeOf(state: { runtimes: Record<string, Runtime> }, tabId: string): Runtime {
  return state.runtimes[tabId] ?? EMPTY_RUNTIME;
}

export function sortedEntries(state: { panes: Record<PaneId, { tabs: TabState[]; activeTabId: string }>; runtimes: Record<string, Runtime> }, paneId: PaneId): Entry[] {
  const tab = activeTabOf(state, paneId);
  const rt = runtimeOf(state, tab.id);
  const entries = rt.listing?.entries ?? [];
  return sortEntries(entries, tab.sort);
}

function normalizeDir(value: string): string {
  return value.toLowerCase().replace(/[\\/]+$/, '');
}

function isInside(child: string, parent: string): boolean {
  const nested = normalizeDir(child);
  const base = normalizeDir(parent);
  return nested === base || nested.startsWith(`${base}\\`);
}

function currentPaths(state: AppState, paneId: PaneId): string[] {
  const tab = activeTabOf(state, paneId);
  const rt = runtimeOf(state, tab.id);
  const entries = sortedEntries(state, paneId);
  if (rt.selection.length > 0) return rt.selection;
  const entry = entries[rt.cursor];
  return entry ? [entry.path] : [];
}

function serialize(state: AppState): SessionData {
  const panes: SessionData['panes'] = {};
  for (const id of ALL_PANES) {
    const pane = state.panes[id];
    if (!pane || pane.tabs.length === 0) continue;
    panes[id] = {
      tabs: pane.tabs.map((t) => ({ path: t.path, sort: t.sort })),
      activeIndex: Math.max(0, pane.tabs.findIndex((t) => t.id === pane.activeTabId)),
    };
  }
  return {
    version: 2,
    layout: state.layout,
    viewMode: state.viewMode,
    activePane: state.activePane,
    showHidden: state.showHidden,
    compact: state.compact,
    previewOpen: state.previewOpen,
    colorMode: state.colorMode,
    panes,
  };
}

export const useApp = create<AppState>()((set, get) => {
  const patchTab = (paneId: PaneId, tabId: string, patch: Partial<TabState>) => {
    set((s) => ({
      panes: {
        ...s.panes,
        [paneId]: {
          ...s.panes[paneId],
          tabs: s.panes[paneId].tabs.map((t) => (t.id === tabId ? { ...t, ...patch } : t)),
        },
      },
    }));
  };

  const setRuntime = (tabId: string, patch: Partial<Runtime>) => {
    set((s) => ({
      runtimes: {
        ...s.runtimes,
        [tabId]: { ...runtimeOf(s, tabId), ...patch },
      },
    }));
  };

  const loadTab = async (tabId: string) => {
    const state = get();
    const tab = tabById(state, tabId);
    if (!tab || !tab.path) return;
    const requestedPath = tab.path;
    setRuntime(tabId, { loading: true });

    if (requestedPath === THIS_PC) {
      const drives = await api.drives();
      const entries: Entry[] = drives.map((drive) => ({
        name: drive.label,
        path: drive.path,
        isDir: true,
        isSymlink: false,
        size: drive.total,
        mtime: null,
        category: 'folder',
        ext: '',
        hidden: false,
        total: drive.total,
        free: drive.free,
      }));
      const latestRt = runtimeOf(get(), tabId);
      const cursor = Math.min(latestRt.cursor, Math.max(0, entries.length - 1));
      set({ drives });
      setRuntime(tabId, {
        listing: { path: THIS_PC, entries },
        loading: false,
        cursor,
        selection: entries[cursor] ? [entries[cursor].path] : [],
        anchor: 0,
      });
      return;
    }

    const result = await api.listDir(requestedPath, get().showHidden);
    const latest = tabById(get(), tabId);
    if (!latest || latest.path !== requestedPath) return;
    const latestRt = runtimeOf(get(), tabId);
    const sorted = sortEntries(result.entries, latest.sort);
    const cursor = Math.min(latestRt.cursor, Math.max(0, sorted.length - 1));
    const valid = new Set(result.entries.map((entry) => entry.path));
    const kept = latestRt.selection.filter((path) => valid.has(path));
    const selection = kept.length > 0 ? kept : (sorted[cursor] ? [sorted[cursor].path] : []);
    setRuntime(tabId, {
      listing: result,
      loading: false,
      cursor,
      selection,
      anchor: Math.min(latestRt.anchor, Math.max(0, sorted.length - 1)),
    });
    if (get().previewOpen) {
      const entry = sorted[cursor];
      if (entry) void get().loadPreview(entry.path);
    }
  };

  const startTransfer = async (op: 'copy' | 'move', sources: string[], destDir: string, policy: ConflictPolicy) => {
    try {
      const { opId } = await api.transfer({ op, sources, destDir, policy });
      OP_META.set(opId, { destDir, sources, op });
      set((s) => ({
        ops: {
          ...s.ops,
          [opId]: { opId, op, done: 0, total: sources.length, current: '', state: 'running' },
        },
      }));
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : '操作失败', 'error');
    }
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void api.saveSession(serialize(get())).catch(() => {});
    }, 700);
  };

  return {
    layout: 'dual',
    viewMode: 'list',
    panes: {
      a: { tabs: [], activeTabId: '' },
      b: { tabs: [], activeTabId: '' },
      c: { tabs: [], activeTabId: '' },
      d: { tabs: [], activeTabId: '' },
    },
    activePane: 'a',
    showHidden: false,
    compact: false,
    gridCols: { a: 1, b: 1, c: 1, d: 1 },
    runtimes: {},
    ops: {},
    previewOpen: false,
    colorMode: true,
    previewPath: null,
    previewData: null,
    paletteOpen: false,
    inputDialog: null,
    confirmDialog: null,
    conflictDialog: null,
    toast: null,
    drives: [],
    places: [],
    ready: false,

    async init() {
      const [session, places, drives] = await Promise.all([
        api.loadSession().catch(() => null),
        api.places().catch(() => [] as Place[]),
        api.drives().catch(() => [] as Drive[]),
      ]);
      const home = places.find((p) => p.kind === 'home')?.path ?? 'C:\\';
      const desktop = places.find((p) => p.kind === 'desktop')?.path ?? home;
      const downloads = places.find((p) => p.kind === 'downloads')?.path ?? home;
      const documents = places.find((p) => p.kind === 'documents')?.path ?? home;

      const legacy = session as unknown as {
        version?: number;
        panes?: Record<string, { tabs: Array<{ path: string; sort: SortState }>; activeIndex: number }>;
      } | null;

      const savedFor = (id: PaneId) => {
        if (!legacy?.panes) return undefined;
        if (legacy.version === 1) {
          if (id === 'a') return legacy.panes.left;
          if (id === 'b') return legacy.panes.right;
          return undefined;
        }
        return legacy.panes[id];
      };

      const build = (id: PaneId, fallback: string) => {
        const saved = savedFor(id);
        const tabs = saved && saved.tabs.length > 0
          ? saved.tabs.map((t) => makeTab(t.path, t.sort))
          : [makeTab(fallback)];
        const index = Math.min(Math.max(0, saved?.activeIndex ?? 0), tabs.length - 1);
        return { tabs, activeTabId: tabs[index].id };
      };

      const panes: Record<PaneId, { tabs: TabState[]; activeTabId: string }> = {
        a: build('a', home),
        b: build('b', desktop),
        c: build('c', downloads),
        d: build('d', documents),
      };

      const layout: Layout = legacy && (legacy as unknown as SessionData).layout === 'quad' ? 'quad' : 'dual';
      const viewMode: ViewMode = (legacy as unknown as SessionData | null)?.viewMode ?? 'list';
      const activePane: PaneId = visiblePanes(layout).includes((legacy as unknown as SessionData | null)?.activePane as PaneId)
        ? ((legacy as unknown as SessionData).activePane)
        : 'a';

      set({
        panes,
        layout,
        viewMode,
        activePane,
        showHidden: (legacy as unknown as SessionData | null)?.showHidden ?? false,
        compact: (legacy as unknown as SessionData | null)?.compact ?? false,
        previewOpen: (legacy as unknown as SessionData | null)?.previewOpen ?? false,
        colorMode: (legacy as unknown as SessionData | null)?.colorMode ?? true,
        places,
        drives,
        ready: true,
      });

      const visible = visiblePanes(layout);
      await Promise.all(visible.flatMap((id) => panes[id].tabs.filter((t) => t.path).map((t) => loadTab(t.id))));

      if (viewMode === 'xlarge') {
        const state = get();
        const entries = sortedEntries(state, state.activePane);
        const entry = entries[runtimeOf(state, activeTabOf(state, state.activePane).id).cursor];
        if (entry) void get().loadPreview(entry.path);
      }

      api.onProgress((progress) => {
        set((s) => ({ ops: { ...s.ops, [progress.opId]: progress } }));
        if (progress.state === 'running') return;
        const meta = OP_META.get(progress.opId);
        OP_META.delete(progress.opId);
        const label = progress.op === 'copy' ? '复制' : '移动';
        if (progress.state === 'done') {
          if (progress.errors && progress.errors.length > 0) {
            get().showToast(progress.errors.join('\n'), 'error');
          } else if (progress.done === 0) {
            get().showToast(`${label}未执行：没有文件被写入（目标中可能存在同名项）`, 'error');
          } else {
            get().showToast(`${label}完成 · ${progress.done} 项`);
          }
        } else if (progress.state === 'cancelled') {
          get().showToast('操作已取消');
        } else {
          get().showToast(progress.errors?.join('\n') || '操作失败', 'error');
        }
        if (meta) {
          for (const src of meta.sources) get().refreshPath(dirName(src));
          get().refreshPath(meta.destDir);
        }
        setTimeout(() => {
          set((s) => {
            const next = { ...s.ops };
            delete next[progress.opId];
            return { ops: next };
          });
        }, 2600);
      });

      api.onDirChanged((path) => {
        get().refreshPath(path);
        if (get().previewOpen && get().previewPath) void get().loadPreview(get().previewPath as string);
      });

      useApp.subscribe((s, prev) => {
        if (s.panes !== prev.panes || s.activePane !== prev.activePane || s.showHidden !== prev.showHidden
          || s.compact !== prev.compact || s.previewOpen !== prev.previewOpen
          || s.colorMode !== prev.colorMode
          || s.layout !== prev.layout || s.viewMode !== prev.viewMode) {
          scheduleSave();
        }
      });
    },

    setLayout(layout) {
      if (layout === get().layout) return;
      const state = get();
      let panes = state.panes;
      if (layout === 'quad') {
        const ensure = (id: PaneId, fallback: string) => {
          if (panes[id].tabs.length > 0) return panes[id];
          const tab = makeTab(fallback);
          return { tabs: [tab], activeTabId: tab.id };
        };
        panes = {
          ...panes,
          c: ensure('c', activeTabOf(state, 'a').path || state.places[0]?.path || 'C:\\'),
          d: ensure('d', activeTabOf(state, 'b').path || state.places[1]?.path || 'C:\\'),
        };
      }
      const activePane: PaneId = layout === 'dual' && (state.activePane === 'c' || state.activePane === 'd')
        ? 'a'
        : state.activePane;
      set({ layout, panes, activePane });
      if (layout === 'quad') {
        for (const id of ['c', 'd'] as PaneId[]) {
          const tab = activeTabOf(get(), id);
          if (tab.path) void loadTab(tab.id);
        }
      }
    },

    setViewMode(mode) {
      set({ viewMode: mode });
      if (mode === 'xlarge') {
        set({ previewOpen: true });
        const state = get();
        const entries = sortedEntries(state, state.activePane);
        const entry = entries[runtimeOf(state, activeTabOf(state, state.activePane).id).cursor];
        if (entry) void get().loadPreview(entry.path);
      }
    },

    setGridCols(paneId, cols) {
      if (get().gridCols[paneId] === cols) return;
      set((s) => ({ gridCols: { ...s.gridCols, [paneId]: cols } }));
    },

    cyclePane() {
      const state = get();
      const list = visiblePanes(state.layout);
      const index = list.indexOf(state.activePane);
      set({ activePane: list[(index + 1) % list.length] });
    },

    navigate(paneId, path, push = true) {
      const state = get();
      const tab = activeTabOf(state, paneId);
      if (!tab.id) return;
      if (tab.path === path) {
        get().refreshPane(paneId);
        return;
      }
      const history = push ? [...tab.history.slice(0, tab.histIndex + 1), path] : tab.history;
      const histIndex = push ? history.length - 1 : tab.histIndex;
      patchTab(paneId, tab.id, { path, history, histIndex });
      setRuntime(tab.id, { cursor: 0, selection: [], anchor: 0 });
      void loadTab(tab.id);
    },

    goUp(paneId) {
      const tab = activeTabOf(get(), paneId);
      if (tab.path === THIS_PC) {
        const home = get().places.find((place) => place.kind === 'home')?.path;
        if (home) get().navigate(paneId, home);
        return;
      }
      const parent = dirName(tab.path);
      if (parent && parent !== tab.path) get().navigate(paneId, parent);
    },

    goBack(paneId) {
      const tab = activeTabOf(get(), paneId);
      if (tab.histIndex <= 0) return;
      const histIndex = tab.histIndex - 1;
      patchTab(paneId, tab.id, { path: tab.history[histIndex], histIndex });
      setRuntime(tab.id, { cursor: 0, selection: [], anchor: 0 });
      void loadTab(tab.id);
    },

    goForward(paneId) {
      const tab = activeTabOf(get(), paneId);
      if (tab.histIndex >= tab.history.length - 1) return;
      const histIndex = tab.histIndex + 1;
      patchTab(paneId, tab.id, { path: tab.history[histIndex], histIndex });
      setRuntime(tab.id, { cursor: 0, selection: [], anchor: 0 });
      void loadTab(tab.id);
    },

    activatePane(paneId) {
      if (!visiblePanes(get().layout).includes(paneId)) return;
      set({ activePane: paneId });
    },

    activateTab(paneId, tabId) {
      set((s) => ({ panes: { ...s.panes, [paneId]: { ...s.panes[paneId], activeTabId: tabId } }, activePane: paneId }));
    },

    newTab(paneId, path) {
      const current = activeTabOf(get(), paneId);
      const tab = makeTab((path ?? current.path) || get().places[0]?.path || 'C:\\');
      set((s) => ({
        panes: {
          ...s.panes,
          [paneId]: { tabs: [...s.panes[paneId].tabs, tab], activeTabId: tab.id },
        },
        activePane: paneId,
      }));
      void loadTab(tab.id);
    },

    closeTab(paneId, tabId) {
      const pane = get().panes[paneId];
      if (pane.tabs.length <= 1) return;
      const index = pane.tabs.findIndex((t) => t.id === tabId);
      const tabs = pane.tabs.filter((t) => t.id !== tabId);
      const activeTabId = pane.activeTabId === tabId ? tabs[Math.max(0, index - 1)].id : pane.activeTabId;
      set((s) => ({ panes: { ...s.panes, [paneId]: { tabs, activeTabId } } }));
    },

    setSort(paneId, key) {
      const tab = activeTabOf(get(), paneId);
      if (!tab.id) return;
      const dir = tab.sort.key === key && tab.sort.dir === 'asc' ? 'desc' : 'asc';
      patchTab(paneId, tab.id, { sort: { key, dir } });
      setRuntime(tab.id, { cursor: 0, selection: [], anchor: 0 });
    },

    toggleHidden() {
      set((s) => ({ showHidden: !s.showHidden }));
      for (const id of ALL_PANES) {
        for (const tab of get().panes[id].tabs) {
          if (tab.path) void loadTab(tab.id);
        }
      }
    },

    toggleCompact() {
      set((s) => ({ compact: !s.compact }));
    },

    refreshPane(paneId) {
      const tab = activeTabOf(get(), paneId);
      if (tab.id) void loadTab(tab.id);
    },

    refreshPath(path) {
      for (const id of ALL_PANES) {
        for (const tab of get().panes[id].tabs) {
          if (tab.path && tab.path.toLowerCase() === path.toLowerCase()) void loadTab(tab.id);
        }
      }
    },

    setCursor(paneId, index, extend) {
      const state = get();
      const tab = activeTabOf(state, paneId);
      const rt = runtimeOf(state, tab.id);
      const entries = sortedEntries(state, paneId);
      if (entries.length === 0) return;
      const next = Math.max(0, Math.min(index, entries.length - 1));
      if (extend) {
        const [from, to] = rt.anchor <= next ? [rt.anchor, next] : [next, rt.anchor];
        setRuntime(tab.id, { cursor: next, selection: entries.slice(from, to + 1).map((e) => e.path) });
      } else {
        setRuntime(tab.id, { cursor: next, selection: [entries[next].path], anchor: next });
      }
      if (get().previewOpen) void get().loadPreview(entries[next].path);
    },

    selectAt(paneId, index, mode) {
      const state = get();
      const tab = activeTabOf(state, paneId);
      const rt = runtimeOf(state, tab.id);
      const entries = sortedEntries(state, paneId);
      const entry = entries[index];
      if (!entry) return;
      if (mode === 'toggle') {
        const has = rt.selection.includes(entry.path);
        const selection = has ? rt.selection.filter((p) => p !== entry.path) : [...rt.selection, entry.path];
        setRuntime(tab.id, { cursor: index, selection, anchor: index });
      } else if (mode === 'range') {
        const [from, to] = rt.anchor <= index ? [rt.anchor, index] : [index, rt.anchor];
        setRuntime(tab.id, { cursor: index, selection: entries.slice(from, to + 1).map((e) => e.path) });
      } else {
        setRuntime(tab.id, { cursor: index, selection: [entry.path], anchor: index });
      }
      if (get().previewOpen) void get().loadPreview(entry.path);
    },

    selectAll(paneId) {
      const state = get();
      const tab = activeTabOf(state, paneId);
      const entries = sortedEntries(state, paneId);
      setRuntime(tab.id, { selection: entries.map((e) => e.path) });
    },

    openEntry(paneId, entry) {
      if (entry.isDir) {
        get().navigate(paneId, entry.path);
        return;
      }
      void api.openPath(entry.path).catch((err: unknown) => {
        get().showToast(err instanceof Error ? err.message : '无法打开文件', 'error');
      });
    },

    promptRename(paneId) {
      const state = get();
      if (activeTabOf(state, paneId).path === THIS_PC) {
        get().showToast('驱动器不能重命名');
        return;
      }
      const entry = sortedEntries(state, paneId)[runtimeOf(state, activeTabOf(state, paneId).id).cursor];
      if (!entry) return;
      set({
        inputDialog: {
          title: '重命名',
          label: '新名称',
          value: entry.name,
          confirmLabel: '重命名',
          kind: 'rename',
          target: entry.path,
        },
      });
    },

    promptMkdir(paneId) {
      void paneId;
      if (activeTabOf(get(), get().activePane).path === THIS_PC) {
        get().showToast('请先进入某个驱动器');
        return;
      }
      set({
        inputDialog: {
          title: '新建文件夹',
          label: '文件夹名称',
          value: '新建文件夹',
          confirmLabel: '创建',
          kind: 'mkdir',
        },
      });
    },

    submitInput(value) {
      const dialog = get().inputDialog;
      if (!dialog) return;
      const problem = isValidName(value);
      if (problem) {
        get().showToast(problem, 'error');
        return;
      }
      set({ inputDialog: null });
      const tab = activeTabOf(get(), get().activePane);
      if (dialog.kind === 'rename' && dialog.target) {
        api.rename(dialog.target, joinPath(dirName(dialog.target), value))
          .then(() => get().refreshPane(get().activePane))
          .catch((err: unknown) => get().showToast(err instanceof Error ? err.message : '重命名失败', 'error'));
      } else {
        api.mkdir(joinPath(tab.path, value))
          .then(() => get().refreshPane(get().activePane))
          .catch((err: unknown) => get().showToast(err instanceof Error ? err.message : '创建失败', 'error'));
      }
    },

    closeInput() {
      set({ inputDialog: null });
    },

    askTrash(paneId) {
      if (activeTabOf(get(), paneId).path === THIS_PC) {
        get().showToast('不能删除驱动器');
        return;
      }
      const targets = currentPaths(get(), paneId);
      if (targets.length === 0) return;
      set({
        confirmDialog: {
          title: '移到回收站',
          message: targets.length === 1
            ? `将「${targets[0].split('\\').pop()}」移到回收站？`
            : `将 ${targets.length} 个项目移到回收站？`,
          confirmLabel: '移到回收站',
          danger: true,
          onConfirm: () => {
            set({ confirmDialog: null });
            api.trash(targets)
              .then((errors) => {
                if (errors.length > 0) get().showToast(errors.join('\n'), 'error');
                else get().showToast(`已移到回收站 · ${targets.length} 项`);
                get().refreshPane(paneId);
              })
              .catch((err: unknown) => get().showToast(err instanceof Error ? err.message : '删除失败', 'error'));
          },
        },
      });
    },

    transferSelection(paneId, op) {
      const state = get();
      const sources = currentPaths(state, paneId);
      if (sources.length === 0) return;
      get().transferPaths(op, sources, activeTabOf(state, partnerOf(paneId)).path);
    },

    transferPaths(op, sources, destDir) {
      if (sources.length === 0) return;
      const target = normalizeDir(destDir);
      const filtered = sources.filter((source) => {
        if (/^[a-z]:\\$/i.test(source)) {
          get().showToast('不能对整个磁盘执行该操作', 'error');
          return false;
        }
        if (normalizeDir(dirName(source)) === target) return false;
        if (isInside(destDir, source)) {
          get().showToast('不能放到自身或子文件夹里');
          return false;
        }
        return true;
      });
      if (filtered.length === 0) {
        get().showToast('项目已经在目标文件夹中');
        return;
      }
      void api.checkConflicts(filtered, destDir)
        .then((conflicts) => {
          if (conflicts.length > 0) set({ conflictDialog: { op, sources: filtered, destDir, conflicts } });
          else void startTransfer(op, filtered, destDir, 'replace');
        })
        .catch((err: unknown) => get().showToast(err instanceof Error ? err.message : '无法检查目标', 'error'));
    },

    resolveConflicts(policy) {
      const dialog = get().conflictDialog;
      if (!dialog) return;
      set({ conflictDialog: null });
      void startTransfer(dialog.op, dialog.sources, dialog.destDir, policy);
    },

    closeConflict() {
      set({ conflictDialog: null });
    },

    cancelOp(opId) {
      void api.cancel(opId);
    },

    toggleColorMode() {
      set((s) => ({ colorMode: !s.colorMode }));
    },

    togglePreview() {
      const nextOpen = !get().previewOpen;
      set({ previewOpen: nextOpen });
      if (nextOpen) {
        const state = get();
        const entries = sortedEntries(state, state.activePane);
        const entry = entries[runtimeOf(state, activeTabOf(state, state.activePane).id).cursor];
        if (entry) void get().loadPreview(entry.path);
      }
    },

    setPreview(path) {
      set({ previewPath: path });
    },

    async loadPreview(path) {
      set({ previewPath: path });
      const data = await api.preview(path).catch(() => null);
      if (get().previewPath === path) set({ previewData: data });
    },

    openPalette() {
      set({ paletteOpen: true });
    },

    closePalette() {
      set({ paletteOpen: false });
    },

    showToast(text, tone = 'info') {
      toastSeq += 1;
      const id = toastSeq;
      set({ toast: { id, text, tone } });
      setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
      }, tone === 'error' ? 5200 : 2600);
    },

    closeConfirm() {
      set({ confirmDialog: null });
    },
  };
});
