import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PUBLIC_NAV } from '../config/publicNav';
import { FONT } from '../theme/brand';

/*
 * The public site menu (src/config/publicNav.js), drawn the same way on the
 * homepage and on every other public page. The two headers only pass colours,
 * so the links, dropdowns and their order can't differ between pages.
 *
 * `colors`: { link, linkHover, panelBg, panelBorder, panelText, panelMuted, accent, divider }
 */

const FONT_LABEL = FONT;

const pathOf = (to) => to.split('#')[0];

/** True when `to` is the page being shown (ignores #section links into it) */
const isCurrent = (to, pathname) => !to.includes('#') && pathOf(to).replace(/\/$/, '') === pathname.replace(/\/$/, '');

/**
 * Scrolls to the #section in the address after a menu link (or a direct visit)
 * opens it, below the fixed header. The page may still be loading, so it
 * retries for a few seconds.
 */
const useScrollToHash = () => {
  const { pathname, hash, key } = useLocation();
  useEffect(() => {
    if (!hash) return undefined;
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el || ++tries > 40) {
        clearInterval(timer);
        // data-scroll-align="center" puts a small target mid-screen instead of under the header
        if (el) el.scrollIntoView({ behavior: 'smooth', block: el.dataset.scrollAlign || 'start' });
      }
    }, 100);
    return () => clearInterval(timer);
  }, [pathname, hash, key]);
};

const MenuStyles = () => (
  <style>{`
    [id] { scroll-margin-top: 80px; }
    .td-menu-top { white-space:nowrap; }
    .td-menu-item:hover, .td-menu-item:focus-visible { background:rgba(182,238,105,0.10); }
    .td-menu-heading:hover { text-decoration:underline!important; }
    .td-menu-item:hover .td-menu-label, .td-menu-item:focus-visible .td-menu-label { color:#b6ee69; }
    .td-menu-panel { animation: td-menu-in 0.16s ease-out both; }
    @keyframes td-menu-in { from{opacity:0;transform:translate(-50%,-6px)} to{opacity:1;transform:translate(-50%,0)} }
    @media(max-width:1279px) { .td-menu-bar { gap:22px!important; } .td-menu-top { font-size:12.5px!important; letter-spacing:0!important; } }
  `}</style>
);

