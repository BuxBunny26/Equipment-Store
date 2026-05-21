import React, { useState, useRef, useEffect, useMemo } from 'react';

/**
 * Lightweight searchable single-select combobox.
 *
 * Props:
 *  - value: string (selected option id, as string)
 *  - onChange: (id: string) => void
 *  - options: Array<{ id: string|number, label: string, sublabel?: string, searchText?: string }>
 *  - placeholder?: string
 *  - required?: boolean
 *  - disabled?: boolean
 *  - name?: string (used for a hidden input so native <form required> validation works)
 *  - allowClear?: boolean (default true)
 */
function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Search...',
  required = false,
  disabled = false,
  name,
  allowClear = true,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const normalizedOptions = useMemo(
    () => options.map((o) => ({ ...o, _id: o.id.toString() })),
    [options]
  );

  const selected = normalizedOptions.find((o) => o._id === (value || '').toString());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter((o) => {
      const hay = (o.searchText || `${o.label} ${o.sublabel || ''}`).toLowerCase();
      return hay.includes(q);
    });
  }, [normalizedOptions, query]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  const selectOption = (opt) => {
    onChange(opt._id);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) selectOption(filtered[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  const displayValue = open ? query : (selected ? selected.label + (selected.sublabel ? ` — ${selected.sublabel}` : '') : '');

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          className="form-input"
          value={displayValue}
          placeholder={selected && !open ? '' : placeholder}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          style={{ paddingRight: allowClear && selected ? '32px' : undefined }}
        />
        {allowClear && selected && !disabled && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); setQuery(''); inputRef.current?.focus(); }}
            aria-label="Clear selection"
            style={{
              position: 'absolute',
              right: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '18px',
              lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Hidden input so native form `required` validation triggers */}
      {name && (
        <input
          type="text"
          name={name}
          value={value || ''}
          required={required}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          style={{
            position: 'absolute',
            opacity: 0,
            height: 0,
            width: 0,
            padding: 0,
            border: 0,
            pointerEvents: 'none',
          }}
          onChange={() => {}}
        />
      )}

      {open && (
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
            maxHeight: '260px',
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          }}
        >
          {filtered.length === 0 ? (
            <li style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              No matches
            </li>
          ) : (
            filtered.map((opt, i) => {
              const isHighlight = i === highlight;
              const isSelected = selected && selected._id === opt._id;
              return (
                <li
                  key={opt._id}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
                  onMouseEnter={() => setHighlight(i)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: isHighlight ? 'var(--bg-secondary)' : 'transparent',
                    fontWeight: isSelected ? 600 : 400,
                    fontSize: '0.875rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <span>{opt.label}</span>
                  {opt.sublabel && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{opt.sublabel}</span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

export default SearchableSelect;
