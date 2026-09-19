import { useEffect, useRef, type ReactNode } from 'react';

// Mount only while open. The browser owns focus trapping and background inertness.
export default function ModalDialog({ label, busy = false, onClose, children, wide = false }: { label: string; busy?: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} aria-label={label} aria-modal="true" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    className={`w-[calc(100%_-_2rem)] ${wide ? 'max-w-lg' : 'max-w-md'} max-h-[90dvh] overflow-y-auto rounded-2xl p-0 border-0 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm`}>
    {children}
  </dialog>;
}
