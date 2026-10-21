import { useApp } from '../store';

export default function Toast() {
  const toast = useApp((s) => s.toast);
  if (!toast) return null;
  return (
    <div className={`toast ${toast.tone === 'error' ? 'is-error' : ''}`} role="status">
      {toast.text}
    </div>
  );
}
