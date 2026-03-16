import React, { useState, useEffect } from 'react';
import { laptopAssignmentsApi, personnelApi } from '../services/api';
import { Icons } from '../components/Icons';

function LaptopAssignments() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showReturned, setShowReturned] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const LAPTOP_STATUSES = [
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
        laptopAssignmentsApi.getAll(!showReturned),
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

  const handleReturn = async (item) => {
    // No longer used — status changes go through the modal or status dropdown
  };

  const handleStatusChange = async (item, newStatus) => {
    const statusLabel = LAPTOP_STATUSES.find(s => s.value === newStatus)?.label || newStatus;
    if (!window.confirm(`Change status of "${item.laptop_brand} ${item.laptop_model}" to ${statusLabel}?`)) return;
    try {
      await laptopAssignmentsApi.updateStatus(item.id, newStatus);
      fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete this laptop assignment record for ${item.employee_name}?`)) return;
    try {
      await laptopAssignmentsApi.delete(item.id);
      fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const filtered = assignments.filter(a => {
    if (statusFilter && a.laptop_status !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.employee_name?.toLowerCase().includes(term) ||
      a.laptop_brand?.toLowerCase().includes(term) ||
      a.laptop_model?.toLowerCase().includes(term) ||
      a.serial_number?.toLowerCase().includes(term) ||
      a.asset_tag?.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading laptop assignments...
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Laptop Assignments</h1>
          <p className="page-subtitle">Track company laptops assigned to employees</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={handleAdd}>
            + Assign Laptop
          </button>
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
            placeholder="Search by name, brand, model, serial..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={showReturned}
              onChange={e => setShowReturned(e.target.checked)}
            />
            Show inactive laptops
          </label>
          <select
            className="form-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ minWidth: '150px' }}
          >
            <option value="">All Statuses</option>
            {LAPTOP_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--success-color)' }}>
            {assignments.filter(a => a.laptop_status === 'Active').length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Active</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f39c12' }}>
            {assignments.filter(a => a.laptop_status === 'Repairs').length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>In Repairs</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#e67e22' }}>
            {assignments.filter(a => a.laptop_status === 'Damaged').length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Damaged</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--error-color)' }}>
            {assignments.filter(a => ['Stolen', 'Lost'].includes(a.laptop_status)).length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Stolen / Lost</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {assignments.filter(a => ['Returned', 'Decommissioned'].includes(a.laptop_status)).length}
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
            <h3>No laptop assignments found</h3>
            <p>{searchTerm ? 'Try a different search term' : 'Click "Assign Laptop" to add the first record'}</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Laptop</th>
                  <th>Serial Number</th>
                  <th>Asset Tag</th>
                  <th>Date Assigned</th>
                  <th>Setup</th>
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
                        <strong>{item.laptop_brand}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {item.laptop_model}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{item.serial_number}</td>
                    <td>{item.asset_tag || '-'}</td>
                    <td>{item.date_assigned ? new Date(item.date_assigned).toLocaleDateString() : '-'}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {[
                          { key: 'setup_laptop', label: 'Laptop' },
                          { key: 'setup_m365', label: 'M365' },
                          { key: 'setup_adobe', label: 'Adobe' },
                          { key: 'setup_zoho', label: 'Zoho' },
                          { key: 'setup_smartsheet', label: 'Smart' },
                          { key: 'setup_distribution_lists', label: 'DLists' },
                        ].map(chk => (
                          <span
                            key={chk.key}
                            title={chk.label}
                            style={{
                              display: 'inline-block',
                              padding: '1px 5px',
                              fontSize: '0.65rem',
                              borderRadius: '4px',
                              background: item[chk.key] ? 'var(--success-color)' : 'var(--border-color)',
                              color: item[chk.key] ? '#fff' : 'var(--text-secondary)',
                            }}
                          >
                            {chk.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {(() => {
                        const st = LAPTOP_STATUSES.find(s => s.value === item.laptop_status) || LAPTOP_STATUSES[0];
                        return <span className={`badge ${st.badge}`}>{st.label}</span>;
                      })()}
                      {item.laptop_status === 'Returned' && item.date_returned && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          {new Date(item.date_returned).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(item)} title="Edit">
                          <Icons.Edit size={14} />
                        </button>
                        <select
                          className="form-input"
                          value={item.laptop_status || 'Active'}
                          onChange={e => handleStatusChange(item, e.target.value)}
                          style={{ padding: '4px 6px', fontSize: '0.75rem', minWidth: '100px' }}
                          title="Change status"
                        >
                          {LAPTOP_STATUSES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item)} title="Delete">
                          <Icons.Trash size={14} />
                        </button>
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
        <LaptopModal
          item={editItem}
          personnel={personnel}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          onSuccess={() => { setShowModal(false); setEditItem(null); fetchData(); }}
        />
      )}
    </div>
  );
}

function LaptopModal({ item, personnel, onClose, onSuccess }) {
  const [form, setForm] = useState({
    employee_name: item?.employee_name || '',
    employee_id: item?.employee_id || '',
    employee_email: item?.employee_email || '',
    laptop_brand: item?.laptop_brand || '',
    laptop_model: item?.laptop_model || '',
    serial_number: item?.serial_number || '',
    asset_tag: item?.asset_tag || '',
    date_assigned: item?.date_assigned || new Date().toISOString().split('T')[0],
    date_returned: item?.date_returned || '',
    setup_laptop: item?.setup_laptop ?? false,
    setup_m365: item?.setup_m365 ?? false,
    setup_adobe: item?.setup_adobe ?? false,
    setup_zoho: item?.setup_zoho ?? false,
    setup_smartsheet: item?.setup_smartsheet ?? false,
    setup_distribution_lists: item?.setup_distribution_lists ?? false,
    laptop_status: item?.laptop_status || 'Active',
    is_active: item?.is_active ?? true,
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee_name || !form.laptop_brand || !form.laptop_model || !form.serial_number || !form.date_assigned) {
      alert('Please fill in all required fields');
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form };
      if (!payload.date_returned) delete payload.date_returned;
      if (!payload.asset_tag) payload.asset_tag = null;
      if (!payload.employee_email) payload.employee_email = null;
      if (!payload.notes) payload.notes = null;

      if (item) {
        await laptopAssignmentsApi.update(item.id, payload);
      } else {
        await laptopAssignmentsApi.create(payload);
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
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
        <div className="modal-header">
          <h2>{item ? 'Edit Laptop Assignment' : 'Assign Laptop'}</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            <Icons.Close size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                <label className="form-label">Laptop Brand *</label>
                <select
                  name="laptop_brand"
                  value={form.laptop_brand}
                  onChange={handleChange}
                  className="form-input"
                  required
                >
                  <option value="">-- Select Brand --</option>
                  {['Acer', 'Apple', 'Asus', 'Dell', 'HP', 'Huawei', 'Lenovo', 'LG', 'Microsoft', 'MSI', 'Samsung', 'Toshiba', 'Other'].map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Laptop Model *</label>
                <input
                  type="text"
                  name="laptop_model"
                  value={form.laptop_model}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. A15 TUF Gaming"
                  required
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
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. 12345"
                  required
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

            {/* Setup Checklist */}
            <div className="form-group">
              <label className="form-label">Setup Checklist</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-secondary, #f9f9f9)' }}>
                {[
                  { name: 'setup_laptop', label: 'Laptop set up' },
                  { name: 'setup_m365', label: 'Microsoft 365 Business licence' },
                  { name: 'setup_adobe', label: 'Adobe licence' },
                  { name: 'setup_zoho', label: 'Zoho account' },
                  { name: 'setup_smartsheet', label: 'Smartsheet access' },
                  { name: 'setup_distribution_lists', label: 'Distribution lists (Microsoft)' },
                ].map(chk => (
                  <label key={chk.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input
                      type="checkbox"
                      name={chk.name}
                      checked={form[chk.name]}
                      onChange={handleChange}
                    />
                    {chk.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Laptop Status</label>
              <select
                name="laptop_status"
                value={form.laptop_status}
                onChange={(e) => {
                  const val = e.target.value;
                  const inactiveStatuses = ['Returned', 'Stolen', 'Lost', 'Decommissioned'];
                  setForm(prev => ({
                    ...prev,
                    laptop_status: val,
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
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (item ? 'Update' : 'Assign Laptop')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LaptopAssignments;
