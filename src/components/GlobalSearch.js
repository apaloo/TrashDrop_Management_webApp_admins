import React, { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { can } from '../lib/permissions';

// Where the top-bar search can look, in order; each page reads ?q=.
const TARGETS = [
  { key: 'requests', perm: 'requests.view', label: 'Pickup requests', path: '/request-pickup/requests', icon: 'fa-truck' },
  { key: 'dumping', perm: 'dumping.view', label: 'Dumping reports', path: '/illegal-dumping/reports', icon: 'fa-trash' },
];

/**
 * The top-bar search: type, then pick where to look. Enter opens the
 * highlighted choice (the first by default). Only pages the role can open
 * are offered, so the box is hidden for a role with none.
 */
const GlobalSearch = ({ role }) => {
  const navigate = useNavigate();
  const listId = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const targets = TARGETS.filter(t => can(t.perm, role));
  if (!targets.length) return null;

  const term = q.trim();
  const showList = open && term.length > 0;
  const go = (t) => {
    if (!term) return;
    navigate(`${t.path}?q=${encodeURIComponent(term)}`);
    setOpen(false);
    setQ('');
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => (a + 1) % targets.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setActive(a => (a - 1 + targets.length) % targets.length); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <form role="search" className="relative w-1/3 max-w-md hidden md:block"
      onSubmit={(e) => { e.preventDefault(); go(targets[active] || targets[0]); }}>
      <label htmlFor={`${listId}-input`} className="sr-only">Search {targets.map(t => t.label.toLowerCase()).join(' and ')}</label>
      <input
        id={`${listId}-input`}
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={targets.length > 1 ? 'Search requests and reports…' : `Search ${targets[0].label.toLowerCase()}…`}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${listId}-list`}
        aria-activedescendant={showList ? `${listId}-${targets[active]?.key}` : undefined}
        className="w-full h-10 pl-4 pr-10 rounded-lg text-sm"
        style={{ background: 'var(--td-input-bg)', border: '1px solid var(--td-input-border)', color: 'var(--td-input-text)' }}
      />
      <button type="submit" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center" style={{ color: 'var(--td-navbar-icon)' }} aria-label="Search">
        <i className="fas fa-search" aria-hidden="true"></i>
      </button>
      {showList && (
        <ul id={`${listId}-list`} role="listbox" aria-label="Search in"
          className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border bg-white py-1 shadow-lg"
          style={{ borderColor: 'var(--td-dropdown-border)' }}>
          {targets.map((t, i) => (
            <li key={t.key} id={`${listId}-${t.key}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); go(t); }}
              onMouseEnter={() => setActive(i)}
              className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer ${i === active ? 'bg-td-tonal' : ''}`}>
              <i className={`fas ${t.icon} w-4 text-td-forest`} aria-hidden="true"></i>
              <span className="min-w-0 truncate"><span className="text-td-sage">{t.label} matching </span><strong className="text-td-ink">“{term}”</strong></span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
};

export default GlobalSearch;
