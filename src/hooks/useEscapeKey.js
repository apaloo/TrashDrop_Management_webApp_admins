import { useEffect } from 'react';

/** Calls onEscape when Esc is pressed while active (used to close modals) */
const useEscapeKey = (active, onEscape) => {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onEscape(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onEscape]);
};

export default useEscapeKey;
