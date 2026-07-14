import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { reservationsApi } from '../services/api';
import { useOperator } from '../context/OperatorContext';

const TABS = [
  { key: 'equipment',    label: 'Equipment' },
  { key: 'consumables',  label: 'Consumables' },
  { key: 'reservations', label: 'Reservations' },
  { key: 'laptop',       label: 'Laptop' },
  { key: 'cellphone',    label: 'Cellphone' },
  { key: 'vehicles',     label: 'Vehicles' },
];

const STATUS_BADGE = {
  active:    'badge-available',
  approved:  'badge-available',
  pending:   'badge-consumable',
  completed: 'badge-default',
  cancelled: 'badge-danger',
  Active:    'badge-available',
  Returned:  'badge-default',
  Stolen:    'badge-danger',
  Lost:      'badge-danger',
  Damaged:   'badge-danger',
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTs(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function rand(v) { return v != null ? `R ${Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '—'; }

function InfoGrid({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '16px', padding: '1.25rem' }}>
      {items.map(([label, value]) => (
        <div key={label}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>{label}</div>
          <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{value ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }) {
  return <p style={{ padding: '1.5rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{message}</p>;
}

function MyHistory() {
  const { operator } = useOperator();
  const [activeTab, setActiveTab] = useState('equipment');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const [movements,    setMovements]    = useState([]);
  const [consumables,  setConsumables]  = useState([]);
  const [reservations, setReservations] = useState([]);
  const [laptops,      setLaptops]      = useState([]);
  const [cellphones,   setCellphones]   = useState([]);
  const [trips,        setTrips]        = useState([]);

  const fetchTab = useCallback(async (tab) => {
    if (!operator) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'equipment') {
        const { data, error: e } = await supabase
          .from('equipment_movements')
          .select(`id, action, quantity, notes, created_at, expected_checkout_date, expected_return_date,
            equipment(equipment_id, equipment_name),
            locations(name), customers(display_name)`)
          .eq('personnel_id', operator.id)
          .in('action', ['OUT', 'IN'])
          .order('created_at', { ascending: false })
          .limit(300);
        if (e) throw e;
        setMovements(data || []);
      } else if (tab === 'consumables') {
        const { data, error: e } = await supabase
          .from('equipment_movements')
          .select(`id, action, quantity, notes, created_at,
            equipment(equipment_id, equipment_name), locations(name)`)
          .eq('personnel_id', operator.id)
          .eq('action', 'ISSUE')
          .order('created_at', { ascending: false })
          .limit(300);
        if (e) throw e;
        setConsumables(data || []);
      } else if (tab === 'reservations') {
        const res = await reservationsApi.getAll({ personnel_id: operator.id });
        setReservations(res.data || []);
      } else if (tab === 'laptop') {
        const { data, error: e } = await supabase
          .from('laptop_assignments')
          .select('*')
          .eq('employee_id', operator.employee_id)
          .order('date_assigned', { ascending: false });
        if (e) throw e;
        setLaptops(data || []);
      } else if (tab === 'cellphone') {
        const { data, error: e } = await supabase
          .from('cellphone_assignments')
          .select('*')
          .eq('employee_id', operator.employee_id)
          .order('date_assigned', { ascending: false });
        if (e) throw e;
        setCellphones(data || []);
      } else if (tab === 'vehicles') {
        const { data, error: e } = await supabase
          .from('vehicle_checkouts')
          .select('*, vehicles(make, model, registration_number)')
          .eq('driver_name', operator.full_name)
          .order('checkout_date', { ascending: false })
          .limit(200);
        if (e) throw e;
        setTrips(data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [operator]);

  useEffect(() => { fetchTab(activeTab); }, [activeTab, fetchTab]);

  if (!operator) {
    return (
      <div className="page">
        <div className="alert alert-info">Please select your operator profile to view your history.</div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My History</h1>
          <p className="page-subtitle">{operator.full_name} — {operator.employee_id}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => fetchTab(activeTab)}>Refresh</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '8px 18px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: activeTab === t.key ? 600 : 400,
              color: activeTab === t.key ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: activeTab === t.key ? '2px solid var(--primary-color)' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <div className="loading"><div className="spinner"></div>Loading...</div>
      ) : (
        <>
          {/* ── EQUIPMENT ──────────────────────────────────────────────── */}
          {activeTab === 'equipment' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Equipment Check-Outs & Check-Ins</h2>
                <span className="badge">{movements.length} record{movements.length !== 1 ? 's' : ''}</span>
              </div>
              {movements.length === 0 ? <EmptyState message="No equipment movements found." /> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Action</th>
                        <th>Equipment</th>
                        <th>Location / Customer</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map(m => (
                        <tr key={m.id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{fmtTs(m.created_at)}</td>
                          <td>
                            <span className={`badge ${m.action === 'OUT' ? 'badge-danger' : 'badge-available'}`}>
                              {m.action === 'OUT' ? 'Checked Out' : 'Checked In'}
                            </span>
                          </td>
                          <td>
                            <div>{m.equipment?.equipment_name || '—'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.equipment?.equipment_id}</div>
                          </td>
                          <td>{m.customers?.display_name || m.locations?.name || '—'}</td>
                          <td style={{ maxWidth: '220px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── CONSUMABLES ────────────────────────────────────────────── */}
          {activeTab === 'consumables' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Consumables Issued to Me</h2>
                <span className="badge">{consumables.length} record{consumables.length !== 1 ? 's' : ''}</span>
              </div>
              {consumables.length === 0 ? <EmptyState message="No consumable issues found." /> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Location</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumables.map(m => (
                        <tr key={m.id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{fmtTs(m.created_at)}</td>
                          <td>
                            <div>{m.equipment?.equipment_name || '—'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.equipment?.equipment_id}</div>
                          </td>
                          <td>{m.quantity}</td>
                          <td>{m.locations?.name || '—'}</td>
                          <td style={{ maxWidth: '220px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── RESERVATIONS ───────────────────────────────────────────── */}
          {activeTab === 'reservations' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">My Reservations</h2>
                <span className="badge">{reservations.length} record{reservations.length !== 1 ? 's' : ''}</span>
              </div>
              {reservations.length === 0 ? <EmptyState message="No reservations found." /> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Equipment</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Status</th>
                        <th>Purpose</th>
                        <th>Customer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map(r => (
                        <tr key={r.id}>
                          <td>
                            <div>{r.equipment_name || '—'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.equipment_code}</div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmt(r.start_date)}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmt(r.end_date)}</td>
                          <td><span className={`badge ${STATUS_BADGE[r.status] || 'badge-default'}`}>{r.status}</span></td>
                          <td>{r.purpose || '—'}</td>
                          <td>{r.customer_name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── LAPTOP ─────────────────────────────────────────────────── */}
          {activeTab === 'laptop' && (
            laptops.length === 0
              ? <div className="card"><EmptyState message="No laptop assignment found for your employee code." /></div>
              : laptops.map(l => (
                <div className="card" key={l.id} style={{ marginBottom: '1rem' }}>
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">{[l.brand, l.model].filter(Boolean).join(' ') || 'Laptop'}</h2>
                      {l.serial_number && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>S/N: {l.serial_number}</div>}
                    </div>
                    <span className={`badge ${STATUS_BADGE[l.laptop_status] || 'badge-default'}`}>{l.laptop_status}</span>
                  </div>
                  <InfoGrid items={[
                    ['Asset Tag',      l.asset_tag],
                    ['Assigned Date',  fmt(l.date_assigned)],
                    ['Returned Date',  l.date_returned ? fmt(l.date_returned) : 'Currently assigned'],
                    ['Division',       l.division],
                    ['Device Cost',    rand(l.device_cost)],
                    ['Monthly Cost',   rand(l.monthly_cost)],
                    ['OS',             l.operating_system],
                    ['Notes',          l.notes],
                  ]} />
                </div>
              ))
          )}

          {/* ── CELLPHONE ──────────────────────────────────────────────── */}
          {activeTab === 'cellphone' && (
            cellphones.length === 0
              ? <div className="card"><EmptyState message="No cellphone assignment found for your employee code." /></div>
              : cellphones.map(c => (
                <div className="card" key={c.id} style={{ marginBottom: '1rem' }}>
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">{[c.brand, c.model].filter(Boolean).join(' ') || 'Cellphone'}</h2>
                      {c.imei && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>IMEI: {c.imei}</div>}
                    </div>
                    <span className={`badge ${STATUS_BADGE[c.phone_status] || 'badge-default'}`}>{c.phone_status}</span>
                  </div>
                  <InfoGrid items={[
                    ['Phone Number',   c.phone_number],
                    ['SIM Number',     c.sim_number],
                    ['Network',        c.network_provider],
                    ['Assigned Date',  fmt(c.date_assigned)],
                    ['Returned Date',  c.date_returned ? fmt(c.date_returned) : 'Currently assigned'],
                    ['Division',       c.division],
                    ['Monthly Cost',   rand(c.monthly_cost)],
                    ['Notes',          c.notes],
                  ]} />
                </div>
              ))
          )}

          {/* ── VEHICLES ───────────────────────────────────────────────── */}
          {activeTab === 'vehicles' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">My Vehicle Trips</h2>
                <span className="badge">{trips.length} trip{trips.length !== 1 ? 's' : ''}</span>
              </div>
              {trips.length === 0 ? <EmptyState message="No vehicle trips found." /> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Vehicle</th>
                        <th>Checkout</th>
                        <th>Return</th>
                        <th>Destination</th>
                        <th>Start km</th>
                        <th>End km</th>
                        <th>Distance</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.map(v => {
                        const dist = v.start_odometer && v.end_odometer ? v.end_odometer - v.start_odometer : null;
                        return (
                          <tr key={v.id}>
                            <td>
                              <div>{[v.vehicles?.make, v.vehicles?.model].filter(Boolean).join(' ') || '—'}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{v.vehicles?.registration_number}</div>
                            </td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{fmt(v.checkout_date)}</td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{v.return_date ? fmt(v.return_date) : '—'}</td>
                            <td>{v.destination || '—'}</td>
                            <td>{v.start_odometer?.toLocaleString() ?? '—'}</td>
                            <td>{v.end_odometer?.toLocaleString() ?? '—'}</td>
                            <td>{dist != null ? `${dist.toLocaleString()} km` : '—'}</td>
                            <td>
                              <span className={`badge ${v.is_returned ? 'badge-available' : 'badge-consumable'}`}>
                                {v.is_returned ? 'Returned' : 'Active'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MyHistory;
