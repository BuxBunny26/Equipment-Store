import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { reportsApi, reservationsApi, equipmentApi, calibrationApi, maintenanceApi } from '../services/api';
import { Icons } from '../components/Icons';
import { useOperator } from '../context/OperatorContext';

const COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#d32f2f', '#9c27b0', '#00796b', '#5d4037', '#455a64', '#c2185b', '#0288d1'];

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    let timeout;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setWidth(window.innerWidth), 150);
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(timeout); };
  }, []);
  return width;
}

function EquipmentAnalytics() {
  const [activeTab, setActiveTab] = useState('distribution');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;
  const isSmall = windowWidth <= 480;
  const yAxisWidth = isSmall ? 80 : isMobile ? 110 : 160;
  const pieRadius = isSmall ? 65 : isMobile ? 75 : 90;
  const pieInner = isSmall ? 30 : isMobile ? 38 : 45;
  const { operator } = useOperator();

  // Data stores
  const [locationData, setLocationData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [movements, setMovements] = useState([]);
  const [calData, setCalData] = useState([]);

  // Equipment Insights state
  const [insightEquipId, setInsightEquipId] = useState(null);
  const [insightSearch, setInsightSearch] = useState('');
  const [insightData, setInsightData] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);

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

  // Fetch detailed data for a single equipment item
  const fetchEquipmentInsight = async (eq) => {
    setInsightEquipId(eq.id);
    setInsightLoading(true);
    try {
      const [histRes, calRes, maintRes, resRes] = await Promise.all([
        equipmentApi.getHistory(eq.id, 500),
        calibrationApi.getHistory(eq.id),
        maintenanceApi.getForEquipment(eq.id),
        reservationsApi.getAll({ equipment_id: eq.id }),
      ]);
      const hist = Array.isArray(histRes?.data) ? histRes.data : [];
      const cals = Array.isArray(calRes?.data) ? calRes.data : [];
      const maints = Array.isArray(maintRes?.data) ? maintRes.data : [];
      const ress = Array.isArray(resRes?.data) ? resRes.data : [];

      // Compute stats
      const checkouts = hist.filter(h => h.action === 'OUT');
      const checkins = hist.filter(h => h.action === 'IN');

      // Users who have used this equipment
      const userMap = {};
      checkouts.forEach(h => {
        const name = h.personnel || 'Unknown';
        const empId = h.personnel_employee_id || '';
        const key = empId || name;
        if (!userMap[key]) userMap[key] = { name, empId, count: 0, lastUsed: null };
        userMap[key].count++;
        const d = new Date(h.created_at);
        if (!userMap[key].lastUsed || d > userMap[key].lastUsed) userMap[key].lastUsed = d;
      });
      const users = Object.values(userMap).sort((a, b) => b.count - a.count);

      // Locations visited
      const locMap = {};
      checkouts.forEach(h => {
        const loc = h.location || 'Unknown';
        if (!locMap[loc]) locMap[loc] = 0;
        locMap[loc]++;
      });
      const locations = Object.entries(locMap).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

      // Monthly usage trend (last 12 months)
      const now = new Date();
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          label: d.toLocaleString('en-ZA', { month: 'short', year: '2-digit' }),
          checkouts: 0, checkins: 0,
        });
      }
      const mMap = Object.fromEntries(months.map(m => [m.key, m]));
      hist.forEach(h => {
        const d = new Date(h.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (mMap[key]) {
          if (h.action === 'OUT') mMap[key].checkouts++;
          if (h.action === 'IN') mMap[key].checkins++;
        }
      });

      setInsightData({
        equipment: eq,
        history: hist,
        calibrations: cals,
        maintenance: maints,
        reservations: ress,
        checkoutCount: checkouts.length,
        checkinCount: checkins.length,
        calibrationCount: cals.length,
        maintenanceCount: maints.length,
        reservationCount: ress.length,
        users,
        locations,
        monthlyTrend: months,
      });
    } catch (err) {
      console.error('Failed to fetch equipment insight:', err);
    } finally {
      setInsightLoading(false);
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
    const counts = { Valid: 0, 'Due Soon': 0, Expired: 0, 'Not Calibrated': 0, 'N/A': 0 };
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

  // -- Site / Location checkout analytics --

  // Which site currently has which equipment (grouped by location -> list of equipment)
  const equipmentBySite = useMemo(() => {
    const grouped = {};
    equipment.forEach(e => {
      const loc = e.current_location || 'Unknown';
      if (!grouped[loc]) grouped[loc] = [];
      grouped[loc].push(e);
    });
    return Object.entries(grouped)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([site, items]) => ({ site, items, count: items.length }));
  }, [equipment]);

  // Which site checks out which category the most (stacked bar: site x category)
  const siteCheckoutsByCategory = useMemo(() => {
    const checkouts = movements.filter(m => m.action === 'OUT');
    const siteCatCounts = {};
    const allCategories = new Set();
    checkouts.forEach(m => {
      const site = m.location || 'Unknown';
      const cat = m.category || 'Uncategorised';
      allCategories.add(cat);
      if (!siteCatCounts[site]) siteCatCounts[site] = {};
      siteCatCounts[site][cat] = (siteCatCounts[site][cat] || 0) + 1;
    });
    const cats = [...allCategories].sort();
    return {
      data: Object.entries(siteCatCounts)
        .map(([site, cats_]) => ({ site, ...cats_, total: Object.values(cats_).reduce((a, b) => a + b, 0) }))
        .sort((a, b) => b.total - a.total),
      categories: cats,
    };
  }, [movements]);

  // Checkout dates heatmap data: date -> count of checkouts per site
  const checkoutDatesBySite = useMemo(() => {
    const checkouts = movements.filter(m => m.action === 'OUT');
    const dateMap = {};
    checkouts.forEach(m => {
      const d = new Date(m.created_at);
      const dateKey = d.toLocaleDateString('en-ZA');
      const site = m.location || 'Unknown';
      if (!dateMap[dateKey]) dateMap[dateKey] = { date: dateKey, sortKey: d.getTime() };
      dateMap[dateKey][site] = (dateMap[dateKey][site] || 0) + 1;
      dateMap[dateKey].total = (dateMap[dateKey].total || 0) + 1;
    });
    return Object.values(dateMap).sort((a, b) => b.sortKey - a.sortKey).slice(0, 30);
  }, [movements]);

  // Sites list from checkout data
  const checkoutSites = useMemo(() => {
    const sites = new Set();
    movements.filter(m => m.action === 'OUT').forEach(m => sites.add(m.location || 'Unknown'));
    return [...sites].sort();
  }, [movements]);

  // (Equipment Age Profile removed - replaced by Equipment Insights)

  // -- Availability Calendar: next 30 days --
  const availabilityCalendar = useMemo(() => {
    const now = new Date();
    const days = [];
    const activeRes = reservations.filter(r => r.status !== 'cancelled' && r.status !== 'completed');
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
      const reservedCount = activeRes.filter(r => {
        const start = new Date(r.start_date);
        const end = new Date(r.end_date);
        return d >= start && d <= end;
      }).length;
      const checkedOutCount = equipment.filter(e => e.status === 'Checked Out').length;
      const totalCount = equipment.length;
      const availableCount = Math.max(0, totalCount - checkedOutCount - reservedCount);
      days.push({ date: dateStr, label, reserved: reservedCount, available: availableCount, checkedOut: checkedOutCount });
    }
    return days;
  }, [reservations, equipment]);

  // -- Personal vs Team Usage --
  const personalVsTeam = useMemo(() => {
    const checkouts = movements.filter(m => m.action === 'OUT');
    // Count checkouts per person
    const personCounts = {};
    checkouts.forEach(m => {
      const name = m.personnel_name || 'Unknown';
      const empId = m.personnel_employee_id || '';
      const key = empId || name;
      if (!personCounts[key]) personCounts[key] = { name, empId, count: 0 };
      personCounts[key].count++;
    });
    const allPersons = Object.values(personCounts).sort((a, b) => b.count - a.count);
    const totalCheckouts = checkouts.length;
    const avgPerPerson = allPersons.length > 0 ? totalCheckouts / allPersons.length : 0;

    // Current operator stats
    let myCount = 0;
    let myRank = 0;
    if (operator) {
      const myKey = operator.employee_id || operator.full_name;
      const myEntry = personCounts[myKey];
      myCount = myEntry ? myEntry.count : 0;
      myRank = allPersons.findIndex(p => (p.empId || p.name) === myKey) + 1;
    }

    // Top 10 for comparison chart
    const top10 = allPersons.slice(0, 10).map(p => ({
      name: p.name.length > 20 ? p.name.slice(0, 17) + '...' : p.name,
      checkouts: p.count,
      isMe: operator && (p.empId === operator.employee_id || p.name === operator.full_name),
    }));

    return { allPersons, top10, totalCheckouts, avgPerPerson, myCount, myRank, totalPersons: allPersons.length };
  }, [movements, operator]);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA') : '-';

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: isMobile ? '8px 10px' : '10px 14px', boxShadow: 'var(--shadow-md)', maxWidth: isMobile ? 200 : 'none', fontSize: isMobile ? '0.8rem' : 'inherit' }}>
        <p style={{ margin: 0, fontWeight: 600, marginBottom: 4 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ margin: 0, color: p.color, fontSize: '0.85rem' }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  };

  const truncLabel = (str) => truncate(str, isSmall ? 12 : isMobile ? 16 : 22);
  const truncate = (str, len = 20) => str && str.length > len ? str.slice(0, len - 1) + '…' : str;

  const renderCustomLegend = (props) => {
    const { payload } = props;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: isMobile ? '6px 10px' : '8px 16px', paddingTop: 8 }}>
        {payload.map((entry, i) => {
          const total = props.total || 1;
          const pct = ((entry.payload.value / total) * 100).toFixed(0);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 6, fontSize: isMobile ? '0.72rem' : '0.82rem' }}>
              <span style={{ width: isMobile ? 8 : 10, height: isMobile ? 8 : 10, borderRadius: 2, background: entry.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-primary)' }}>{entry.value}</span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{entry.payload.value} ({pct}%)</span>
            </div>
          );
        })}
      </div>
    );
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
                <YAxis type="category" dataKey="location" tick={{ fontSize: isMobile ? 10 : 12 }} width={yAxisWidth} tickFormatter={truncLabel} />
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
                <YAxis type="category" dataKey="category" tick={{ fontSize: isMobile ? 10 : 12 }} width={yAxisWidth} tickFormatter={truncLabel} />
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
                <Pie data={statusSummary} dataKey="value" nameKey="name" cx="50%" cy="42%" outerRadius={pieRadius} innerRadius={pieInner} paddingAngle={2}>
                  {statusSummary.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend content={(props) => renderCustomLegend({ ...props, total: equipment.length })} />
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
                <Pie data={calibrationSummary} dataKey="value" nameKey="name" cx="50%" cy="42%" outerRadius={pieRadius} innerRadius={pieInner} paddingAngle={2}>
                  {calibrationSummary.map((entry, i) => {
                    const colorMap = { Valid: '#2e7d32', 'Due Soon': '#ed6c02', Expired: '#d32f2f', 'Not Calibrated': '#7b1fa2', 'N/A': '#9e9e9e' };
                    return <Cell key={i} fill={colorMap[entry.name] || COLORS[i]} />;
                  })}
                </Pie>
                <Tooltip />
                <Legend content={(props) => renderCustomLegend({ ...props, total: calData.length })} />
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
          <ResponsiveContainer width="100%" height={isMobile ? 260 : 300}>
            <LineChart data={movementTrend} margin={{ top: 5, right: 20, left: 0, bottom: isMobile ? 20 : 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="label" tick={{ fontSize: isMobile ? 9 : 12 }} angle={isMobile ? -45 : 0} textAnchor={isMobile ? 'end' : 'middle'} height={isMobile ? 50 : 30} interval={isMobile ? 1 : 0} />
              <YAxis allowDecimals={false} width={isMobile ? 30 : 60} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="checkouts" name="Check-Outs" stroke="#d32f2f" strokeWidth={2} dot={{ r: isMobile ? 2 : 3 }} />
              <Line type="monotone" dataKey="checkins" name="Check-Ins" stroke="#2e7d32" strokeWidth={2} dot={{ r: isMobile ? 2 : 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Usage vs Reservations */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Reservations vs Actual Usage</h3>
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 260 : 300}>
            <BarChart data={usageVsReservations} margin={{ top: 5, right: 20, left: 0, bottom: isMobile ? 20 : 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="label" tick={{ fontSize: isMobile ? 9 : 12 }} angle={isMobile ? -45 : 0} textAnchor={isMobile ? 'end' : 'middle'} height={isMobile ? 50 : 30} interval={isMobile ? 1 : 0} />
              <YAxis allowDecimals={false} width={isMobile ? 30 : 60} />
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
                <YAxis type="category" dataKey="name" tick={{ fontSize: isMobile ? 9 : 11 }} width={isSmall ? 80 : isMobile ? 100 : 140} />
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
                <Pie data={reservationStatusSummary} dataKey="value" nameKey="name" cx="50%" cy="42%" outerRadius={pieRadius} innerRadius={pieInner} paddingAngle={2}>
                  {reservationStatusSummary.map((entry, i) => {
                    const colorMap = { Pending: '#ed6c02', Approved: '#1976d2', Active: '#2e7d32', Completed: '#9e9e9e', Cancelled: '#d32f2f' };
                    return <Cell key={i} fill={colorMap[entry.name] || COLORS[i]} />;
                  })}
                </Pie>
                <Tooltip />
                <Legend content={(props) => renderCustomLegend({ ...props, total: reservations.length })} />
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
          <div className="stat-icon blue"><Icons.Calendar size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{reservations.filter(r => r.status !== 'cancelled' && r.status !== 'completed').length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Active Reservations</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><Icons.Warning size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{reservationOverlaps.length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Potential Overlaps</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Icons.Package size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{equipment.filter(e => e.status === 'Checked Out').length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Currently Checked Out</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Icons.Check size={24} /></div>
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

  const renderLocationUsage = () => {
    const catBarHeight = Math.max(280, siteCheckoutsByCategory.data.length * 40 + 60);
    const dateBarHeight = Math.max(300, checkoutDatesBySite.length * 28 + 60);

    return (
      <div>
        {/* Summary stat cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue"><Icons.MapPin size={24} /></div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{equipmentBySite.length}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Active Sites</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Icons.Package size={24} /></div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{equipment.length}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Equipment</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange"><Icons.TrendingUp size={24} /></div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{movements.filter(m => m.action === 'OUT').length}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Check-Outs</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><Icons.Calendar size={24} /></div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{checkoutDatesBySite.length}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Active Checkout Days</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: 20 }}>
          {/* Which site has which equipment */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Equipment Currently at Each Site</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{equipmentBySite.length} sites</span>
            </div>
            {equipmentBySite.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No equipment data</p>
            ) : (
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {equipmentBySite.map((s, si) => (
                  <details key={si} style={{ marginBottom: 4, borderBottom: '1px solid var(--border-color)' }}>
                    <summary style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      <span style={{ flex: 1 }}>{s.site}</span>
                      <span className="badge" style={{ background: COLORS[si % COLORS.length] }}>{s.count}</span>
                    </summary>
                    <div style={{ padding: '4px 12px 12px', overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ width: '100%', fontSize: isMobile ? '0.75rem' : '0.82rem', borderCollapse: 'collapse', minWidth: isMobile ? 320 : 'auto' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-secondary)' }}>ID</th>
                            <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-secondary)' }}>Name</th>
                            <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-secondary)' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.items.map((item, ii) => (
                            <tr key={ii} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '4px 6px', fontFamily: 'monospace', fontSize: '0.78rem' }}>{item.equipment_id}</td>
                              <td style={{ padding: '4px 6px' }}>{truncate(item.equipment_name, 30)}</td>
                              <td style={{ padding: '4px 6px' }}>
                                <span className="badge" style={{ background: item.status === 'Available' ? '#2e7d32' : item.status === 'Checked Out' ? '#ed6c02' : '#9e9e9e', fontSize: '0.7rem' }}>{item.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          {/* Which site checks out which category the most - stacked horizontal bar */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Check-Outs by Site & Category</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Which site checks out what</span>
            </div>
            {siteCheckoutsByCategory.data.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No checkout data</p>
            ) : (
              <ResponsiveContainer width="100%" height={catBarHeight}>
                <BarChart data={siteCheckoutsByCategory.data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="site" tick={{ fontSize: isMobile ? 10 : 12 }} width={yAxisWidth} tickFormatter={truncLabel} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {siteCheckoutsByCategory.categories.map((cat, i) => (
                    <Bar key={cat} dataKey={cat} name={cat} stackId="a" fill={COLORS[i % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Checkout dates by site - recent 30 days with activity */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <h3 className="card-title">Check-Out Activity by Date & Site</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Last {checkoutDatesBySite.length} active days</span>
          </div>
          {checkoutDatesBySite.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No checkout data</p>
          ) : (
            <ResponsiveContainer width="100%" height={dateBarHeight}>
              <BarChart data={[...checkoutDatesBySite].reverse()} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="date" tick={{ fontSize: isMobile ? 9 : 11 }} width={isSmall ? 70 : 100} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {checkoutSites.map((site, i) => (
                  <Bar key={site} dataKey={site} name={site} stackId="a" fill={COLORS[i % COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    );
  };

  const renderEquipmentInsights = () => {
    const filteredEquip = equipment.filter(e =>
      e.equipment_name.toLowerCase().includes(insightSearch.toLowerCase()) ||
      e.equipment_id.toLowerCase().includes(insightSearch.toLowerCase()) ||
      (e.serial_number && e.serial_number.toLowerCase().includes(insightSearch.toLowerCase()))
    );

    // Equipment selector
    if (!insightEquipId || !insightData) {
      return (
        <div>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Select Equipment to View Insights</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{equipment.length} items</span>
            </div>
            <input
              type="text"
              placeholder="Search by name, ID, or serial number..."
              value={insightSearch}
              onChange={(e) => setInsightSearch(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: 12, boxSizing: 'border-box' }}
            />
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {filteredEquip.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>No equipment found</p>
              ) : (
                filteredEquip.map(eq => {
                  const eqMovements = movements.filter(m => m.equipment_name === eq.equipment_name || m.equipment_id === eq.equipment_id);
                  const eqCheckouts = eqMovements.filter(m => m.action === 'OUT').length;
                  const eqCal = calData.find(c => c.equipment_id === eq.id || c.equipment_id === eq.equipment_id);
                  return (
                    <button key={eq.id} onClick={() => fetchEquipmentInsight(eq)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', border: 'none', borderBottom: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary, rgba(0,0,0,0.03))'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{eq.equipment_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {eq.equipment_id}{eq.serial_number ? ` • S/N: ${eq.serial_number}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        <span className="badge" style={{ background: eq.status === 'Available' ? '#2e7d32' : eq.status === 'Checked Out' ? '#ed6c02' : '#9e9e9e', fontSize: '0.7rem' }}>{eq.status}</span>
                        {eqCheckouts > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{eqCheckouts} uses</span>}
                      </div>
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" width="16" height="16" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      );
    }

    if (insightLoading) {
      return <div className="loading"><div className="spinner"></div>Loading equipment insights...</div>;
    }

    const d = insightData;
    const eq = d.equipment;
    return (
      <div>
        {/* Back button + equipment header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => { setInsightEquipId(null); setInsightData(null); }}
            className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            Back
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.25rem' }}>{eq.equipment_name}</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              {eq.equipment_id}{eq.serial_number ? ` • S/N: ${eq.serial_number}` : ''}
              {eq.category_name ? ` • ${eq.category_name}` : ''}
            </div>
          </div>
          <span className="badge" style={{ background: eq.status === 'Available' ? '#2e7d32' : eq.status === 'Checked Out' ? '#ed6c02' : eq.status === 'In Maintenance' ? '#1976d2' : '#9e9e9e', fontSize: '0.75rem' }}>{eq.status}</span>
        </div>

        {/* Stat cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue"><Icons.Package size={24} /></div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{d.checkoutCount}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Times Checked Out</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Icons.Check size={24} /></div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{d.checkinCount}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Times Checked In</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange"><Icons.Wrench size={24} /></div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{d.calibrationCount}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Calibrations</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><Icons.Wrench size={24} /></div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{d.maintenanceCount}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Maintenance Records</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: 20 }}>
          {/* Usage trend chart */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Usage Trend (12 Months)</h3>
            </div>
            <ResponsiveContainer width="100%" height={isMobile ? 240 : 280}>
              <BarChart data={d.monthlyTrend} margin={{ top: 5, right: 20, left: 0, bottom: isMobile ? 20 : 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="label" tick={{ fontSize: isMobile ? 9 : 11 }} angle={isMobile ? -45 : 0} textAnchor={isMobile ? 'end' : 'middle'} height={isMobile ? 50 : 30} interval={isMobile ? 1 : 0} />
                <YAxis allowDecimals={false} width={isMobile ? 30 : 40} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="checkouts" name="Check-Outs" fill="#d32f2f" />
                <Bar dataKey="checkins" name="Check-Ins" fill="#2e7d32" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Users who used this equipment */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Used By</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{d.users.length} user{d.users.length !== 1 ? 's' : ''}</span>
            </div>
            {d.users.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No usage data</p>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table className="equipment-table">
                  <thead><tr><th>User</th><th>Check-Outs</th><th>Last Used</th></tr></thead>
                  <tbody>
                    {d.users.map((u, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          {u.empId && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{u.empId}</div>}
                        </td>
                        <td style={{ fontWeight: 600 }}>{u.count}</td>
                        <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{u.lastUsed ? formatDate(u.lastUsed) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Locations this equipment has been to */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Locations Visited</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{d.locations.length} site{d.locations.length !== 1 ? 's' : ''}</span>
            </div>
            {d.locations.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No location data</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, d.locations.length * 32 + 40)}>
                <BarChart data={d.locations} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} width={yAxisWidth} tickFormatter={truncLabel} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Check-Outs" fill="#1976d2" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Calibration history */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Calibration History</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{d.calibrations.length} record{d.calibrations.length !== 1 ? 's' : ''}</span>
            </div>
            {d.calibrations.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No calibration records</p>
            ) : (
              <div className="table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table className="equipment-table">
                  <thead><tr><th>Date</th><th>Provider</th><th>Status</th><th>Expiry</th></tr></thead>
                  <tbody>
                    {d.calibrations.map((c, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(c.calibration_date)}</td>
                        <td>{truncate(c.calibration_provider || '-', 20)}</td>
                        <td>
                          <span className="badge" style={{ background: c.calibration_status === 'Valid' ? '#2e7d32' : c.calibration_status === 'Expired' ? '#d32f2f' : c.calibration_status === 'Due Soon' ? '#ed6c02' : '#9e9e9e', fontSize: '0.7rem' }}>{c.calibration_status}</span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(c.expiry_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Maintenance history */}
        {d.maintenance.length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <h3 className="card-title">Maintenance History</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{d.maintenance.length} record{d.maintenance.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="table-container">
              <table className="equipment-table">
                <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Status</th><th>Cost</th></tr></thead>
                <tbody>
                  {d.maintenance.map((m, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(m.maintenance_date)}</td>
                      <td>{m.maintenance_type || '-'}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description || '-'}</td>
                      <td>
                        <span className="badge" style={{ background: m.status === 'completed' ? '#2e7d32' : m.status === 'in_progress' ? '#1976d2' : '#ed6c02', fontSize: '0.7rem' }}>{m.status || '-'}</span>
                      </td>
                      <td>{m.cost ? `R${Number(m.cost).toFixed(2)}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Full movement timeline */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <h3 className="card-title">Full Movement Timeline</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{d.history.length} movements</span>
          </div>
          {d.history.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No movement history</p>
          ) : (
            <div className="table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table className="equipment-table">
                <thead><tr><th>Date</th><th>Action</th><th>Location</th><th>Personnel</th><th>Notes</th></tr></thead>
                <tbody>
                  {d.history.map((h, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{new Date(h.created_at).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        <span className="badge" style={{ background: h.action === 'OUT' ? '#d32f2f' : h.action === 'IN' ? '#2e7d32' : '#1976d2', fontSize: '0.7rem' }}>{h.action}</span>
                      </td>
                      <td>{h.location || '-'}</td>
                      <td>{h.personnel || '-'}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{h.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAvailability = () => (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><Icons.Check size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{equipment.filter(e => e.status === 'Available').length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Available Now</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Icons.Package size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{equipment.filter(e => e.status === 'Checked Out').length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Checked Out</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><Icons.Calendar size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{reservations.filter(r => r.status !== 'cancelled' && r.status !== 'completed').length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Active Reservations</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><Icons.Wrench size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{equipment.filter(e => e.status === 'In Maintenance').length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>In Maintenance</div>
          </div>
        </div>
      </div>

      {/* 30-day availability timeline */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">30-Day Availability Forecast</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Equipment availability vs reservations</span>
        </div>
        <ResponsiveContainer width="100%" height={isMobile ? 280 : 350}>
          <BarChart data={availabilityCalendar} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="label" tick={{ fontSize: isMobile ? 8 : 10 }} interval={isMobile ? 3 : 2} angle={-45} textAnchor="end" height={isMobile ? 50 : 60} />
            <YAxis allowDecimals={false} width={isMobile ? 30 : 60} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="available" name="Available" stackId="a" fill="#2e7d32" />
            <Bar dataKey="reserved" name="Reserved" stackId="a" fill="#1976d2" />
            <Bar dataKey="checkedOut" name="Checked Out" stackId="a" fill="#ed6c02" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Upcoming reservations list */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h3 className="card-title">Upcoming Reservations</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Next 30 days</span>
        </div>
        {(() => {
          const now = new Date();
          const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
          const upcoming = reservations
            .filter(r => r.status !== 'cancelled' && r.status !== 'completed' && new Date(r.start_date) <= cutoff)
            .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

          if (upcoming.length === 0) {
            return (
              <div className="empty-state">
                <h3>No upcoming reservations</h3>
                <p>No equipment reserved in the next 30 days</p>
              </div>
            );
          }
          return (
            <div className="table-container">
              <table className="equipment-table">
                <thead>
                  <tr>
                    <th>Equipment</th>
                    <th>Reserved By</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((r, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{truncate(r.equipment_name, 28)}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{r.equipment_code}</div>
                      </td>
                      <td>{r.personnel_name || '-'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(r.start_date)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(r.end_date)}</td>
                      <td>
                        <span className="badge" style={{ background: r.status === 'approved' ? '#1976d2' : r.status === 'active' ? '#2e7d32' : '#ed6c02', fontSize: '0.7rem' }}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </div>
  );

  const renderPersonalVsTeam = () => (
    <div>
      {/* Stat cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Icons.Users size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{personalVsTeam.totalPersons}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Active Users</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Icons.TrendingUp size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{personalVsTeam.totalCheckouts}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Check-Outs</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Icons.BarChart size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{personalVsTeam.avgPerPerson.toFixed(1)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Avg per Person</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><Icons.Check size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{operator ? `${personalVsTeam.myCount} (#${personalVsTeam.myRank || '-'})` : 'Select operator'}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{operator ? 'Your Check-Outs (Rank)' : 'No operator selected'}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: 20 }}>
        {/* Top 10 users bar chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top 10 Most Active Users</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>By check-out count</span>
          </div>
          {personalVsTeam.top10.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No usage data</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, personalVsTeam.top10.length * 36 + 60)}>
              <BarChart data={personalVsTeam.top10} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: isMobile ? 9 : 11 }} width={isSmall ? 80 : isMobile ? 100 : 140} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="checkouts" name="Check-Outs" radius={[0, 4, 4, 0]}>
                  {personalVsTeam.top10.map((entry, i) => (
                    <Cell key={i} fill={entry.isMe ? '#d32f2f' : COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {operator && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8, textAlign: 'center' }}>Your bar is highlighted in red</p>}
        </div>

        {/* All users table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">All Users Usage</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{personalVsTeam.totalPersons} users</span>
          </div>
          {personalVsTeam.allPersons.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No data</p>
          ) : (
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="equipment-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Check-Outs</th>
                    <th>vs Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {personalVsTeam.allPersons.map((p, i) => {
                    const isMe = operator && (p.empId === operator.employee_id || p.name === operator.full_name);
                    const diff = p.count - personalVsTeam.avgPerPerson;
                    return (
                      <tr key={i} style={isMe ? { background: 'var(--highlight-bg, rgba(25, 118, 210, 0.08))' } : {}}>
                        <td style={{ fontWeight: 600 }}>{i + 1}</td>
                        <td>
                          <span style={{ fontWeight: isMe ? 700 : 400 }}>{p.name}</span>
                          {isMe && <span className="badge" style={{ background: '#d32f2f', fontSize: '0.65rem', marginLeft: 6 }}>You</span>}
                        </td>
                        <td style={{ fontWeight: 600 }}>{p.count}</td>
                        <td>
                          <span style={{ color: diff >= 0 ? '#2e7d32' : '#d32f2f', fontWeight: 600 }}>
                            {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
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
      case 'maintenance':
        return (
          <div className="card"><div className="card-header"><h3 className="card-title">Maintenance/Downtime Trends</h3></div>
            <div style={{ color: 'var(--text-secondary)', padding: 24 }}>Maintenance/downtime analytics coming soon...</div>
          </div>
        );
      case 'location':
        return renderLocationUsage();
      case 'insights':
        return renderEquipmentInsights();
      case 'availability':
        return renderAvailability();
      case 'personal':
        return renderPersonalVsTeam();
      case 'failures':
        return (
          <div className="card"><div className="card-header"><h3 className="card-title">Reservation Failures/Downtime Reasons</h3></div>
            <div style={{ color: 'var(--text-secondary)', padding: 24 }}>Reservation failure/downtime reason analytics coming soon...</div>
          </div>
        );
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
          Usage & Trends
        </button>
        <button className={`tab ${activeTab === 'overlaps' ? 'active' : ''}`} onClick={() => setActiveTab('overlaps')}>
          Reservation Overlaps
        </button>
        <button className={`tab ${activeTab === 'maintenance' ? 'active' : ''}`} onClick={() => setActiveTab('maintenance')}>
          Maintenance/Downtime
        </button>
        <button className={`tab ${activeTab === 'location' ? 'active' : ''}`} onClick={() => setActiveTab('location')}>
          Usage by Location/Dept
        </button>
        <button className={`tab ${activeTab === 'insights' ? 'active' : ''}`} onClick={() => setActiveTab('insights')}>
          Equipment Insights
        </button>
        <button className={`tab ${activeTab === 'availability' ? 'active' : ''}`} onClick={() => setActiveTab('availability')}>
          Availability Calendar
        </button>
        <button className={`tab ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => setActiveTab('personal')}>
          Personal vs Team Usage
        </button>
        <button className={`tab ${activeTab === 'failures' ? 'active' : ''}`} onClick={() => setActiveTab('failures')}>
          Reservation Failures
        </button>
      </div>

      {renderContent()}
    </div>
  );
}

export default EquipmentAnalytics;
