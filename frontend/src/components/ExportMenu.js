import React, { useState, useRef, useEffect } from 'react';

const Icons = {
  Download: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Printer: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  ),
  ChevronDown: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
};

/**
 * Reusable export dropdown menu.
 * 
 * Props:
 *   onExport(format) — called with 'csv', 'excel', or 'pdf'
 *   onPrint          — optional, called when Print is clicked
 *   formats          — optional array of formats to show, default ['csv', 'excel', 'pdf']
 *   label            — optional button label, default 'Export'
 *   disabled         — optional, disables the button
 */
export default function ExportMenu({ onExport, onPrint, formats = ['csv', 'excel', 'pdf'], label = 'Export', disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const formatLabels = {
    csv: 'CSV',
    excel: 'Excel',
    pdf: 'PDF',
  };

  return (
    <div className="export-menu" ref={ref}>
      <button
        className="btn btn-secondary"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        type="button"
      >
        <Icons.Download size={14} /> {label} <Icons.ChevronDown size={12} />
      </button>
      {open && (
        <div className="export-menu-dropdown">
          {formats.map(fmt => (
            <button
              key={fmt}
              className="export-menu-item"
              onClick={() => { onExport(fmt); setOpen(false); }}
              type="button"
            >
              <Icons.Download size={14} /> {formatLabels[fmt] || fmt}
            </button>
          ))}
          {onPrint && (
            <button
              className="export-menu-item"
              onClick={() => { onPrint(); setOpen(false); }}
              type="button"
            >
              <Icons.Printer size={14} /> Print
            </button>
          )}
        </div>
      )}
    </div>
  );
}
