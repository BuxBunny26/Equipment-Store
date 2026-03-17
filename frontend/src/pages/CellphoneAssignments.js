import React, { useState, useEffect } from 'react';
import { cellphoneAssignmentsApi, personnelApi } from '../services/api';
import { useOperator } from '../context/OperatorContext';
import { Icons } from '../components/Icons';
import { getAssetConfig } from './Settings';

function CellphoneAssignments() {
  const { operatorRole } = useOperator();
  const isAdminOrManager = operatorRole && ['admin', 'manager'].includes(operatorRole.toLowerCase());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [showReturned, setShowReturned] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const PHONE_STATUSES = [
    { value: 'Active', label: 'Active', badge: 'badge-available', color: 'var(--success-color)' },
    { value: 'Returned', label: 'Returned', badge: 'badge-checked-out', color: 'var(--text-secondary)' },
    { value: 'Stolen', label: 'Stolen', badge: 'badge-overdue', color: 'var(--error-color)' },
    { value: 'Damaged', label: 'Damaged', badge: 'badge-overdue', color: '#e67e22' },
    { value: 'Repairs', label: 'Sent for Repairs', badge: 'badge-low-stock', color: '#f39c12' },
    { value: 'Lost', label: 'Lost', badge: 'badge-overdue', color: 'var(--error-color)' },
    { value: 'Decommissioned', label: 'Decommissioned', badge: 'badge-checked-out', color: 'var(--text-secondary)' },
  ];

  useEffect(() => {
    fetchData();
  }, [showReturned]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assignmentsRes, personnelRes] = await Promise.all([
        cellphoneAssignmentsApi.getAll(!showReturned),
        personnelApi.getAll(true),
      ]);
      setAssignments(assignmentsRes.data || []);
      setPersonnel(personnelRes.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditItem(null);
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setShowModal(true);
  };



  const handleDelete = async (item) => {
    if (!window.confirm(`Delete this cellphone assignment record for ${item.employee_name}?`)) return;
    try {
      await cellphoneAssignmentsApi.delete(item.id);
      fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Build a lookup of employee_name -> division from personnel
  const personnelDivisionMap = {}; // eslint-disable-line
  personnel.forEach(p => { personnelDivisionMap[p.full_name?.toLowerCase()] = p.division || ''; });

  // Get unique divisions and brands for filter dropdowns
  const divisions = [...new Set(personnel.map(p => p.division).filter(Boolean))].sort();
  const brands = [...new Set(assignments.map(a => a.phone_brand).filter(Boolean))].sort();

  const filtered = assignments.filter(a => {
    if (statusFilter && a.phone_status !== statusFilter) return false;
    if (brandFilter && a.phone_brand !== brandFilter) return false;
    if (divisionFilter) {
      const empDiv = personnelDivisionMap[a.employee_name?.toLowerCase()] || '';
      if (empDiv !== divisionFilter) return false;
    }
    if (dateFrom && a.date_assigned < dateFrom) return false;
    if (dateTo && a.date_assigned > dateTo) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.employee_name?.toLowerCase().includes(term) ||
      a.phone_brand?.toLowerCase().includes(term) ||
      a.phone_model?.toLowerCase().includes(term) ||
      a.serial_number?.toLowerCase().includes(term) ||
      a.imei_number?.toLowerCase().includes(term) ||
      a.phone_number?.toLowerCase().includes(term) ||
      a.asset_tag?.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading cellphone assignments...
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cellphone Assignments</h1>
          <p className="page-subtitle">Track company cellphones assigned to employees</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isAdminOrManager && (
            <button className="btn btn-primary" onClick={handleAdd}>
              + Assign Cellphone
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button className="btn btn-sm btn-secondary" onClick={fetchData} style={{ marginLeft: 'auto' }}>
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name, brand, model, serial, IMEI, number..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <select
            className="form-input"
            value={divisionFilter}
            onChange={e => setDivisionFilter(e.target.value)}
            style={{ minWidth: '140px' }}
          >
            <option value="">All Divisions</option>
            {divisions.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            className="form-input"
            value={brandFilter}
            onChange={e => setBrandFilter(e.target.value)}
            style={{ minWidth: '140px' }}
          >
            <option value="">All Brands</option>
            {brands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            className="form-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ minWidth: '140px' }}
          >
            <option value="">All Statuses</option>
            {PHONE_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={showReturned}
              onChange={e => setShowReturned(e.target.checked)}
            />
            Show inactive
          </label>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Assigned From:</label>
            <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '150px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>To:</label>
            <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '150px' }} />
          </div>
          {(divisionFilter || brandFilter || dateFrom || dateTo) && (
            <button className="btn btn-sm" style={{ fontSize: '0.8rem' }} onClick={() => { setDivisionFilter(''); setBrandFilter(''); setDateFrom(''); setDateTo(''); }}>Clear Filters</button>
          )}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--success-color)' }}>
            {assignments.filter(a => a.phone_status === 'Active').length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Active</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f39c12' }}>
            {assignments.filter(a => a.phone_status === 'Repairs').length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>In Repairs</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#e67e22' }}>
            {assignments.filter(a => a.phone_status === 'Damaged').length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Damaged</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--error-color)' }}>
            {assignments.filter(a => ['Stolen', 'Lost'].includes(a.phone_status)).length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Stolen / Lost</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {assignments.filter(a => ['Returned', 'Decommissioned'].includes(a.phone_status)).length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Returned / Decom.</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary-color)' }}>
            {assignments.length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total</div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No cellphone assignments found</h3>
            <p>{searchTerm ? 'Try a different search term' : 'Click "Assign Cellphone" to add the first record'}</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Phone</th>
                  <th>Serial / IMEI</th>
                  <th>Phone Number</th>
                  <th>Date Assigned</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div>
                        <strong>{item.employee_name}</strong>
                        {item.employee_id && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {item.employee_id}
                          </div>
                        )}
                        {item.employee_email && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            {item.employee_email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>{item.phone_brand}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {item.phone_model}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{item.serial_number}</span>
                        {item.imei_number && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            IMEI: {item.imei_number}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{item.phone_number || '-'}</td>
                    <td>{item.date_assigned ? new Date(item.date_assigned).toLocaleDateString() : '-'}</td>
                    <td>
                      {(() => {
                        const st = PHONE_STATUSES.find(s => s.value === item.phone_status) || PHONE_STATUSES[0];
                        return <span className={`badge ${st.badge}`}>{st.label}</span>;
                      })()}
                      {item.phone_status === 'Returned' && item.date_returned && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          {new Date(item.date_returned).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => setHistoryItem(item)} title="View History">
                          <Icons.Clock size={14} />
                        </button>
                        {isAdminOrManager && (
                          <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(item)} title="Edit">
                            <Icons.Edit size={14} />
                          </button>
                        )}
                        {isAdminOrManager && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item)} title="Delete">
                            <Icons.Trash size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <CellphoneModal
          item={editItem}
          personnel={personnel}
          allAssignments={assignments}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          onSuccess={() => { setShowModal(false); setEditItem(null); fetchData(); }}
        />
      )}

      {/* History Modal */}
      {historyItem && (
        <HistoryModal
          item={historyItem}
          onClose={() => setHistoryItem(null)}
        />
      )}
    </div>
  );
}

function CellphoneModal({ item, personnel, allAssignments, onClose, onSuccess }) {
  const [form, setForm] = useState({
    employee_name: item?.employee_name || '',
    employee_id: item?.employee_id || '',
    employee_email: item?.employee_email || '',
    phone_brand: item?.phone_brand || '',
    phone_model: item?.phone_model || '',
    serial_number: item?.serial_number || '',
    imei_number: item?.imei_number || '',
    phone_number: item?.phone_number || '',
    asset_tag: item?.asset_tag || '',
    date_assigned: item?.date_assigned || new Date().toISOString().split('T')[0],
    date_returned: item?.date_returned || '',
    phone_status: item?.phone_status || 'Active',
    is_active: item?.is_active ?? true,
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [serialMatch, setSerialMatch] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSerialChange = (e) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, serial_number: val }));

    if (!item && val.length >= 3) {
      const normalised = val.replace(/[\s\-]/g, '').toLowerCase();
      const match = allAssignments.find(a => {
        const existingNorm = (a.serial_number || '').replace(/[\s\-]/g, '').toLowerCase();
        return existingNorm === normalised || existingNorm.includes(normalised) || normalised.includes(existingNorm);
      });
      setSerialMatch(match || null);
    } else {
      setSerialMatch(null);
    }
  };

  const handlePersonnelSelect = (e) => {
    const personId = e.target.value;
    const person = personnel.find(p => String(p.id) === personId);
    if (person) {
      setForm(prev => ({
        ...prev,
        employee_name: person.full_name,
        employee_id: person.employee_id || '',
        employee_email: person.email || '',
      }));
    } else {
      setForm(prev => ({ ...prev, employee_name: '', employee_id: '', employee_email: '' }));
    }
  };

  const handleReassign = async () => {
    if (!serialMatch) return;
    if (!form.employee_name) {
      alert('Please select an employee first');
      return;
    }
    if (!window.confirm(
      `This phone (${serialMatch.phone_brand} ${serialMatch.phone_model}, S/N: ${serialMatch.serial_number}) is currently assigned to ${serialMatch.employee_name}.\n\nReassign it to ${form.employee_name}?`
    )) return;

    try {
      setSaving(true);
      await cellphoneAssignmentsApi.reassign(serialMatch.id, {
        employee_name: form.employee_name,
        employee_id: form.employee_id,
        employee_email: form.employee_email,
        date_assigned: form.date_assigned,
        notes: form.notes || null,
      });
      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee_name || !form.phone_brand || !form.phone_model || !form.serial_number || !form.date_assigned) {
      alert('Please fill in all required fields');
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form };
      if (!payload.date_returned) delete payload.date_returned;
      if (!payload.asset_tag) payload.asset_tag = null;
      if (!payload.employee_email) payload.employee_email = null;
      if (!payload.imei_number) payload.imei_number = null;
      if (!payload.phone_number) payload.phone_number = null;
      if (!payload.notes) payload.notes = null;

      if (item) {
        await cellphoneAssignmentsApi.update(item.id, payload);
      } else {
        await cellphoneAssignmentsApi.create(payload);
      }
      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>{item ? 'Edit Cellphone Assignment' : 'Assign Cellphone'}</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            <Icons.Close size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="form-group">
              <label className="form-label">Employee *</label>
              <select
                name="employee_name"
                value={personnel.find(p => p.full_name === form.employee_name)?.id || ''}
                onChange={handlePersonnelSelect}
                className="form-input"
                required
              >
                <option value="">-- Select Employee --</option>
                {personnel.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}{p.employee_id ? ` (${p.employee_id})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Employee ID</label>
                <input
                  type="text"
                  name="employee_id"
                  value={form.employee_id}
                  className="form-input"
                  readOnly
                  style={{ backgroundColor: 'var(--bg-secondary, #f5f5f5)' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  name="employee_email"
                  value={form.employee_email}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Auto-filled from employee"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Serial Number *</label>
                <input
                  type="text"
                  name="serial_number"
                  value={form.serial_number}
                  onChange={handleSerialChange}
                  className="form-input"
                  placeholder="e.g. R58T12ABC"
                  required
                  readOnly={!!item}
                  style={item ? { backgroundColor: 'var(--bg-secondary, #f5f5f5)' } : {}}
                />
              </div>
              <div className="form-group">
                <label className="form-label">IMEI Number</label>
                <input
                  type="text"
                  name="imei_number"
                  value={form.imei_number}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="15-digit IMEI"
                  maxLength={15}
                />
              </div>
            </div>

            {/* Serial number match warning */}
            {serialMatch && !item && (
              <div style={{
                padding: '12px',
                border: '2px solid #f39c12',
                borderRadius: '8px',
                background: 'rgba(243, 156, 18, 0.1)',
              }}>
                <div style={{ fontWeight: 600, marginBottom: '6px', color: '#f39c12' }}>
                  Existing phone found!
                </div>
                <div style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                  <strong>{serialMatch.phone_brand} {serialMatch.phone_model}</strong> (S/N: {serialMatch.serial_number})
                  <br />
                  Currently assigned to: <strong>{serialMatch.employee_name}</strong>
                  {serialMatch.phone_status && <> — Status: <strong>{serialMatch.phone_status}</strong></>}
                </div>
                {form.employee_name && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={handleReassign}
                    disabled={saving}
                  >
                    {saving ? 'Reassigning...' : `Reassign to ${form.employee_name}`}
                  </button>
                )}
                {!form.employee_name && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Select an employee above to reassign this phone
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Phone Brand *</label>
                <select
                  name="phone_brand"
                  value={form.phone_brand}
                  onChange={handleChange}
                  className="form-input"
                  required={!serialMatch}
                >
                  <option value="">-- Select Brand --</option>
                  {getAssetConfig().phoneBrands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phone Model *</label>
                <input
                  type="text"
                  name="phone_model"
                  value={form.phone_model}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. Galaxy S24 Ultra"
                  required={!serialMatch}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. +27 82 123 4567"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Asset Tag</label>
                <input
                  type="text"
                  name="asset_tag"
                  value={form.asset_tag}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Date Assigned *</label>
                <input
                  type="date"
                  name="date_assigned"
                  value={form.date_assigned}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date Returned</label>
                <input
                  type="date"
                  name="date_returned"
                  value={form.date_returned}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Phone Status</label>
              <select
                name="phone_status"
                value={form.phone_status}
                onChange={(e) => {
                  const val = e.target.value;
                  const inactiveStatuses = ['Returned', 'Stolen', 'Lost', 'Decommissioned'];
                  setForm(prev => ({
                    ...prev,
                    phone_status: val,
                    is_active: !inactiveStatuses.includes(val),
                    ...(val === 'Returned' && !prev.date_returned ? { date_returned: new Date().toISOString().split('T')[0] } : {}),
                  }));
                }}
                className="form-input"
              >
                {[
                  { value: 'Active', label: 'Active' },
                  { value: 'Returned', label: 'Returned' },
                  { value: 'Stolen', label: 'Stolen' },
                  { value: 'Damaged', label: 'Damaged' },
                  { value: 'Repairs', label: 'Sent for Repairs' },
                  { value: 'Lost', label: 'Lost' },
                  { value: 'Decommissioned', label: 'Decommissioned' },
                ].map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                className="form-input"
                rows="2"
                placeholder="Any additional notes"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            {!serialMatch && (
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : (item ? 'Update' : 'Assign Cellphone')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function HistoryModal({ item, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cellphoneAssignmentsApi.getHistory(item.id)
      .then(res => setHistory(res.data || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [item.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>Cellphone History</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            <Icons.Close size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px' }}>
            <strong>{item.phone_brand} {item.phone_model}</strong>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              S/N: {item.serial_number} {item.imei_number ? `| IMEI: ${item.imei_number}` : ''}
            </div>
            <div style={{ fontSize: '0.85rem' }}>
              Currently: <strong>{item.employee_name}</strong> — {item.phone_status || 'Active'}
            </div>
          </div>

          {loading ? (
            <div className="loading"><div className="spinner"></div> Loading history...</div>
          ) : history.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px' }}>
              <p>No history records yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.map(h => (
                <div key={h.id} style={{
                  padding: '10px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{h.action}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {new Date(h.performed_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {h.employee_name}{h.employee_id ? ` (${h.employee_id})` : ''}
                  </div>
                  {h.notes && <div style={{ marginTop: '4px', fontStyle: 'italic' }}>{h.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default CellphoneAssignments;
