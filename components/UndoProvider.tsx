'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

// A reversible action is described as a single API request (serializable so the
// undo stack survives page reloads). Each mutating action registers the request
// that reverses it: undo a delete → recreate; undo an add → delete; etc.
export interface UndoReq { url: string; method: string; body?: any }
export interface UndoItem { label: string; req: UndoReq }

interface UndoCtx { pushUndo: (item: UndoItem) => void; undoLast: () => void; count: number }
const Ctx = createContext<UndoCtx>({ pushUndo: () => {}, undoLast: () => {}, count: 0 });
export function useUndo() { return useContext(Ctx); }

const KEY = 'litson-undo-stack';

export default function UndoProvider({ children }: { children: React.ReactNode }) {
  const stack = useRef<UndoItem[]>([]);
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { stack.current = JSON.parse(sessionStorage.getItem(KEY) || '[]'); setCount(stack.current.length); } catch { /* ignore */ }
  }, []);

  function persist() {
    setCount(stack.current.length);
    try { sessionStorage.setItem(KEY, JSON.stringify(stack.current.slice(-50))); } catch { /* ignore */ }
  }

  function pushUndo(item: UndoItem) { stack.current.push(item); persist(); }

  async function undoLast() {
    const item = stack.current.pop();
    persist();
    if (!item) { setFlash('Nothing to undo'); setTimeout(() => setFlash(null), 1500); return; }
    setBusy(true);
    try {
      const res = await fetch(item.req.url, {
        method: item.req.method,
        headers: item.req.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: item.req.body !== undefined ? JSON.stringify(item.req.body) : undefined,
      });
      if (!res.ok) throw new Error('undo failed');
      setFlash(`Undone: ${item.label}`);
      // Reload so every tab reflects the reverted data (single source refresh)
      setTimeout(() => window.location.reload(), 300);
    } catch {
      setFlash('Could not undo that');
      setBusy(false);
      setTimeout(() => setFlash(null), 2000);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        undoLast();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider value={{ pushUndo, undoLast, count }}>
      {children}
      {(count > 0 || flash) && (
        <div className="fixed bottom-4 left-4 z-[70] flex items-center gap-2">
          {count > 0 && (
            <button onClick={undoLast} disabled={busy}
              className="flex items-center gap-2 bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl shadow-lg hover:bg-ink-dark disabled:opacity-50">
              ↶ Undo <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">{count}</span>
              <span className="text-[10px] text-white/50 font-normal">Ctrl+Z</span>
            </button>
          )}
          {flash && <span className="bg-white border border-border-light text-text-primary text-sm font-medium px-3 py-2 rounded-ctrl shadow">{flash}</span>}
        </div>
      )}
    </Ctx.Provider>
  );
}
