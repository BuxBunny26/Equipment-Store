import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { softwareLicensesApi, softwareAssignmentsApi, personnelApi } from '../services/api';
import { useOperator } from '../context/OperatorContext';
import { Icons } from '../components/Icons';
import { buildDivisionLookup, lookupDivision } from '../utils/divisionUtils';

// ─── helpers ────────────────────────────────────────────────────────────────

const BILLING_CYCLES = ['Monthly', 'Annual', 'One-time'];
const LICENSE_TYPES = ['Per User', 'Per Device', 'Site License', 'Concurrent'];

function monthlyCost(lic) {
  if (!lic || !lic.cost_per_seat) return 0;
  const seats = lic.assigned_count || 0;
  if (lic.billing_cycle === 'Annual') return (lic.cost_per_seat / 12) * seats;
  if (lic.billing_cycle === 'One-time') return 0;
  return lic.cost_per_seat * seats;
}

function annualCost(lic) {
  if (!lic || !lic.cost_per_seat) return 0;
  const seats = lic.assigned_count || 0;
  if (lic.billing_cycle === 'Annual') return lic.cost_per_seat * seats;
  if (lic.billing_cycle === 'One-time') return 0;
  return (lic.cost_per_seat * seats) * 12;
}

function fmtCurrency(val) {
  if (val == null || isNaN(val)) return '-';
  return 'R ' + Number(val).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getRenewalStatus(date) {
  if (!date) return null;
  const days = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'expired';
  if (days <= 30) return 'due-soon';
  return 'ok';
}

// ─── Main Component ─────────────────────────────────────────────────────────

function SoftwareLicenses() {
  const { operatorRole } = useOperator();
  const isAdmin = true; // same pattern as LaptopAssignments

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [licenses, setLicenses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [personnel, setPersonnel] = useState([]);

  // Catalog modal
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [editLicense, setEditLicense] = useState(null);
  const [licenseForm, setLicenseForm] = useState({});
  const [licSaving, setLicSaving] = useState(false);

  // Assignment modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForLicense, setAssignForLicense] = useState(null);
  const [editAssignment, setEditAssignment] = useState(null);
  const [assignForm, setAssignForm] = useState({});
  const [assignSaving, setAssignSaving] = useState(false);

  // Filters (assignments tab)
  const [assignSearch, setAssignSearch] = useState('');
  const [assignSoftwareFilter, setAssignSoftwareFilter] = useState('');
  const [assignDivisionFilter, setAssignDivisionFilter] = useState('');

  // Filters (catalog tab)
  const [catSearch, setCatSearch] = useState('');

  // Bulk assign modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkForLicense, setBulkForLicense] = useState(null);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [licRes, assignRes, personnelRes] = await Promise.all([
        softwareLicensesApi.getAll(false),
        softwareAssignmentsApi.getAll(null, false),
        personnelApi.getAll(true),
      ]);
      setLicenses(licRes.data || []);
      setAssignments(assignRes.data || []);
      setPersonnel(personnelRes.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const divLookup = buildDivisionLookup(personnel);

  // Enrich licenses with assignment counts
  const enrichedLicenses = useMemo(() => {
    return licenses.map(lic => {
      const active = assignments.filter(a => a.software_license_id === lic.id && a.is_active);
      return { ...lic, assigned_count: active.length };
    });
  }, [licenses, assignments]);

  // Filter catalog
  const filteredCatalog = useMemo(() => {
    return enrichedLicenses.filter(lic => {
      if (catSearch) {
        const t = catSearch.toLowerCase();
        return lic.name?.toLowerCase().includes(t) || lic.vendor?.toLowerCase().includes(t);
      }
      return true;
    });
  }, [enrichedLicenses, catSearch]);

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      if (!a.is_active) return false;
      if (assignSoftwareFilter && a.software_license_id !== parseInt(assignSoftwareFilter)) return false;
      if (assignDivisionFilter) {
        const div = lookupDivision(divLookup, { employee_name: a.employee_name }, 'employee_name');
        if (div !== assignDivisionFilter) return false;
      }
      if (assignSearch) {
        const t = assignSearch.toLowerCase();
        return (
          a.employee_name?.toLowerCase().includes(t) ||
          a.employee_id?.toLowerCase().includes(t) ||
          a.software_name?.toLowerCase().includes(t)
        );
      }
      return true;
    });
  }, [assignments, assignSoftwareFilter, assignDivisionFilter, assignSearch, divLookup]);

  // Stats
  const stats = useMemo(() => {
    const activeLics = enrichedLicenses.filter(l => l.is_active);
    const totalMonthly = activeLics.reduce((s, l) => s + monthlyCost(l), 0);
    const totalAnnual = activeLics.reduce((s, l) => s + annualCost(l), 0);
    const totalSeats = assignments.filter(a => a.is_active).length;
    const expiringSoon = activeLics.filter(l => getRenewalStatus(l.renewal_date) === 'due-soon').length;
    return { count: activeLics.length, totalMonthly, totalAnnual, totalSeats, expiringSoon };
  }, [enrichedLicenses, assignments]);

  // Division cost breakdown (for active assignments)
  const divisionBreakdown = useMemo(() => {
    const map = {};
    assignments.filter(a => a.is_active).forEach(a => {
      const div = lookupDivision(divLookup, { employee_name: a.employee_name }, 'employee_name') || 'Unknown';
      if (!map[div]) map[div] = { count: 0, monthly: 0 };
      map[div].count += 1;
      const lic = enrichedLicenses.find(l => l.id === a.software_license_id);
      if (lic && lic.cost_per_seat) {
        const m = lic.billing_cycle === 'Annual' ? lic.cost_per_seat / 12 : lic.billing_cycle === 'One-time' ? 0 : lic.cost_per_seat;
        map[div].monthly += m;
      }
    });
    return Object.entries(map).map(([div, v]) => ({ division: div, ...v })).sort((a, b) => b.monthly - a.monthly);
  }, [assignments, enrichedLicenses, divLookup]);

  const divisions = useMemo(() => {
    return [...new Set(
      personnel.map(p => p.division).filter(Boolean)
    )].sort();
  }, [personnel]);

  // ── License CRUD ───────────────────────────────────────────────────────────

  const openAddLicense = () => {
    setEditLicense(null);
    setLicenseForm({ name: '', vendor: '', license_type: 'Per User', cost_per_seat: '', billing_cycle: 'Monthly', total_seats: '', renewal_date: '', notes: '', is_active: true });
    setShowLicenseModal(true);
  };

  const openEditLicense = (lic) => {
    setEditLicense(lic);
    setLicenseForm({
      name: lic.name || '',
      vendor: lic.vendor || '',
      license_type: lic.license_type || 'Per User',
      cost_per_seat: lic.cost_per_seat ?? '',
      billing_cycle: lic.billing_cycle || 'Monthly',
      total_seats: lic.total_seats ?? '',
      renewal_date: lic.renewal_date || '',
      notes: lic.notes || '',
      is_active: lic.is_active !== false,
    });
    setShowLicenseModal(true);
  };

  const saveLicense = async () => {
    if (!licenseForm.name?.trim()) { alert('Software name is required.'); return; }
    setLicSaving(true);
    try {
      const payload = {
        name: licenseForm.name.trim(),
        vendor: licenseForm.vendor?.trim() || null,
        license_type: licenseForm.license_type || 'Per User',
        cost_per_seat: licenseForm.cost_per_seat !== '' ? parseFloat(licenseForm.cost_per_seat) : null,
        billing_cycle: licenseForm.billing_cycle || 'Monthly',
        total_seats: licenseForm.total_seats !== '' ? parseInt(licenseForm.total_seats) : null,
        renewal_date: licenseForm.renewal_date || null,
        notes: licenseForm.notes?.trim() || null,
        is_active: licenseForm.is_active !== false,
      };
      if (editLicense) {
        await softwareLicensesApi.update(editLicense.id, payload);
      } else {
        await softwareLicensesApi.create(payload);
      }
      setShowLicenseModal(false);
      fetchData();
    } catch (err) {
      alert('Error saving: ' + err.message);
    } finally {
      setLicSaving(false);
    }
  };

  const deleteLicense = async (lic) => {
    if (!window.confirm(`Delete "${lic.name}"? This will also remove all its assignments.`)) return;
    try {
      await softwareLicensesApi.delete(lic.id);
      fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ── Assignment CRUD ────────────────────────────────────────────────────────

  const openAssign = (lic) => {
    setAssignForLicense(lic);
    setEditAssignment(null);
    setAssignForm({ personnel_id: '', assigned_date: new Date().toISOString().split('T')[0], notes: '' });
    setShowAssignModal(true);
  };

  const openEditAssignment = (a) => {
    setAssignForLicense(enrichedLicenses.find(l => l.id === a.software_license_id) || null);
    setEditAssignment(a);
    setAssignForm({ personnel_id: a.personnel_id || '', assigned_date: a.assigned_date || '', notes: a.notes || '' });
    setShowAssignModal(true);
  };

  const saveAssignment = async () => {
    if (!assignForm.personnel_id && !assignForm.employee_name?.trim()) {
      alert('Please select an employee.'); return;
    }
    setAssignSaving(true);
    try {
      const person = personnel.find(p => p.id === parseInt(assignForm.personnel_id));
      const payload = {
        software_license_id: assignForLicense.id,
        personnel_id: person ? person.id : null,
        employee_name: person ? person.full_name : '',
        employee_id: person ? person.employee_id : '',
        assigned_date: assignForm.assigned_date || new Date().toISOString().split('T')[0],
        notes: assignForm.notes?.trim() || null,
        is_active: true,
      };
      if (editAssignment) {
        await softwareAssignmentsApi.update(editAssignment.id, payload);
      } else {
        await softwareAssignmentsApi.create(payload);
      }
      setShowAssignModal(false);
      fetchData();
    } catch (err) {
      alert('Error saving: ' + err.message);
    } finally {
      setAssignSaving(false);
    }
  };

  // ── Bulk Assign ────────────────────────────────────────────────────────────

  const openBulkAssign = (lic) => {
    setBulkForLicense(lic);
    // Pre-tick employees already assigned
    const alreadyAssigned = new Set(
      assignments
        .filter(a => a.software_license_id === lic.id && a.is_active && a.personnel_id)
        .map(a => a.personnel_id)
    );
    setBulkSelected(new Set(alreadyAssigned));
    setBulkSearch('');
    setShowBulkModal(true);
  };

  const saveBulkAssign = async () => {
    setBulkSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // Existing active assignments for this license
      const existing = assignments.filter(
        a => a.software_license_id === bulkForLicense.id && a.is_active
      );
      const existingByPersonnel = new Map(existing.map(a => [a.personnel_id, a]));

      // Revoke assignments for unselected employees who were previously assigned
      const toRevoke = existing.filter(a => a.personnel_id && !bulkSelected.has(a.personnel_id));
      for (const a of toRevoke) {
        await softwareAssignmentsApi.update(a.id, { is_active: false });
      }

      // Create assignments for newly selected employees
      for (const pid of bulkSelected) {
        if (existingByPersonnel.has(pid)) continue; // already assigned
        const person = personnel.find(p => p.id === pid);
        if (!person) continue;
        await softwareAssignmentsApi.create({
          software_license_id: bulkForLicense.id,
          personnel_id: person.id,
          employee_name: person.full_name,
          employee_id: person.employee_id || '',
          assigned_date: today,
          is_active: true,
        });
      }

      setShowBulkModal(false);
      fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBulkSaving(false);
    }
  };

  const revokeAssignment = async (a) => {
    if (!window.confirm(`Revoke ${a.software_name} for ${a.employee_name}?`)) return;
    try {
      await softwareAssignmentsApi.update(a.id, { is_active: false });
      fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="page-content">
      <div className="loading-state">
        <Icons.Refresh size={24} className="spin" />
        <span>Loading software licenses…</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="page-content">
      <div className="error-state">
        <Icons.AlertCircle size={20} />
        <span>{error}</span>
        <button className="btn btn-secondary" onClick={fetchData}>Retry</button>
      </div>
    </div>
  );

  return (
    <div className="page-content">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1>Software Licenses</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            Track software licenses, assignments and costs
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={fetchData}>
            <Icons.Refresh size={14} /> Refresh
          </button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openAddLicense}>
              <Icons.Plus size={14} /> Add Software
            </button>
          )}
        </div>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────────────── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard label="Software Products" value={stats.count} icon={<Icons.Grid size={18} />} color="var(--accent-color)" />
        <StatCard label="Active Assignments" value={stats.totalSeats} icon={<Icons.Users size={18} />} color="var(--success-color)" />
        <StatCard label="Monthly Cost" value={fmtCurrency(stats.totalMonthly)} icon={<Icons.TrendingUp size={18} />} color="#2980b9" small />
        <StatCard label="Annual Cost" value={fmtCurrency(stats.totalAnnual)} icon={<Icons.BarChart size={18} />} color="#8e44ad" small />
        {stats.expiringSoon > 0 && (
          <StatCard label="Renewals Due" value={stats.expiringSoon} icon={<Icons.Calendar size={18} />} color="var(--warning-color)" />
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="tabs-container" style={{ marginBottom: 16 }}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'catalog', label: 'Catalog' },
          { key: 'assignments', label: 'Assignments' },
        ].map(t => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB: Overview
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div>
          {/* Per-software summary cards */}
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>License Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 28 }}>
            {enrichedLicenses.filter(l => l.is_active).map(lic => (
              <LicenseSummaryCard
                key={lic.id}
                lic={lic}
                onAssign={() => openAssign(lic)}
                onBulkAssign={() => openBulkAssign(lic)}
                onEdit={() => openEditLicense(lic)}
                isAdmin={isAdmin}
              />
            ))}
            {enrichedLicenses.filter(l => l.is_active).length === 0 && (
              <p style={{ color: 'var(--text-secondary)', gridColumn: '1/-1' }}>
                No software products yet. Click "Add Software" to get started.
              </p>
            )}
          </div>

          {/* Division cost breakdown */}
          {divisionBreakdown.length > 0 && (
            <>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 12px' }}>Monthly Cost by Division</h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Division</th>
                      <th>Assigned Seats</th>
                      <th>Monthly Cost</th>
                      <th>Annual Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divisionBreakdown.map(row => (
                      <tr key={row.division}>
                        <td>{row.division}</td>
                        <td>{row.count}</td>
                        <td>{fmtCurrency(row.monthly)}</td>
                        <td>{fmtCurrency(row.monthly * 12)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 600, borderTop: '2px solid var(--border-color)' }}>
                      <td>Total</td>
                      <td>{divisionBreakdown.reduce((s, r) => s + r.count, 0)}</td>
                      <td>{fmtCurrency(divisionBreakdown.reduce((s, r) => s + r.monthly, 0))}</td>
                      <td>{fmtCurrency(divisionBreakdown.reduce((s, r) => s + r.monthly * 12, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: Catalog
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'catalog' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-box" style={{ flex: '1 1 220px', minWidth: 180 }}>
              <Icons.Search size={14} />
              <input
                placeholder="Search software or vendor…"
                value={catSearch}
                onChange={e => setCatSearch(e.target.value)}
              />
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
              {filteredCatalog.length} product{filteredCatalog.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Software</th>
                  <th>Vendor</th>
                  <th>Type</th>
                  <th>Cost / Seat</th>
                  <th>Cycle</th>
                  <th>Assigned</th>
                  <th>Monthly Cost</th>
                  <th>Annual Cost</th>
                  <th>Renewal Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCatalog.length === 0 && (
                  <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>No software products found.</td></tr>
                )}
                {filteredCatalog.map(lic => {
                  const renewal = getRenewalStatus(lic.renewal_date);
                  return (
                    <tr key={lic.id}>
                      <td style={{ fontWeight: 500 }}>{lic.name}</td>
                      <td>{lic.vendor || '-'}</td>
                      <td>{lic.license_type || '-'}</td>
                      <td>{lic.cost_per_seat != null ? fmtCurrency(lic.cost_per_seat) : '-'}</td>
                      <td>{lic.billing_cycle}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{lic.assigned_count}</span>
                        {lic.total_seats ? <span style={{ color: 'var(--text-secondary)' }}> / {lic.total_seats}</span> : ''}
                      </td>
                      <td>{fmtCurrency(monthlyCost(lic))}</td>
                      <td>{fmtCurrency(annualCost(lic))}</td>
                      <td>
                        {lic.renewal_date ? (
                          <span style={{ color: renewal === 'expired' ? 'var(--error-color)' : renewal === 'due-soon' ? 'var(--warning-color)' : 'inherit' }}>
                            {lic.renewal_date}
                            {renewal === 'expired' && ' (Expired)'}
                            {renewal === 'due-soon' && ' (Due Soon)'}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        <span className={`badge ${lic.is_active ? 'badge-available' : 'badge-checked-out'}`}>
                          {lic.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {isAdmin && lic.is_active && (
                          <>
                            <button className="btn btn-secondary btn-sm" onClick={() => openBulkAssign(lic)} title="Bulk Assign">
                              <Icons.Users size={13} /> Bulk Assign
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => openAssign(lic)} title="Assign one">
                              <Icons.Plus size={13} /> Assign
                            </button>
                          </>
                          )}
                          {isAdmin && (
                            <>
                              <button className="btn btn-secondary btn-sm icon-btn" onClick={() => openEditLicense(lic)} title="Edit">
                                <Icons.Edit size={13} />
                              </button>
                              <button className="btn btn-danger btn-sm icon-btn" onClick={() => deleteLicense(lic)} title="Delete">
                                <Icons.Trash size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredCatalog.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 600, borderTop: '2px solid var(--border-color)' }}>
                    <td colSpan={6}>Total (active, assigned seats)</td>
                    <td>{fmtCurrency(filteredCatalog.filter(l => l.is_active).reduce((s, l) => s + monthlyCost(l), 0))}</td>
                    <td>{fmtCurrency(filteredCatalog.filter(l => l.is_active).reduce((s, l) => s + annualCost(l), 0))}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: Assignments
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'assignments' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-box" style={{ flex: '1 1 220px', minWidth: 180 }}>
              <Icons.Search size={14} />
              <input
                placeholder="Search employee or software…"
                value={assignSearch}
                onChange={e => setAssignSearch(e.target.value)}
              />
            </div>
            <select className="filter-select" value={assignSoftwareFilter} onChange={e => setAssignSoftwareFilter(e.target.value)}>
              <option value="">All Software</option>
              {licenses.filter(l => l.is_active).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <select className="filter-select" value={assignDivisionFilter} onChange={e => setAssignDivisionFilter(e.target.value)}>
              <option value="">All Divisions</option>
              {divisions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
              {filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Division</th>
                  <th>Software</th>
                  <th>Vendor</th>
                  <th>Cost / Seat</th>
                  <th>Billing</th>
                  <th>Assigned Date</th>
                  <th>Notes</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>No assignments found.</td></tr>
                )}
                {filteredAssignments.map(a => {
                  const div = lookupDivision(divLookup, { employee_name: a.employee_name }, 'employee_name') || '-';
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 500 }}>{a.employee_name || '-'}</td>
                      <td>{a.employee_id || '-'}</td>
                      <td>{div}</td>
                      <td>{a.software_name || '-'}</td>
                      <td>{a.vendor || '-'}</td>
                      <td>{a.cost_per_seat != null ? fmtCurrency(a.cost_per_seat) : '-'}</td>
                      <td>{a.billing_cycle || '-'}</td>
                      <td>{a.assigned_date || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{a.notes || ''}</td>
                      {isAdmin && (
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm icon-btn" onClick={() => openEditAssignment(a)} title="Edit">
                              <Icons.Edit size={13} />
                            </button>
                            <button className="btn btn-danger btn-sm icon-btn" onClick={() => revokeAssignment(a)} title="Revoke">
                              <Icons.Trash size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Add / Edit License
         ══════════════════════════════════════════════════════════════════ */}
      {showLicenseModal && (
        <div className="modal-overlay" onClick={() => setShowLicenseModal(false)}>
          <div className="modal-content" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editLicense ? 'Edit Software License' : 'Add Software License'}</h2>
              <button className="modal-close" onClick={() => setShowLicenseModal(false)}>
                <Icons.Close size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ gap: 14 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label>Software Name *</label>
                  <input
                    className="form-control"
                    value={licenseForm.name || ''}
                    onChange={e => setLicenseForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Microsoft 365 Business"
                  />
                </div>
                <div className="form-group">
                  <label>Vendor</label>
                  <input
                    className="form-control"
                    value={licenseForm.vendor || ''}
                    onChange={e => setLicenseForm(f => ({ ...f, vendor: e.target.value }))}
                    placeholder="e.g. Microsoft"
                  />
                </div>
                <div className="form-group">
                  <label>License Type</label>
                  <select className="form-control" value={licenseForm.license_type || 'Per User'} onChange={e => setLicenseForm(f => ({ ...f, license_type: e.target.value }))}>
                    {LICENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Cost per Seat (ZAR)</label>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    step="0.01"
                    value={licenseForm.cost_per_seat ?? ''}
                    onChange={e => setLicenseForm(f => ({ ...f, cost_per_seat: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Billing Cycle</label>
                  <select className="form-control" value={licenseForm.billing_cycle || 'Monthly'} onChange={e => setLicenseForm(f => ({ ...f, billing_cycle: e.target.value }))}>
                    {BILLING_CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Total Seats Purchased</label>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    value={licenseForm.total_seats ?? ''}
                    onChange={e => setLicenseForm(f => ({ ...f, total_seats: e.target.value }))}
                    placeholder="Leave blank if unlimited"
                  />
                </div>
                <div className="form-group">
                  <label>Renewal Date</label>
                  <input
                    className="form-control"
                    type="date"
                    value={licenseForm.renewal_date || ''}
                    onChange={e => setLicenseForm(f => ({ ...f, renewal_date: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label>Notes</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={licenseForm.notes || ''}
                    onChange={e => setLicenseForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes"
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={licenseForm.is_active !== false}
                      onChange={e => setLicenseForm(f => ({ ...f, is_active: e.target.checked }))}
                    />
                    Active
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLicenseModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveLicense} disabled={licSaving}>
                {licSaving ? 'Saving…' : editLicense ? 'Update' : 'Add Software'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Bulk Assign
         ══════════════════════════════════════════════════════════════════ */}
      {showBulkModal && bulkForLicense && (() => {
        const alreadyRevoked = assignments
          .filter(a => a.software_license_id === bulkForLicense.id && a.is_active && a.personnel_id)
          .map(a => a.personnel_id);
        const filtered = personnel.filter(p =>
          !bulkSearch ||
          p.full_name?.toLowerCase().includes(bulkSearch.toLowerCase()) ||
          p.employee_id?.toLowerCase().includes(bulkSearch.toLowerCase())
        );
        const allFiltered = filtered.every(p => bulkSelected.has(p.id));
        return (
          <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
            <div className="modal-content" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Bulk Assign — {bulkForLicense.name}</h2>
                <button className="modal-close" onClick={() => setShowBulkModal(false)}>
                  <Icons.Close size={16} />
                </button>
              </div>
              <div className="modal-body" style={{ padding: '12px 20px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 10 }}>
                  Tick employees to assign. Unticking a currently assigned employee will revoke their licence.
                </p>
                {/* Search + select-all */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                  <div className="search-box" style={{ flex: 1 }}>
                    <Icons.Search size={13} />
                    <input
                      placeholder="Search employees…"
                      value={bulkSearch}
                      onChange={e => setBulkSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={allFiltered && filtered.length > 0}
                      onChange={e => {
                        setBulkSelected(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) filtered.forEach(p => next.add(p.id));
                          else filtered.forEach(p => next.delete(p.id));
                          return next;
                        });
                      }}
                    />
                    Select all
                  </label>
                </div>
                {/* Employee list */}
                <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                  {filtered.length === 0 && (
                    <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No employees found.</div>
                  )}
                  {filtered.map((p, i) => (
                    <label key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 14px',
                      background: i % 2 === 0 ? 'transparent' : 'var(--table-row-alt, rgba(0,0,0,0.02))',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                    }}>
                      <input
                        type="checkbox"
                        checked={bulkSelected.has(p.id)}
                        onChange={e => {
                          setBulkSelected(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(p.id);
                            else next.delete(p.id);
                            return next;
                          });
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{p.full_name}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                          {p.employee_id || ''}{p.division ? ` · ${p.division}` : ''}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {bulkSelected.size} employee{bulkSelected.size !== 1 ? 's' : ''} selected
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveBulkAssign} disabled={bulkSaving}>
                  {bulkSaving ? 'Saving…' : `Save Assignments`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Assign Software to Employee
         ══════════════════════════════════════════════════════════════════ */}
      {showAssignModal && assignForLicense && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editAssignment ? 'Edit Assignment' : `Assign ${assignForLicense.name}`}</h2>
              <button className="modal-close" onClick={() => setShowAssignModal(false)}>
                <Icons.Close size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ gap: 14 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label>Employee *</label>
                  <select
                    className="form-control"
                    value={assignForm.personnel_id || ''}
                    onChange={e => setAssignForm(f => ({ ...f, personnel_id: e.target.value }))}
                  >
                    <option value="">Select employee…</option>
                    {personnel.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.employee_id || 'no ID'})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Assigned Date</label>
                  <input
                    className="form-control"
                    type="date"
                    value={assignForm.assigned_date || ''}
                    onChange={e => setAssignForm(f => ({ ...f, assigned_date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <input
                    className="form-control"
                    value={assignForm.notes || ''}
                    onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveAssignment} disabled={assignSaving}>
                {assignSaving ? 'Saving…' : editAssignment ? 'Update' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, small }) {
  return (
    <div className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: small ? '1.2rem' : '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        </div>
        <div style={{ color, opacity: 0.8 }}>{icon}</div>
      </div>
    </div>
  );
}

function LicenseSummaryCard({ lic, onAssign, onBulkAssign, onEdit, isAdmin }) {
  const monthly = monthlyCost(lic);
  const annual = annualCost(lic);
  const renewal = getRenewalStatus(lic.renewal_date);

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: 8,
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>{lic.name}</div>
          {lic.vendor && <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{lic.vendor}</div>}
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-secondary btn-sm icon-btn" onClick={onEdit} title="Edit"><Icons.Edit size={12} /></button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.85rem' }}>
        <KV label="Assigned" value={`${lic.assigned_count}${lic.total_seats ? ` / ${lic.total_seats}` : ''} seats`} />
        <KV label="Cost/Seat" value={lic.cost_per_seat != null ? fmtCurrency(lic.cost_per_seat) : '-'} />
        <KV label="Monthly" value={fmtCurrency(monthly)} strong />
        <KV label="Annual" value={fmtCurrency(annual)} />
        {lic.renewal_date && (
          <KV label="Renewal" value={lic.renewal_date}
            valueStyle={{ color: renewal === 'expired' ? 'var(--error-color)' : renewal === 'due-soon' ? 'var(--warning-color)' : 'inherit' }}
          />
        )}
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={onBulkAssign}>
            <Icons.Users size={12} /> Bulk Assign
          </button>
          <button className="btn btn-secondary btn-sm icon-btn" onClick={onAssign} title="Assign single employee">
            <Icons.Plus size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function KV({ label, value, strong, valueStyle }) {
  return (
    <div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: 1 }}>{label}</div>
      <div style={{ fontWeight: strong ? 600 : 400, ...valueStyle }}>{value}</div>
    </div>
  );
}

export default SoftwareLicenses;
