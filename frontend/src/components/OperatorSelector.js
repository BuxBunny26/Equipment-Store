import React, { useState, useRef, useEffect } from 'react';
import { useOperator } from '../context/OperatorContext';

function OperatorSelector() {
  const { operator, personnel, loading, selectOperator, clearOperator } = useOperator();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
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
    selectOperator(person);
    setIsOpen(false);
    setSearchTerm('');
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
        </div>
      )}
    </div>
  );
}

export default OperatorSelector;
