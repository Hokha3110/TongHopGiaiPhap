import { useEffect, useRef } from 'react';
import './modal-frame.css';

let openDialogs = 0;
let previousOverflow = '';

// Native dialogs keep focus inside the topmost window, including nested previews.
export default function ModalFrame({ children, onClose, labelledBy, className = '', backdropClassName = '' }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    if (!dialog) return undefined;
    if (openDialogs === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openDialogs += 1;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      openDialogs = Math.max(0, openDialogs - 1);
      if (openDialogs === 0) document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={dialogRef} className={`modal-frame ${className} ${backdropClassName}`} aria-labelledby={labelledBy}
    onCancel={event => { event.preventDefault(); closeRef.current?.(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) closeRef.current?.();
    }}>{children}</dialog>;
}
