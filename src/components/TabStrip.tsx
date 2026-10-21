import { Plus, X } from 'lucide-react';
import { paneLabel, useApp } from '../store';
import { baseName } from '../lib/fs-utils';

export default function TabStrip({ paneId }: { paneId: 'a' | 'b' | 'c' | 'd' }) {
  const pane = useApp((s) => s.panes[paneId]);
  const layout = useApp((s) => s.layout);
  const label = paneLabel(layout, paneId);

  return (
    <div className="tabstrip">
      <span className="pane-label">{label}</span>
      <div className="tabs" role="tablist">
        {pane.tabs.map((tab) => {
          const active = tab.id === pane.activeTabId;
          const name = baseName(tab.path) || tab.path;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              className={`tab ${active ? 'is-active' : ''}`}
              title={tab.path}
              onClick={() => useApp.getState().activateTab(paneId, tab.id)}
            >
              <span className="tab-name">{name}</span>
              {pane.tabs.length > 1 && (
                <button
                  type="button"
                  className="tab-close"
                  aria-label="关闭标签"
                  onClick={(event) => {
                    event.stopPropagation();
                    useApp.getState().closeTab(paneId, tab.id);
                  }}
                >
                  <X size={11} strokeWidth={1.6} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" className="tab-add" aria-label="新建标签" title="新建标签 (Ctrl+T)" onClick={() => useApp.getState().newTab(paneId)}>
        <Plus size={13} strokeWidth={1.6} />
      </button>
    </div>
  );
}
