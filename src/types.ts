export type PaneId = 'a' | 'b' | 'c' | 'd';
export type Layout = 'dual' | 'quad';
export type ViewMode = 'list' | 'icons' | 'xlarge';

export interface Entry {
  name: string;
  path: string;
  isDir: boolean;
  isSymlink: boolean;
  size: number | null;
  mtime: number | null;
  category: 'folder' | 'image' | 'media' | 'archive' | 'app' | 'text' | 'doc' | 'file';
  ext: string;
  hidden: boolean;
  attributes?: number | null;
  total?: number | null;
  free?: number | null;
}

export interface DirListing {
  path: string;
  entries: Entry[];
  error?: string;
}

export interface Drive {
  path: string;
  label: string;
  total: number | null;
  free: number | null;
}

export interface Place {
  label: string;
  path: string;
  kind: string;
}

export interface PreviewData {
  type: 'text' | 'image' | 'meta' | 'dir' | 'error';
  path: string;
  name: string;
  size?: number;
  mtime?: number;
  text?: string;
  dataUrl?: string;
  truncated?: boolean;
  entryCount?: number;
  message?: string;
  width?: number;
  height?: number;
}

export interface Conflict {
  name: string;
  src: string;
  dest: string;
}

export type ConflictPolicy = 'replace' | 'skip' | 'keepboth';

export interface TransferRequest {
  op: 'copy' | 'move';
  sources: string[];
  destDir: string;
  policy?: ConflictPolicy;
  opId?: string;
}

export interface Progress {
  opId: string;
  op: 'copy' | 'move';
  done: number;
  total: number;
  current: string;
  state: 'running' | 'done' | 'error' | 'cancelled';
  errors?: string[];
}

export interface SortState {
  key: 'name' | 'size' | 'mtime' | 'category';
  dir: 'asc' | 'desc';
}

export interface TabState {
  id: string;
  path: string;
  history: string[];
  histIndex: number;
  sort: SortState;
}

export interface PaneState {
  tabs: TabState[];
  activeTabId: string;
}

export interface SessionData {
  version: 2;
  layout: Layout;
  viewMode: ViewMode;
  activePane: PaneId;
  showHidden: boolean;
  compact: boolean;
  previewOpen: boolean;
  panes: Partial<Record<PaneId, {
    tabs: Array<{ path: string; sort: SortState }>;
    activeIndex: number;
  }>>;
}

export interface FolioApi {
  platform: string;
  listDir(path: string, showHidden: boolean): Promise<DirListing>;
  drives(): Promise<Drive[]>;
  places(): Promise<Place[]>;
  preview(path: string): Promise<PreviewData>;
  mkdir(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  trash(paths: string[]): Promise<string[]>;
  openPath(path: string): Promise<void>;
  reveal(path: string): Promise<void>;
  checkConflicts(sources: string[], destDir: string): Promise<Conflict[]>;
  transfer(req: TransferRequest): Promise<{ opId: string }>;
  cancel(opId: string): Promise<void>;
  loadSession(): Promise<SessionData | null>;
  saveSession(session: SessionData): Promise<void>;
  watch(paths: string[]): Promise<void>;
  copyText(text: string): Promise<void>;
  startDrag(paths: string[]): Promise<boolean>;
  takeDragSource(): Promise<string[] | null>;
  compare(paths: string[]): Promise<boolean>;
  locateCompare(): Promise<string | null>;
  shellMenu(path: string): Promise<boolean>;
  getPathForFile(file: File): string;
  thumbnails(paths: string[], size: number): Promise<Record<string, string | null>>;
  win(action: 'min' | 'max' | 'close'): Promise<{ maximized: boolean } | null>;
  menu(items: Array<{ id?: string; label?: string; type?: string; enabled?: boolean }>): Promise<string | null>;
  onProgress(cb: (p: Progress) => void): () => void;
  onDirChanged(cb: (path: string) => void): () => void;
  onWindowState(cb: (s: { maximized: boolean }) => void): () => void;
}
