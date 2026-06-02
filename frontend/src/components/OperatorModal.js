import React, { useState, useRef, useEffect } from 'react';
import { useOperator } from '../context/OperatorContext';
import { mfaApi } from '../services/api';

// Derive the 4-digit PIN from an employee ID
// e.g. WC492 → 0492, WEC094 → 0094, WCN008 → 0008
function derivePin(employeeId) {
  const digits = (employeeId || '').replace(/\D/g, '');
  return digits.padStart(4, '0').slice(-4);
}

function OperatorModal({ onClose }) {
  const { operator, personnel, loading, selectOperator } = useOperator();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [mfaScreen, setMfaScreen] = useState(false);
  const [mfaCode, setMfaCode] = useState(['', '', '', '', '', '']);
  const [mfaError, setMfaError] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const searchInputRef = useRef(null);
  const pinRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const mfaRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  // Focus search input on mount
  useEffect(() => {
    if (!loading && !selectedPerson && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [loading, selectedPerson]);

  // Focus first pin input when person is selected
  useEffect(() => {
    if (selectedPerson && !mfaScreen && pinRefs[0].current) {
      pinRefs[0].current.focus();
    }
  }, [selectedPerson, mfaScreen]);

  // Focus first MFA input when MFA screen appears
  useEffect(() => {
    if (mfaScreen) {
      setTimeout(() => mfaRefs[0].current?.focus(), 100);
    }
  }, [mfaScreen]);

  // If operator already selected, don't show
  if (operator) return null;

  const filteredPersonnel = personnel.filter(person =>
    person.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    person.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePersonSelect = (person) => {
    setSelectedPerson(person);
    setPin(['', '', '', '']);
    setPinError('');
  };

  const handleBackToList = () => {
    setSelectedPerson(null);
    setPin(['', '', '', '']);
    setPinError('');
    setMfaScreen(false);
    setMfaCode(['', '', '', '', '', '']);
    setMfaError('');
  };

  const handlePinChange = (index, value) => {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setPinError('');

    // Auto-focus next input
    if (value && index < 3) {
      pinRefs[index + 1].current?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (value && index === 3 && newPin.every(d => d !== '')) {
      const enteredPin = newPin.join('');
      const correctPin = derivePin(selectedPerson.employee_id);
      if (enteredPin === correctPin) {
        sendMfaCode(selectedPerson);
      } else {
        setPinError('Incorrect PIN. Please try again.');
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
        const correctPin = derivePin(selectedPerson.employee_id);
        if (enteredPin === correctPin) {
          sendMfaCode(selectedPerson);
        } else {
          setPinError('Incorrect PIN. Please try again.');
          setPin(['', '', '', '']);
          setTimeout(() => pinRefs[0].current?.focus(), 100);
        }
      }
    }
  };

  const sendMfaCode = async (person) => {
    if (!person.email) {
      setPinError('No email address on file. Contact admin to add your email before logging in.');
      setPin(['', '', '', '']);
      setTimeout(() => pinRefs[0].current?.focus(), 100);
      return;
    }
    setMfaLoading(true);
    setPinError('');
    try {
      const res = await mfaApi.send(person.id, person.email);
      setMaskedEmail(res.data.masked_email);
      setMfaScreen(true);
      setMfaCode(['', '', '', '', '', '']);
      setMfaError('');
    } catch (err) {
      setPinError(err.message || 'Failed to send verification email.');
      setPin(['', '', '', '']);
      setTimeout(() => pinRefs[0].current?.focus(), 100);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaCodeChange = (index, value) => {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;
    const newCode = [...mfaCode];
    newCode[index] = value;
    setMfaCode(newCode);
    setMfaError('');
    if (value && index < 5) {
      mfaRefs[index + 1].current?.focus();
    }
    if (value && index === 5 && newCode.every(d => d !== '')) {
      handleMfaSubmit(newCode.join(''));
    }
  };

  const handleMfaCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !mfaCode[index] && index > 0) {
      mfaRefs[index - 1].current?.focus();
    }
    if (e.key === 'Enter') {
      const code = mfaCode.join('');
      if (code.length === 6) handleMfaSubmit(code);
    }
  };

  const handleMfaSubmit = async (code) => {
    setMfaLoading(true);
    setMfaError('');
    try {
      await mfaApi.verify(selectedPerson.id, code);
      selectOperator(selectedPerson);
      if (onClose) onClose();
    } catch (err) {
      setMfaError(err.message || 'Invalid code. Please try again.');
      setMfaCode(['', '', '', '', '', '']);
      setTimeout(() => mfaRefs[0].current?.focus(), 100);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !selectedPerson?.email) return;
    setMfaError('');
    setMfaCode(['', '', '', '', '', '']);
    try {
      const res = await mfaApi.send(selectedPerson.id, selectedPerson.email);
      setMaskedEmail(res.data.masked_email);
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
      setTimeout(() => mfaRefs[0].current?.focus(), 100);
    } catch (err) {
      setMfaError(err.message || 'Failed to resend code.');
    }
  };

  const handleForgotPin = () => {
    const subject = encodeURIComponent(`PIN Reset Request - ${selectedPerson.full_name}`);
    const body = encodeURIComponent(
      `Hi Nadhira,\n\nI need help with my Equipment Store PIN.\n\nName: ${selectedPerson.full_name}\nEmployee ID: ${selectedPerson.employee_id}\n\nPlease assist.\n\nThank you.`
    );
    window.open(`mailto:nadhira@wearcheckrs.com?subject=${subject}&body=${body}`, '_blank');
  };

  // MFA Email Verification Screen
  if (mfaScreen && selectedPerson) {
    return (
      <div className="operator-modal-overlay">
        <div className="operator-modal">
          <div className="operator-modal-header">
            <div className="operator-modal-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <h2>Check Your Email</h2>
            <p>A 6-digit code was sent to <strong>{maskedEmail}</strong>. Enter it below to continue.</p>
          </div>

          <div className="operator-pin-container">
            <div className="operator-mfa-inputs">
              {mfaCode.map((digit, i) => (
                <input
                  key={i}
                  ref={mfaRefs[i]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleMfaCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleMfaCodeKeyDown(i, e)}
                  className={`operator-pin-digit ${mfaError ? 'error' : ''}`}
                  autoComplete="off"
                  disabled={mfaLoading}
                />
              ))}
            </div>
            {mfaLoading && <div className="operator-pin-error" style={{ color: 'var(--text-secondary)' }}>Verifying...</div>}
            {mfaError && <div className="operator-pin-error">{mfaError}</div>}
            <button
              type="button"
              className="operator-pin-forgot"
              onClick={handleResendCode}
              disabled={resendCooldown > 0}
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </button>
          </div>

          <div className="operator-modal-footer">
            <button
              type="button"
              className="operator-modal-back-btn"
              onClick={() => { setMfaScreen(false); setPin(['', '', '', '']); setPinError(''); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PIN Entry Screen
  if (selectedPerson) {
    return (
      <div className="operator-modal-overlay">
        <div className="operator-modal">
          <div className="operator-modal-header">
            <div className="operator-modal-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <h2>Enter PIN</h2>
            <p>Welcome, <strong>{selectedPerson.full_name}</strong>. Enter your 4-digit PIN to continue.</p>
          </div>

          <div className="operator-pin-container">
            <div className="operator-pin-inputs">
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
                  className={`operator-pin-digit ${pinError ? 'error' : ''}`}
                  autoComplete="off"
                />
              ))}
            </div>
            {pinError && (
              <div className="operator-pin-error">{pinError}</div>
            )}
            {mfaLoading && !mfaScreen && (
              <div className="operator-pin-error" style={{ color: 'var(--text-secondary)' }}>Sending verification code...</div>
            )}
            <button
              type="button"
              className="operator-pin-forgot"
              onClick={handleForgotPin}
            >
              Forgot PIN? Contact admin
            </button>
          </div>

          <div className="operator-modal-footer">
            <button
              type="button"
              className="operator-modal-back-btn"
              onClick={handleBackToList}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back to operator list
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Operator Selection Screen
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
                    onClick={() => handlePersonSelect(person)}
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
