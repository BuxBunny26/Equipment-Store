import React, { useState, useEffect } from 'react';
import { monthlyAuditApi, movementsApi, locationsApi } from '../services/api';
import { useOperator } from '../context/OperatorContext';

const AUDIT_KEY_PREFIX = 'audit_month_';

function MonthlyAuditPrompt() {
  const { operator, overdueItems, auditNeeded, dismissAudit } = useOperator();
  const [checkouts, setCheckouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [status, setStatus] = useState({});          // { [movementId]: 'confirmed' | 'returned' }
  const [returning, setReturning] = useState({});    // { [movementId]: bool } — location picker visible
  const [returnLocation, setReturnLocation] = useState({}); // { [movementId]: locationId }
  const [saving, setSaving] = useState({});           // { [movementId]: bool }
  const [error, setError] = useState(null);

  // Only show when operator is set, no overdue prompt is blocking, and audit is due
  const visible = operator && overdueItems.length === 0 && auditNeeded;

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    Promise.all([
      monthlyAuditApi.getCheckedOutForPersonnel(operator.id),
      locationsApi.getAll(true),
    ])
      .then(([checkRes, locRes]) => {
        setCheckouts(checkRes.data || []);
        setLocations(locRes.data || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [visible, operator?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthLabel = new Date().toLocaleString('en-ZA', { month: 'long', year: 'numeric' });

  const handleConfirm = (movementId) => {
    setStatus(prev => ({ ...prev, [movementId]: 'confirmed' }));
    setReturning(prev => ({ ...prev, [movementId]: false }));
  };

  const handleReturnClick = (movementId) => {
    setReturning(prev => ({ ...prev, [movementId]: true }));
    setStatus(prev => { const next = { ...prev }; delete next[movementId]; return next; });
  };

  const handleCancelReturn = (movementId) => {
    setReturning(prev => ({ ...prev, [movementId]: false }));
  };

  const handleReturnConfirm = async (item) => {
    const locId = returnLocation[item.id];
    if (!locId) return;
    setSaving(prev => ({ ...prev, [item.id]: true }));
    setError(null);
    try {
      await movementsApi.create({
        equipment_id: item.equipment_id,
        action: 'IN',
        quantity: 1,
        location_id: locId,
        personnel_id: operator.id,
        notes: `Monthly audit check-in — ${monthLabel}`,
        created_by: operator.full_name,
      });
      setStatus(prev => ({ ...prev, [item.id]: 'returned' }));
      setReturning(prev => ({ ...prev, [item.id]: false }));
    } catch (err) {
      setError('Failed to check in item. Please try again.');
    } finally {
      setSaving(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const handleSubmit = async () => {
    const confirmed = Object.values(status).filter(s => s === 'confirmed').length;
    const returned = Object.values(status).filter(s => s === 'returned').length;
    try {
      await monthlyAuditApi.submitAudit({
        personnel_id: operator.id,
        audit_month: currentMonth,
        items_confirmed: confirmed,
        items_returned: returned,
        had_no_checkouts: checkouts.length === 0,
      });
    } catch {
      // Don't block dismissal if save fails — silently record what we can
    }
    localStorage.setItem(`${AUDIT_KEY_PREFIX}${operator.id}`, currentMonth);
    dismissAudit();
  };

  // ─── No active checkouts ────────────────────────────────────────────────────
  if (!loading && checkouts.length === 0) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1999,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}>
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-lg)',
          width: '100%', maxWidth: 420,
          padding: '32px 28px',
          textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(39,174,96,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#27ae60" strokeWidth="2.5" width="28" height="28">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 700 }}>
            Monthly Equipment Check
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 6px' }}>
            {monthLabel}
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 24px' }}>
            You have no equipment currently checked out to you — all good!
          </p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSubmit}>
            Confirm — All Good
          </button>
        </div>
      </div>
    );
  }

  // ─── Has active checkouts ───────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1999,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-lg)',
        width: '100%', maxWidth: 600,
        maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'flex-start', gap: 14,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(37,99,235,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" width="20" height="20">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <polyline points="9 16 11 18 15 14" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
              Monthly Equipment Audit — {monthLabel}
            </h3>
            {!loading && (
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Please confirm the status of {checkouts.length} item{checkouts.length !== 1 ? 's' : ''} currently checked out to you.
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          {loading && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Loading your checkouts...
            </div>
          )}

          {!loading && checkouts.map(item => {
            const itemStatus = status[item.id];
            const isReturning = returning[item.id];
            const isSaving = saving[item.id];
            const isDone = itemStatus === 'confirmed' || itemStatus === 'returned';

            return (
              <div key={item.id} style={{
                padding: '14px 0',
                borderBottom: '1px solid var(--border-color)',
                opacity: isDone ? 0.75 : 1,
                transition: 'opacity 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.equipment_name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                      {[
                        item.equipment_code,
                        item.category,
                        item.location,
                        `Checked out ${item.days_out} day${item.days_out !== 1 ? 's' : ''} ago`,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </div>

                  {/* Action buttons — only when not handled */}
                  {!isDone && !isReturning && (
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleConfirm(item.id)}
                        style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                      >
                        Still with me
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleReturnClick(item.id)}
                        style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                      >
                        I've returned it
                      </button>
                    </div>
                  )}

                  {/* Confirmed badge */}
                  {itemStatus === 'confirmed' && (
                    <span style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                      color: '#27ae60', fontSize: '0.85rem', fontWeight: 600,
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      With me
                    </span>
                  )}

                  {/* Returned badge */}
                  {itemStatus === 'returned' && (
                    <span style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                      color: '#2563eb', fontSize: '0.85rem', fontWeight: 600,
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Returned
                    </span>
                  )}
                </div>

                {/* Inline location picker for return */}
                {isReturning && (
                  <div style={{
                    marginTop: 10,
                    padding: '12px 14px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 8,
                    display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', flexBasis: '100%', marginBottom: 4 }}>
                      Where did you return it?
                    </span>
                    <select
                      value={returnLocation[item.id] || ''}
                      onChange={e => setReturnLocation(prev => ({ ...prev, [item.id]: e.target.value }))}
                      style={{
                        flex: 1, minWidth: 160,
                        padding: '6px 10px', borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                      }}
                    >
                      <option value="">Select location...</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleReturnConfirm(item)}
                      disabled={!returnLocation[item.id] || isSaving}
                      style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                    >
                      {isSaving ? 'Checking in...' : 'Confirm Check-In'}
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleCancelReturn(item.id)}
                      style={{ fontSize: '0.8rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {!loading && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)' }}>
            {error && (
              <div style={{ color: 'var(--error-color)', fontSize: '0.85rem', marginBottom: 10 }}>
                {error}
              </div>
            )}
            {/* "Not listed" hint */}
            <div style={{
              marginBottom: 12, fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'flex-start', gap: 6,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Have equipment that's not listed? Use the <strong style={{ margin: '0 3px' }}>Check Out</strong> page to record it, then come back to submit.
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSubmit}>
              Submit Audit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MonthlyAuditPrompt;
