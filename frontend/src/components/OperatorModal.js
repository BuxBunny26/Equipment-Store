import React, { useState, useRef, useEffect } from 'react';
import { useOperator } from '../context/OperatorContext';

function OperatorModal({ onClose }) {
  const { operator, personnel, loading, selectOperator } = useOperator();
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);

  // Focus search input on mount
  useEffect(() => {
    if (!loading && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [loading]);

  // If operator already selected, don't show
  if (operator) return null;

  const filteredPersonnel = personnel.filter(person =>
    person.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    person.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (person) => {
    selectOperator(person);
    if (onClose) onClose();
  };

  return (
    <div className="operator-modal-overlay">
      <div className="operator-modal">
        <div className="operator-modal-header">
          <div className="operator-modal-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2>Select Operator</h2>
          <p>Please identify yourself to continue. This tracks who performs each action.</p>
        </div>

        {loading ? (
          <div className="operator-modal-loading">Loading personnel...</div>
        ) : (
          <>
            <div className="operator-modal-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by name or employee ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="operator-modal-list">
              {filteredPersonnel.length === 0 ? (
                <div className="operator-modal-empty">No personnel found</div>
              ) : (
                filteredPersonnel.map((person) => (
                  <button
                    key={person.id}
                    className="operator-modal-item"
                    onClick={() => handleSelect(person)}
                  >
                    <div className="operator-modal-item-avatar">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div className="operator-modal-item-info">
                      <span className="operator-modal-item-name">{person.full_name}</span>
                      <span className="operator-modal-item-details">
                        {person.employee_id}
                        {person.department && ` • ${person.department}`}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default OperatorModal;
