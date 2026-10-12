import React, { useEffect, useRef, useState } from 'react';
import { card, border } from '../pickupRequests/theme';
import { EXPORT_COLUMNS, exportRows, toAlertsCsv } from '../../utils/alertUtils';

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const downloadCsv = (rows) => {
  const blob = new Blob([`﻿${toAlertsCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trashdrop-alerts-${stamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Printable page in a hidden frame; the browser's print dialog saves it as PDF */
const printPdf = (rows, summary) => {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>TrashDrop alerts ${stamp()}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font: 11px/1.35 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; }
  h1 { font-size: 16px; margin: 0 0 4px; } p { margin: 0 0 10px; color: #555; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; } tr { page-break-inside: avoid; }
</style></head><body>
<h1>TrashDrop alerts</h1><p>${esc(summary)} · exported ${esc(new Date().toLocaleString())}</p>
<table><thead><tr>${EXPORT_COLUMNS.filter(c => c !== 'ID').map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
<tbody>${rows.map(r => `<tr>${r.slice(1).map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
</body></html>`);
  doc.close();
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60000);
  }, 250);
};

/** Export menu: CSV or PDF of the alerts currently shown (filters applied) */
const AlertExport = ({ alerts, ctx, staffName, summary, onDone }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  const run = (kind) => {
    setOpen(false);
    const rows = exportRows(alerts, ctx, staffName);
    if (kind === 'csv') downloadCsv(rows); else printPdf(rows, summary);
    onDone?.(kind === 'csv' ? `Exported ${rows.length} alerts to CSV` : `Opened ${rows.length} alerts for PDF: choose "Save as PDF" in the print dialog`);
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} disabled={!alerts.length}
        className="px-3 py-1.5 rounded border text-sm disabled:opacity-40" style={border}>
        <i className="fas fa-download mr-1.5" aria-hidden="true"></i>Export ({alerts.length}) ▾
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 z-30 min-w-[12rem] rounded-md border shadow-lg py-1 text-sm" style={card}>
          <button type="button" role="menuitem" className="w-full text-left px-3 py-2 hover:bg-black hover:bg-opacity-5" onClick={() => run('csv')}>CSV (spreadsheet)</button>
          <button type="button" role="menuitem" className="w-full text-left px-3 py-2 hover:bg-black hover:bg-opacity-5" onClick={() => run('pdf')}>PDF (print / save)</button>
        </div>
      )}
    </div>
  );
};

export default AlertExport;
