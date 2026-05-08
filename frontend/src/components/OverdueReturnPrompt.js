import React, { useState } from 'react';
import { movementsApi } from '../services/api';
import { useOperator } from '../context/OperatorContext';

function OverdueReturnPrompt() {
  const { operator, overdueItems, clearOverdueItems, setOverdueItems } = useOperator();
  const [dates, setDates] = useState({});         // { [movementId]: 'YYYY-MM-DD' }
  const [saving, setSaving] = useState({});        // { [movementId]: bool }
  const [saved, setSaved] = useState({});          // { [movementId]: bool }
  const [error, setError] = useState(null);

  if (!operator || overdueItems.length === 0) return null;

  const today = new Date().toISOString().split('T')[0];

  const handleDateChange = (id, val) => {
    setDates(prev => ({ ...prev, [id]: val }));
  };

  const handleSave = async (item) => {
    const newDate = dates[item.id];
    if (!newDate) return;
    setSaving(prev => ({ ...prev, [item.id]: true }));
    setError(null);
    try {
      await movementsApi.updateExpectedReturn(item.id, newDate);
      setSaved(prev => ({ ...prev, [item.id]: true }));
      // Remove from list after a short delay so user sees the confirmation
      setTimeout(() => {
        setOverdueItems(prev => prev.filter(i => i.id !== item.id));
      }, 1200);
    } catch (err) {
      setError('Failed to save date. Please try again.');
    } finally {
      setSaving(prev => ({ ...prev, [item.id]: false }));
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-lg)',
        width: '100%',
        maxWidth: 580,
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(237,108,2,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#ed6c02" strokeWidth="2" width="20" height="20">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
              Overdue Equipment — Action Required
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Hi {operator.full_name.split(' ')[0]}, you have {overdueItems.length} item{overdueItems.length > 1 ? 's' : ''} that {overdueItems.length > 1 ? 'are' : 'is'} overdue for return.
              Please set a new expected return date for each item, or return them as soon as possible.
            </p>
          </div>
        </div>

        {/* Items */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 24px' }}>
          {error && (
            <div style={{ background: 'rgba(211,47,47,0.1)', border: '1px solid #d32f2f', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: '0.83rem', color: '#d32f2f' }}>
              {error}
            </div>
          )}
          {overdueItems.map(item => (
            <div key={item.id} style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '14px 16px',
              marginBottom: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.equipment_code}</div>
                  <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>{item.equipment_name}</div>
                  {item.location && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      Site: {item.location}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{
                    background: 'rgba(237,108,2,0.15)', color: '#ed6c02',
                    borderRadius: 6, padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600,
                  }}>
                    {item.days_out} day{item.days_out !== 1 ? 's' : ''} out
                  </span>
                  {item.expected_return_date && (
                    <div style={{ fontSize: '0.72rem', color: '#d32f2f', marginTop: 4 }}>
                      Was due: {new Date(item.expected_return_date).toLocaleDateString('en-ZA')}
                    </div>
                  )}
                </div>
              </div>

              {saved[item.id] ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2e7d32', fontSize: '0.85rem', fontWeight: 600 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Return date updated
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', flexShrink: 0 }}>New expected return:</label>
                  <input
                    type="date"
                    className="form-control"
                    style={{ flex: 1, minWidth: 140, fontSize: '0.85rem', padding: '5px 8px' }}
                    min={today}
                    value={dates[item.id] || ''}
                    onChange={e => handleDateChange(item.id, e.target.value)}
                  />
                  <button
                    className="btn btn-sm btn-primary"
                    style={{ flexShrink: 0 }}
                    disabled={!dates[item.id] || saving[item.id]}
                    onClick={() => handleSave(item)}
                  >
                    {saving[item.id] ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
        }}>
          <button
            className="btn btn-secondary"
            onClick={clearOverdueItems}
            style={{ fontSize: '0.85rem' }}
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
}

export default OverdueReturnPrompt;
