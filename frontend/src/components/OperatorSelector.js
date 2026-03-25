import React, { useState, useRef, useEffect } from 'react';
import { useOperator } from '../context/OperatorContext';

// Derive the 4-digit PIN from an employee ID (same logic as OperatorModal)
function derivePin(employeeId) {
  const digits = (employeeId || '').replace(/\D/g, '');
  return digits.padStart(4, '0').slice(-4);
}

function OperatorSelector() {
  const { operator, personnel, loading, selectOperator, clearOperator } = useOperator();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingPerson, setPendingPerson] = useState(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const pinRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setPendingPerson(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredPersonnel = personnel.filter(person =>
    person.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    person.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (person) => {
    // If selecting the same person, just close
    if (operator?.id === person.id) {
      setIsOpen(false);
      setSearchTerm('');
      return;
    }
    // Show PIN prompt for the new person
    setPendingPerson(person);
    setPin(['', '', '', '']);
    setPinError('');
    setTimeout(() => pinRefs[0].current?.focus(), 100);
  };

  const handlePinChange = (index, value) => {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setPinError('');
    if (value && index < 3) {
      pinRefs[index + 1].current?.focus();
    }
    if (value && index === 3 && newPin.every(d => d !== '')) {
      const enteredPin = newPin.join('');
      const correctPin = derivePin(pendingPerson.employee_id);
      if (enteredPin === correctPin) {
        selectOperator(pendingPerson);
        setPendingPerson(null);
        setIsOpen(false);
        setSearchTerm('');
      } else {
        setPinError('Incorrect PIN');
        setPin(['', '', '', '']);
        setTimeout(() => pinRefs[0].current?.focus(), 100);
      }
    }
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
    if (e.key === 'Enter') {
      const enteredPin = pin.join('');
      if (enteredPin.length === 4) {
        const correctPin = derivePin(pendingPerson.employee_id);
        if (enteredPin === correctPin) {
          selectOperator(pendingPerson);
          setPendingPerson(null);
          setIsOpen(false);
          setSearchTerm('');
        } else {
          setPinError('Incorrect PIN');
          setPin(['', '', '', '']);
          setTimeout(() => pinRefs[0].current?.focus(), 100);
        }
      }
    }
    if (e.key === 'Escape') {
      setPendingPerson(null);
    }
  };

  const handleCancelPin = () => {
    setPendingPerson(null);
    setPin(['', '', '', '']);
    setPinError('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    clearOperator();
  };

  if (loading) {
    return (
      <div className="operator-selector">
        <div className="operator-selector-button loading">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="operator-selector" ref={dropdownRef}>
      <button 
        className={`operator-selector-button ${operator ? 'has-operator' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="operator-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div className="operator-info">
          {operator ? (
            <>
              <span className="operator-name">{operator.full_name}</span>
              <span className="operator-id">{operator.employee_id}</span>
            </>
          ) : (
            <>
              <span className="operator-name">Select Operator</span>
              <span className="operator-id">Click to sign in</span>
            </>
          )}
        </div>
        {operator && (
          <button className="operator-clear" onClick={handleClear} title="Sign out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
        <div className="operator-chevron">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="operator-dropdown">
          {pendingPerson ? (
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <button onClick={handleCancelPin} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary)' }} title="Back">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                </button>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{pendingPerson.full_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{pendingPerson.employee_id}</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginBottom: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Enter PIN to switch operator
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    ref={pinRefs[i]}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(i, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(i, e)}
                    style={{
                      width: 40, height: 48, textAlign: 'center', fontSize: '1.2rem',
                      border: `2px solid ${pinError ? '#d32f2f' : 'var(--border-color)'}`,
                      borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#1976d2'}
                    onBlur={(e) => e.target.style.borderColor = pinError ? '#d32f2f' : 'var(--border-color)'}
                  />
                ))}
              </div>
              {pinError && <div style={{ color: '#d32f2f', fontSize: '0.8rem', textAlign: 'center' }}>{pinError}</div>}
            </div>
          ) : (
          <>
          <div className="operator-dropdown-search">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="operator-dropdown-list">
            {filteredPersonnel.length === 0 ? (
              <div className="operator-dropdown-empty">
                No personnel found
              </div>
            ) : (
              filteredPersonnel.map((person) => (
                <button
                  key={person.id}
                  className={`operator-dropdown-item ${operator?.id === person.id ? 'selected' : ''}`}
                  onClick={() => handleSelect(person)}
                >
                  <div className="operator-dropdown-item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className="operator-dropdown-item-info">
                    <span className="name">{person.full_name}</span>
                    <span className="details">
                      {person.employee_id}
                      {person.department && ` • ${person.department}`}
                    </span>
                  </div>
                  {operator?.id === person.id && (
                    <div className="operator-dropdown-item-check">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
          </>
          )}
        </div>
      )}
    </div>
  );
}

export default OperatorSelector;
