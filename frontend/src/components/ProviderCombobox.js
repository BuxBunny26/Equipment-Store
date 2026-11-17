import React, { useState, useRef, useEffect, useMemo } from 'react';

/**
 * Free-text input with a click-to-select dropdown of existing calibration providers
 * underneath it. Unlike SearchableSelect, the final value is NOT constrained to one of
 * `suggestions` -- it's always exactly what's typed, with the dropdown purely a convenience
 * for picking an already-used spelling instead of retyping (and risking a near-duplicate
 * like "Wearcheck" vs "WearCheck") -- a brand new provider can still just be typed.
 *
 * Renders its own absolutely-positioned list (position: relative on the wrapper, position:
 * absolute on the list, anchored in normal document flow) instead of the native
 * <input list>/<datalist> combo this replaced: Chromium mispositions the native datalist
 * popup inside scrollable modal content (see .modal-content's overflow-y: auto in
 * styles/index.css) -- it anchors to the modal's unscrolled position instead of following
 * the input, so the suggestions appeared floating over unrelated fields.
 */
function ProviderCombobox({ value, onChange, suggestions, placeholder, className }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);
  const wrapperRef = useRef(null);

  const filtered = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    const list = q ? suggestions.filter((s) => s.name.toLowerCase().includes(q)) : suggestions;
    return list.slice(0, 20);
  }, [suggestions, value]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectSuggestion = (name) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className={className || 'form-input'}
        placeholder={placeholder}
        value={value || ''}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
      />
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            margin: '4px 0 0 0',
            padding: '4px 0',
            listStyle: 'none',
            background: 'var(--bg-primary, #fff)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            maxHeight: '220px',
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          }}
        >
          {filtered.map((s) => (
            <li
              key={s.name}
              role="option"
              aria-selected={s.name === value}
              onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s.name); }}
              onMouseEnter={() => setHovered(s.name)}
              onMouseLeave={() => setHovered((h) => (h === s.name ? null : h))}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px',
                background: hovered === s.name ? 'var(--bg-secondary)' : 'transparent',
              }}
            >
              <span>{s.name}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{s.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ProviderCombobox;
