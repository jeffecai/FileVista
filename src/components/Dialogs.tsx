import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';

export default function Dialogs() {
  const inputDialog = useApp((s) => s.inputDialog);
  const confirmDialog = useApp((s) => s.confirmDialog);
  const conflictDialog = useApp((s) => s.conflictDialog);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputDialog) {
      setValue(inputDialog.value);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [inputDialog]);

  const submit = () => {
    const problem = value.trim();
    if (!problem) return;
    useApp.getState().submitInput(problem);
  };

  return (
    <>
      {inputDialog && (
        <div className="dialog-scrim" onMouseDown={() => useApp.getState().closeInput()}>
          <div className="dialog" onMouseDown={(event) => event.stopPropagation()}>
            <h2 className="dialog-title">{inputDialog.title}</h2>
            <label className="dialog-label" htmlFor="folio-input">{inputDialog.label}</label>
            <input
              id="folio-input"
              ref={inputRef}
              className="dialog-input"
              value={value}
              spellCheck={false}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); submit(); }
                if (event.key === 'Escape') { event.preventDefault(); useApp.getState().closeInput(); }
              }}
            />
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => useApp.getState().closeInput()}>取消</button>
              <button type="button" className="btn btn-primary" onClick={submit}>{inputDialog.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="dialog-scrim" onMouseDown={() => useApp.getState().closeConfirm()}>
          <div className="dialog" onMouseDown={(event) => event.stopPropagation()}>
            <h2 className="dialog-title">{confirmDialog.title}</h2>
            <p className="dialog-message">{confirmDialog.message}</p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => useApp.getState().closeConfirm()}>取消</button>
              <button
                type="button"
                className={`btn ${confirmDialog.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={confirmDialog.onConfirm}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {conflictDialog && (
        <div className="dialog-scrim" onMouseDown={() => useApp.getState().closeConflict()}>
          <div className="dialog dialog-wide" onMouseDown={(event) => event.stopPropagation()}>
            <h2 className="dialog-title">目标中已存在同名项目</h2>
            <p className="dialog-message">
              {conflictDialog.conflicts.length === 1
                ? `「${conflictDialog.conflicts[0].name}」已经存在，如何处理？`
                : `${conflictDialog.conflicts.length} 个项目已存在，如何处理？`}
            </p>
            <ul className="conflict-list">
              {conflictDialog.conflicts.slice(0, 6).map((conflict) => (
                <li key={conflict.dest}>{conflict.name}</li>
              ))}
              {conflictDialog.conflicts.length > 6 && <li>…以及另外 {conflictDialog.conflicts.length - 6} 个</li>}
            </ul>
            <div className="dialog-actions dialog-actions-wrap">
              <button type="button" className="btn btn-ghost" onClick={() => useApp.getState().closeConflict()}>取消</button>
              <button type="button" className="btn btn-ghost" onClick={() => useApp.getState().resolveConflicts('skip')}>跳过</button>
              <button type="button" className="btn btn-ghost" onClick={() => useApp.getState().resolveConflicts('keepboth')}>保留两者</button>
              <button type="button" className="btn btn-primary" onClick={() => useApp.getState().resolveConflicts('replace')}>替换</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
