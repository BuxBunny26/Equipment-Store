import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { reportsApi, reservationsApi, equipmentApi, calibrationApi } from '../services/api';

const COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#d32f2f', '#9c27b0', '#00796b', '#5d4037', '#455a64', '#c2185b', '#0288d1'];

function EquipmentAnalytics() {
  const [activeTab, setActiveTab] = useState('distribution');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data stores
  const [locationData, setLocationData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [movements, setMovements] = useState([]);
  const [calData, setCalData] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [locRes, catRes, eqRes, resRes, movRes, calRes] = await Promise.all([
        reportsApi.getByLocation(),
        reportsApi.getByCategory(),
        equipmentApi.getAll({ is_consumable: 'false' }),
        reservationsApi.getAll({}),
        reportsApi.getMovementHistory({ limit: 1000 }),
        calibrationApi.getStatus(),
      ]);
      setLocationData(Array.isArray(locRes?.data) ? locRes.data : []);
      setCategoryData(Array.isArray(catRes?.data) ? catRes.data : []);
      setEquipment(Array.isArray(eqRes?.data) ? eqRes.data : []);
      setReservations(Array.isArray(resRes?.data) ? resRes.data : []);
      setMovements(Array.isArray(movRes?.data) ? movRes.data : []);
      setCalData(Array.isArray(calRes?.data) ? calRes.data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // -- Derived data --

  const statusSummary = useMemo(() => {
    const counts = {};
    equipment.forEach(e => {
      const s = e.status || 'Unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [equipment]);

  const calibrationSummary = useMemo(() => {
    const counts = { Valid: 0, 'Due Soon': 0, Expired: 0, 'N/A': 0 };
    calData.forEach(c => {
      const s = c.calibration_status || 'N/A';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [calData]);

  // Monthly movement trend (last 12 months)
  const movementTrend = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString('en-ZA', { month: 'short', year: '2-digit' }),
        checkouts: 0,
        checkins: 0,
      });
    }
    const monthMap = Object.fromEntries(months.map(m => [m.key, m]));
    movements.forEach(m => {
      const d = new Date(m.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap[key]) {
        if (m.action === 'OUT') monthMap[key].checkouts++;
        if (m.action === 'IN') monthMap[key].checkins++;
      }
    });
    return months;
  }, [movements]);

  // Reservation overlaps
  const reservationOverlaps = useMemo(() => {
    const active = reservations.filter(r => r.status !== 'cancelled' && r.status !== 'completed');
    // Group by equipment
    const byEquipment = {};
    active.forEach(r => {
      const key = r.equipment_id;
      if (!byEquipment[key]) byEquipment[key] = [];
      byEquipment[key].push(r);
    });

    const overlaps = [];
    Object.entries(byEquipment).forEach(([, rList]) => {
      if (rList.length < 2) return;
      rList.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
      for (let i = 0; i < rList.length; i++) {
        for (let j = i + 1; j < rList.length; j++) {
          const a = rList[i];
          const b = rList[j];
          if (new Date(a.end_date) >= new Date(b.start_date)) {
            overlaps.push({ a, b });
          }
        }
      }
    });
    return overlaps;
  }, [reservations]);

  // Reservations vs actual usage per month
  const usageVsReservations = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString('en-ZA', { month: 'short', year: '2-digit' }),
        reservations: 0,
        actualUse: 0,
      });
    }
    const mMap = Object.fromEntries(months.map(m => [m.key, m]));
    reservations.forEach(r => {
      const d = new Date(r.start_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (mMap[key]) mMap[key].reservations++;
    });
    movements.filter(m => m.action === 'OUT').forEach(m => {
      const d = new Date(m.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (mMap[key]) mMap[key].actualUse++;
    });
    return months;
  }, [reservations, movements]);

  // Reservation status breakdown
  const reservationStatusSummary = useMemo(() => {
    const counts = {};
    reservations.forEach(r => {
      const s = r.status || 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [reservations]);

  // Top 10 most used equipment
  const topEquipment = useMemo(() => {
    const counts = {};
    movements.filter(m => m.action === 'OUT').forEach(m => {
      const key = m.equipment_name || m.equipment_id;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, checkouts]) => ({ name: name.length > 25 ? name.slice(0, 22) + '...' : name, checkouts }));
  }, [movements]);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA') : '-';

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 14px', boxShadow: 'var(--shadow-md)' }}>
        <p style={{ margin: 0, fontWeight: 600, marginBottom: 4 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ margin: 0, color: p.color, fontSize: '0.85rem' }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  };

  const truncate = (str, len = 20) => str && str.length > len ? str.slice(0, len - 1) + '…' : str;

  const renderPieLabel = ({ name, percent, cx, x }) => {
    const label = `${name} (${(percent * 100).toFixed(0)}%)`;
    const anchor = x > cx ? 'start' : 'end';
    return <text x={x} y={undefined} textAnchor={anchor} fill="var(--text-primary)" fontSize={12}>{label}</text>;
  };

  const renderDistribution = () => {
    const locSorted = [...locationData].filter(l => l.total_items > 0).sort((a, b) => b.total_items - a.total_items);
    const catSorted = [...categoryData].filter(c => c.total_items > 0).sort((a, b) => b.total_items - a.total_items);
    const locHeight = Math.max(280, locSorted.length * 36 + 60);
    const catHeight = Math.max(280, catSorted.length * 36 + 60);

    return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: 20 }}>
        {/* By Location - horizontal */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Equipment by Location</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{locSorted.reduce((s, l) => s + l.total_items, 0)} total</span>
          </div>
          {locSorted.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No location data</p>
          ) : (
            <ResponsiveContainer width="100%" height={locHeight}>
              <BarChart data={locSorted} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="location" tick={{ fontSize: 12 }} width={160} tickFormatter={(v) => truncate(v, 22)} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="available" name="Available" fill="#2e7d32" stackId="a" radius={[0, 4, 4, 0]} />
                <Bar dataKey="checked_out" name="Checked Out" fill="#ed6c02" stackId="a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By Category - horizontal */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Equipment by Category</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{catSorted.reduce((s, c) => s + c.total_items, 0)} total</span>
          </div>
          {catSorted.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No category data</p>
          ) : (
            <ResponsiveContainer width="100%" height={catHeight}>
              <BarChart data={catSorted} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={160} tickFormatter={(v) => truncate(v, 22)} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="available" name="Available" fill="#1976d2" stackId="a" radius={[0, 4, 4, 0]} />
                <Bar dataKey="checked_out" name="Checked Out" fill="#d32f2f" stackId="a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status Pie */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Status Breakdown</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{equipment.length} items</span>
          </div>
          {statusSummary.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={statusSummary} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={90} innerRadius={45} paddingAngle={2} label={renderPieLabel} labelLine={{ stroke: 'var(--text-secondary)', strokeWidth: 1 }}>
                  {statusSummary.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ paddingTop: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Calibration Pie */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Calibration Status</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{calData.length} records</span>
          </div>
          {calibrationSummary.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No calibration data</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={calibrationSummary} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={90} innerRadius={45} paddingAngle={2} label={renderPieLabel} labelLine={{ stroke: 'var(--text-secondary)', strokeWidth: 1 }}>
                  {calibrationSummary.map((entry, i) => {
                    const colorMap = { Valid: '#2e7d32', 'Due Soon': '#ed6c02', Expired: '#d32f2f', 'N/A': '#9e9e9e' };
                    return <Cell key={i} fill={colorMap[entry.name] || COLORS[i]} />;
                  })}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ paddingTop: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
    );
  };

  const renderUsage = () => (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: 20 }}>
        {/* Movement Trend */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Monthly Check-Out / Check-In Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={movementTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="checkouts" name="Check-Outs" stroke="#d32f2f" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="checkins" name="Check-Ins" stroke="#2e7d32" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Usage vs Reservations */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Reservations vs Actual Usage</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={usageVsReservations} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="reservations" name="Reservations" fill="#1976d2" />
              <Bar dataKey="actualUse" name="Actual Check-Outs" fill="#2e7d32" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top 10 equipment */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top 10 Most Used Equipment</h3>
          </div>
          {topEquipment.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No usage data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topEquipment} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="checkouts" name="Check-Outs" fill="#9c27b0" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Reservation Status */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Reservation Status Breakdown</h3>
          </div>
          {reservationStatusSummary.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No reservations</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={reservationStatusSummary} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                  {reservationStatusSummary.map((entry, i) => {
                    const colorMap = { Pending: '#ed6c02', Approved: '#1976d2', Active: '#2e7d32', Completed: '#9e9e9e', Cancelled: '#d32f2f' };
                    return <Cell key={i} fill={colorMap[entry.name] || COLORS[i]} />;
                  })}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );

  const renderOverlaps = () => (
    <div>
      {/* Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">📅</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{reservations.filter(r => r.status !== 'cancelled' && r.status !== 'completed').length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Active Reservations</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">⚠️</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{reservationOverlaps.length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Potential Overlaps</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">📦</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{equipment.filter(e => e.status === 'Checked Out').length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Currently Checked Out</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✓</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{equipment.filter(e => e.status === 'Available').length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Available</div>
          </div>
        </div>
      </div>

      {/* Overlaps Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Reservation Overlaps</h3>
        </div>
        {reservationOverlaps.length === 0 ? (
          <div className="empty-state">
            <h3>No overlapping reservations</h3>
            <p>All current reservations are conflict-free</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="equipment-table">
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Reservation A</th>
                  <th>Dates A</th>
                  <th>Reservation B</th>
                  <th>Dates B</th>
                  <th>Overlap Days</th>
                </tr>
              </thead>
              <tbody>
                {reservationOverlaps.map((o, i) => {
                  const overlapStart = new Date(Math.max(new Date(o.a.start_date), new Date(o.b.start_date)));
                  const overlapEnd = new Date(Math.min(new Date(o.a.end_date), new Date(o.b.end_date)));
                  const overlapDays = Math.max(1, Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1);
                  return (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{o.a.equipment_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{o.a.equipment_code}</div>
                      </td>
                      <td>
                        <div>{o.a.personnel_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{o.a.purpose || '-'}</div>
                        <span className="badge" style={{ background: o.a.status === 'approved' ? '#1976d2' : '#ed6c02', fontSize: '0.7rem' }}>{o.a.status}</span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {formatDate(o.a.start_date)} — {formatDate(o.a.end_date)}
                      </td>
                      <td>
                        <div>{o.b.personnel_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{o.b.purpose || '-'}</div>
                        <span className="badge" style={{ background: o.b.status === 'approved' ? '#1976d2' : '#ed6c02', fontSize: '0.7rem' }}>{o.b.status}</span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {formatDate(o.b.start_date)} — {formatDate(o.b.end_date)}
                      </td>
                      <td>
                        <span className="badge" style={{ background: '#d32f2f' }}>{overlapDays} day{overlapDays !== 1 ? 's' : ''}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading">
          <div className="spinner"></div>
          Loading analytics...
        </div>
      );
    }
    if (error) {
      return (
        <div className="alert alert-error">
          {error}
          <button className="btn btn-sm btn-secondary" onClick={fetchAllData} style={{ marginLeft: 'auto' }}>Retry</button>
        </div>
      );
    }
    switch (activeTab) {
      case 'distribution': return renderDistribution();
      case 'usage': return renderUsage();
      case 'overlaps': return renderOverlaps();
      default: return null;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Equipment Analytics</h1>
          <p className="page-subtitle">Visual overview of equipment distribution, usage, and reservations</p>
        </div>
        <div className="btn-group-wrap">
          <button className="btn btn-secondary" onClick={fetchAllData}>Refresh</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'distribution' ? 'active' : ''}`} onClick={() => setActiveTab('distribution')}>
          Distribution
        </button>
        <button className={`tab ${activeTab === 'usage' ? 'active' : ''}`} onClick={() => setActiveTab('usage')}>
          Usage &amp; Trends
        </button>
        <button className={`tab ${activeTab === 'overlaps' ? 'active' : ''}`} onClick={() => setActiveTab('overlaps')}>
          Reservation Overlaps
        </button>
      </div>

      {renderContent()}
    </div>
  );
}

export default EquipmentAnalytics;
