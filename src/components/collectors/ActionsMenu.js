import React, { useEffect, useRef, useState } from 'react';
import { card, border } from '../pickupRequests/theme';

/** "⋯" menu. items: [{ label, icon, onClick, danger, disabled, title }] */
const ActionsMenu = ({ items, label = 'More actions' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className="px-2.5 py-1 rounded border text-base leading-none font-bold hover:bg-black hover:bg-opacity-5" style={border}>
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 bottom-full mb-1 z-30 min-w-[11rem] rounded-md border shadow-lg py-1 text-sm" style={card}>
          {items.filter(Boolean).map(item => (
            <button key={item.label} type="button" role="menuitem" disabled={item.disabled} title={item.title}
              onClick={() => { setOpen(false); item.onClick(); }}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-black hover:bg-opacity-5 disabled:opacity-40 disabled:cursor-not-allowed ${item.danger ? 'text-red-600' : ''}`}>
              {item.icon && <i className={`${item.icon} w-4 text-center`} aria-hidden="true"></i>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActionsMenu;
