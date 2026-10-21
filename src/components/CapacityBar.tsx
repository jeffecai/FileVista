export default function CapacityBar({ percent, mini = false }: { percent: number; mini?: boolean }) {
  const value = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  return (
    <span className={`cap-bar ${mini ? 'is-mini' : ''}`} aria-hidden="true">
      <span className="cap-fill" style={{ width: `${value}%` }} />
    </span>
  );
}
