import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUp, Eye, EyeOff, Images, LayoutGrid, List, Monitor, Palette, PanelRight, RefreshCw,
} from 'lucide-react';
import { activeTabOf, useApp } from '../store';
import { splitPath, THIS_PC } from '../lib/fs-utils';

export default function PathBar({ paneId }: { paneId: 'a' | 'b' | 'c' | 'd' }) {
  const path = useApp((s) => activeTabOf(s, paneId).path);
  const histIndex = useApp((s) => activeTabOf(s, paneId).histIndex);
  const histLength = useApp((s) => activeTabOf(s, paneId).history.length);
  const showHidden = useApp((s) => s.showHidden);
  const previewOpen = useApp((s) => s.previewOpen);
  const viewMode = useApp((s) => s.viewMode);
  const colorMode = useApp((s) => s.colorMode);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(path);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(path);
    setEditing(false);
  }, [path]);

  useEffect(() => {
    const focus = () => {
      if (useApp.getState().activePane !== paneId) return;
      setValue(path);
      setEditing(true);
    };
    window.addEventListener('folio:focus-path', focus);
    return () => window.removeEventListener('folio:focus-path', focus);
  }, [paneId, path]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const segments = splitPath(path);

  return (
    <div className="pathbar">
      <div className="pathbar-nav">
        <button type="button" className="icon-btn" aria-label="后退" disabled={histIndex <= 0} onClick={() => useApp.getState().goBack(paneId)}>
          <ArrowLeft size={14} strokeWidth={1.6} />
        </button>
        <button type="button" className="icon-btn" aria-label="前进" disabled={histIndex >= histLength - 1} onClick={() => useApp.getState().goForward(paneId)}>
          <ArrowRight size={14} strokeWidth={1.6} />
        </button>
        <button type="button" className="icon-btn" aria-label="上一级" onClick={() => useApp.getState().goUp(paneId)}>
          <ArrowUp size={14} strokeWidth={1.6} />
        </button>
        <button
          type="button"
          className="icon-btn home-btn"
          aria-label="此电脑"
          title="此电脑（驱动器与剩余空间）"
          onClick={() => useApp.getState().navigate(paneId, THIS_PC)}
        >
          <Monitor size={14} strokeWidth={1.6} />
        </button>
      </div>

      {editing ? (
        <input
          ref={inputRef}
          className="path-input"
          value={value}
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              const next = value.trim();
              if (next) useApp.getState().navigate(paneId, next);
              setEditing(false);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setEditing(false);
            }
          }}
        />
      ) : (
        <div className="breadcrumbs" onDoubleClick={() => setEditing(true)}>
          {segments.map((segment, index) => (
            <span key={`${segment.path}-${index}`} className="crumb-wrap">
              {index > 0 && <span className="crumb-sep">›</span>}
              <button
                type="button"
                className={`crumb ${index === segments.length - 1 ? 'is-current' : ''}`}
                title={segment.path}
                onClick={() => useApp.getState().navigate(paneId, segment.path)}
              >
                {segment.label}
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="pathbar-actions">
        <button
          type="button"
          className={`icon-btn ${colorMode ? 'is-on' : ''}`}
          aria-label="彩色图标"
          title={colorMode ? '切换为单色图标' : '切换为彩色图标'}
          onClick={() => useApp.getState().toggleColorMode()}
        >
          <Palette size={14} strokeWidth={1.6} />
        </button>
        <div className="view-switch">
          <button
            type="button"
            className={`icon-btn ${viewMode === 'list' ? 'is-on' : ''}`}
            aria-label="列表"
            title="列表 (Ctrl+Alt+3)"
            onClick={() => useApp.getState().setViewMode('list')}
          >
            <List size={14} strokeWidth={1.6} />
          </button>
          <button
            type="button"
            className={`icon-btn ${viewMode === 'icons' ? 'is-on' : ''}`}
            aria-label="小图标"
            title="小图标 (Ctrl+Alt+4)"
            onClick={() => useApp.getState().setViewMode('icons')}
          >
            <LayoutGrid size={14} strokeWidth={1.6} />
          </button>
          <button
            type="button"
            className={`icon-btn ${viewMode === 'xlarge' ? 'is-on' : ''}`}
            aria-label="超大图标"
            title="超大图标 + 预览 (Ctrl+Alt+5)"
            onClick={() => useApp.getState().setViewMode('xlarge')}
          >
            <Images size={14} strokeWidth={1.6} />
          </button>
        </div>
        <button type="button" className="icon-btn" aria-label="刷新" title="刷新 (Ctrl+R)" onClick={() => useApp.getState().refreshPane(paneId)}>
          <RefreshCw size={13} strokeWidth={1.6} />
        </button>
        <button
          type="button"
          className={`icon-btn ${showHidden ? 'is-on' : ''}`}
          aria-label={showHidden ? '隐藏隐藏文件' : '显示隐藏文件'}
          title={showHidden ? '隐藏隐藏文件' : '显示隐藏文件'}
          onClick={() => useApp.getState().toggleHidden()}
        >
          {showHidden ? <Eye size={14} strokeWidth={1.6} /> : <EyeOff size={14} strokeWidth={1.6} />}
        </button>
        <button
          type="button"
          className={`icon-btn ${previewOpen ? 'is-on' : ''}`}
          aria-label="预览"
          title="预览 (Space)"
          onClick={() => useApp.getState().togglePreview()}
        >
          <PanelRight size={14} strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}
