import { useEffect, useState } from 'react';
import { Columns2, Copy, LayoutGrid, Minus, Square, X } from 'lucide-react';
import api from '../api';
import { activeTabOf, useApp } from '../store';
import { isThisPc } from '../lib/fs-utils';
import iconUrl from '../../assets/icon-64.png';

export default function TitleBar() {
  const path = useApp((s) => activeTabOf(s, s.activePane).path);
  const displayPath = isThisPc(path) ? '此电脑' : path;
  const layout = useApp((s) => s.layout);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => api.onWindowState((s) => setMaximized(s.maximized)), []);

  const control = (action: 'min' | 'max' | 'close') => {
    void api.win(action).then((res) => {
      if (res) setMaximized(res.maximized);
    });
  };

  return (
    <header className="titlebar">
      <div className="titlebar-brand">
        <img className="brand-icon" src={iconUrl} alt="" draggable={false} />
        <span className="wordmark">FileVista</span>
        <span className="titlebar-rule" />
        <span className="titlebar-path" title={displayPath}>{displayPath}</span>
      </div>
      <div className="titlebar-controls">
        <button
          type="button"
          className={`win-btn title-tool ${layout === 'dual' ? 'is-on' : ''}`}
          aria-label="双栏模式"
          title="双栏 (Ctrl+Alt+1)"
          onClick={() => useApp.getState().setLayout('dual')}
        >
          <Columns2 size={14} strokeWidth={1.6} />
        </button>
        <button
          type="button"
          className={`win-btn title-tool ${layout === 'quad' ? 'is-on' : ''}`}
          aria-label="四宫格模式"
          title="四宫格 (Ctrl+Alt+2)"
          onClick={() => useApp.getState().setLayout('quad')}
        >
          <LayoutGrid size={14} strokeWidth={1.6} />
        </button>
        <span className="titlebar-rule titlebar-rule-gap" />
        <button type="button" className="win-btn" aria-label="最小化" onClick={() => control('min')}>
          <Minus size={13} strokeWidth={1.6} />
        </button>
        <button type="button" className="win-btn" aria-label={maximized ? '还原' : '最大化'} onClick={() => control('max')}>
          {maximized ? <Copy size={11} strokeWidth={1.6} /> : <Square size={10} strokeWidth={1.6} />}
        </button>
        <button type="button" className="win-btn win-btn-close" aria-label="隐藏到托盘" title="隐藏到托盘（退出请右键托盘图标）" onClick={() => control('close')}>
          <X size={13} strokeWidth={1.6} />
        </button>
      </div>
    </header>
  );
}