const MenuItem = ({ item, colors, onPick, pathname }) => (
  <Link to={item.to} className="td-menu-item" onClick={onPick}
    aria-current={isCurrent(item.to, pathname) ? 'page' : undefined}
    style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 10px', borderRadius:8, textDecoration:'none', transition:'background 0.15s' }}>
    <span aria-hidden="true" style={{ width:30, height:30, flexShrink:0, borderRadius:8, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(182,238,105,0.12)', color:colors.accent, fontSize:13 }}>
      <i className={`fas ${item.icon}`}></i>
    </span>
    <span className="td-menu-label" style={{ fontFamily:FONT_LABEL, fontSize:13.5, fontWeight:600, color:colors.panelText, lineHeight:1.3, transition:'color 0.15s' }}>{item.label}</span>
  </Link>
);

const GroupHeading = ({ group, colors, onPick }) => {
  if (!group.title) return null;
  const style = { display:'block', fontFamily:FONT_LABEL, fontSize:10.5, fontWeight:700, letterSpacing:'1.8px', textTransform:'uppercase', color:colors.panelMuted, margin:'6px 10px 8px', textDecoration:'none' };
  if (group.titleTo) {
    return (
      <Link to={group.titleTo} onClick={onPick} className="td-menu-heading" style={{ ...style, color:colors.accent }}>
        {group.title} <i aria-hidden="true" className="fas fa-arrow-right" style={{ fontSize:9, marginLeft:4 }}></i>
      </Link>
    );
  }
  return <p style={style}>{group.title}</p>;
};

/** The desktop bar: plain links and dropdown buttons, one dropdown open at a time */
export const PublicMenuDesktop = ({ colors, className = '' }) => {
  const [open, setOpen] = useState(null);
  const barRef = useRef(null);
  const closeTimer = useRef(null);
  const { pathname } = useLocation();
  useScrollToHash();

  useEffect(() => { setOpen(null); }, [pathname]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (open === null) return undefined;
    const onClick = (e) => { if (barRef.current && !barRef.current.contains(e.target)) setOpen(null); };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const btn = barRef.current && barRef.current.querySelector(`[data-menu="${open}"]`);
      setOpen(null);
      if (btn) btn.focus();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // Hover opens a dropdown on devices with a mouse; click and keyboard work everywhere
  const hoverOpen  = (label) => { clearTimeout(closeTimer.current); setOpen(label); };
  const hoverClose = () => { clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(null), 180); };
  const canHover = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover)').matches;

  const topStyle = { fontFamily:FONT_LABEL, fontSize:13, fontWeight:600, letterSpacing:'0.3px', color:colors.link, textDecoration:'none', transition:'color 0.2s' };

  return (
    <div ref={barRef} className={`td-menu-bar ${className}`} style={{ display:'flex', alignItems:'center', gap:30 }}>
      <MenuStyles />
      {PUBLIC_NAV.map(entry => {
        if (!entry.groups) {
          const current = isCurrent(entry.to, pathname);
          return (
            <Link key={entry.label} to={entry.to} className="td-menu-top" aria-current={current ? 'page' : undefined}
              style={{ ...topStyle, color:current ? colors.linkHover : colors.link }}
              onMouseEnter={e => { e.currentTarget.style.color = colors.linkHover; }}
              onMouseLeave={e => { e.currentTarget.style.color = current ? colors.linkHover : colors.link; }}>
              {entry.label}
            </Link>
          );
        }
        const isOpen = open === entry.label;
        const wide = entry.groups.length > 1;
        const panelId = `td-menu-${entry.label.toLowerCase().replace(/\W+/g, '-')}`;
        const active = entry.groups.some(g => g.items.some(i => isCurrent(i.to, pathname)));
        return (
          <div key={entry.label} style={{ position:'relative' }}
            onMouseEnter={() => canHover() && hoverOpen(entry.label)}
            onMouseLeave={() => canHover() && hoverClose()}>
            <button type="button" data-menu={entry.label} className="td-menu-top"
              aria-haspopup="true" aria-expanded={isOpen} aria-controls={panelId}
              // With a mouse, hover already opened it: a click must not close it again
              onClick={() => setOpen(o => (o === entry.label && !canHover() ? null : entry.label))}
              style={{ ...topStyle, color:isOpen || active ? colors.linkHover : colors.link, background:'none', border:'none', padding:'8px 0', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 }}>
              {entry.label}
              <i aria-hidden="true" className="fas fa-chevron-down" style={{ fontSize:9, transform:isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}></i>
            </button>
            {isOpen && (
              <div id={panelId} className="td-menu-panel"
                style={{ position:'absolute', top:'calc(100% + 12px)', left:'50%', transform:'translateX(-50%)', width:wide ? 600 : 300, maxWidth:'calc(100vw - 32px)', background:colors.panelBg, border:`1px solid ${colors.panelBorder}`, borderRadius:14, boxShadow:'0 18px 44px rgba(0,0,0,0.28)', padding:12, display:'grid', gridTemplateColumns:wide ? '1fr 1.25fr' : '1fr', gap:wide ? 8 : 0 }}>
                {/* keeps the pointer inside the dropdown while it crosses the gap below the button */}
                <span aria-hidden="true" style={{ position:'absolute', top:-14, left:0, right:0, height:14 }} />
                {entry.groups.map((g, gi) => (
                  <div key={gi} style={{ borderLeft:wide && gi > 0 ? `1px solid ${colors.divider}` : 'none', paddingLeft:wide && gi > 0 ? 10 : 0 }}>
                    <GroupHeading group={g} colors={colors} onPick={() => setOpen(null)} />
                    {g.items.map(item => <MenuItem key={item.to} item={item} colors={colors} pathname={pathname} onPick={() => setOpen(null)} />)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** The phone and tablet menu: dropdowns become sections that open in place */
export const PublicMenuMobile = ({ colors, onNavigate }) => {
  const [open, setOpen] = useState(null);
  const { pathname } = useLocation();
  const rowStyle = { display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', fontFamily:FONT_LABEL, fontSize:15, fontWeight:600, color:colors.panelText, textDecoration:'none', padding:'13px 0', background:'none', border:'none', borderBottom:`1px solid ${colors.divider}`, cursor:'pointer', textAlign:'left' };
  return (
    <div>
      {PUBLIC_NAV.map(entry => {
        if (!entry.groups) {
          return <Link key={entry.label} to={entry.to} onClick={onNavigate} style={rowStyle} aria-current={isCurrent(entry.to, pathname) ? 'page' : undefined}>{entry.label}</Link>;
        }
        const isOpen = open === entry.label;
        const panelId = `td-mmenu-${entry.label.toLowerCase().replace(/\W+/g, '-')}`;
        return (
          <div key={entry.label}>
            <button type="button" style={rowStyle} aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpen(o => (o === entry.label ? null : entry.label))}>
              {entry.label}
              <i aria-hidden="true" className="fas fa-chevron-down" style={{ fontSize:11, color:colors.accent, transform:isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}></i>
            </button>
            {isOpen && (
              <div id={panelId} style={{ padding:'8px 0 10px', borderBottom:`1px solid ${colors.divider}` }}>
                {entry.groups.map((g, gi) => (
                  <div key={gi} style={{ marginTop:gi > 0 ? 8 : 0 }}>
                    <GroupHeading group={g} colors={colors} onPick={onNavigate} />
                    {g.items.map(item => <MenuItem key={item.to} item={item} colors={colors} pathname={pathname} onPick={onNavigate} />)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
