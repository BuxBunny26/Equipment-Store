import React from 'react';
import { useOperator } from '../context/OperatorContext';

function OperatorWarning() {
  const { isOperatorSelected } = useOperator();

  if (isOperatorSelected) return null;

  return (
    <div className="operator-warning">
      <div className="operator-warning-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div className="operator-warning-text">
        <strong>No Operator Selected</strong>
        <span>Please select an operator from the sidebar before proceeding. This helps track who performed each action.</span>
      </div>
    </div>
  );
}

export default OperatorWarning;
