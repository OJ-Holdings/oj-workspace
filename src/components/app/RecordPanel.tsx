'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function RecordPanel({ titleId, focusKey, onClose, children }: { titleId: string; focusKey: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  useEffect(() => { document.getElementById(titleId)?.focus(); }, [focusKey, titleId]);
  return <dialog ref={dialog} className="record-panel" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="record-panel-body"><button className="icon-button record-close" aria-label="Close prospect" onClick={onClose}><X size={20} /></button>{children}</div>
  </dialog>;
}
