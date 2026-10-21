import { X } from 'lucide-react';
import { useApp } from '../store';
import { baseName, formatSize } from '../lib/fs-utils';

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-row">
      <span className="meta-label">{label}</span>
      <span className="meta-value">{value}</span>
    </div>
  );
}

export default function PreviewDrawer() {
  const data = useApp((s) => s.previewData);
  const path = useApp((s) => s.previewPath);

  return (
    <aside className="preview">
      <div className="preview-head">
        <div className="preview-title-wrap">
          <h2 className="preview-title">{data?.name || (path ? baseName(path) : '预览')}</h2>
          {path && <p className="preview-path" title={path}>{path}</p>}
        </div>
        <button type="button" className="icon-btn" aria-label="关闭预览" onClick={() => useApp.getState().togglePreview()}>
          <X size={14} strokeWidth={1.6} />
        </button>
      </div>

      <div className="preview-body">
        {!data && <p className="preview-empty">读取中…</p>}

        {data?.type === 'text' && (
          <>
            <pre className="preview-text">{data.text}</pre>
            {data.truncated && <p className="preview-note">仅显示前 256 KB。</p>}
          </>
        )}

        {data?.type === 'image' && data.dataUrl && (
          <img className="preview-image" src={data.dataUrl} alt={data.name} />
        )}

        {data?.type === 'dir' && (
          <p className="preview-empty">文件夹 · {data.entryCount ?? 0} 项</p>
        )}

        {data?.type === 'error' && <p className="preview-empty">{data.message}</p>}

        {data && data.type !== 'text' && (
          <div className="preview-meta">
            <MetaRow label="大小" value={data.size ? formatSize(data.size) : '—'} />
            {data.width && data.height ? <MetaRow label="尺寸" value={`${data.width} × ${data.height}`} /> : null}
            <MetaRow label="修改" value={data.mtime ? new Date(data.mtime).toLocaleString('zh-CN') : '—'} />
            <MetaRow label="类型" value={data.type === 'dir' ? '文件夹' : (data.name.split('.').pop() || '文件').toUpperCase()} />
            <MetaRow label="路径" value={data.path} />
          </div>
        )}
      </div>
    </aside>
  );
}
