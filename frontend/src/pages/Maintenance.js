import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { maintenanceApi, equipmentApi } from '../services/api';
import { Icons } from '../components/Icons';

function Maintenance() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [records, setRecords] = useState([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [summary, setSummary] = useState({
    by_status: [],
    overdue: 0,
    due_soon: 0,
    cost_this_month: 0,
    cost_this_year: 0
  });
  
  const [filters, setFilters] = useState({
    status: '',
    type_id: '',
    search: '',
    from_date: '',
    to_date: '',
  });
  
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'due'
  const [dueRecords, setDueRecords] = useState([]);
  
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    equipment_id: '',
    maintenance_type_id: '',
    maintenance_date: new Date().toISOString().split('T')[0],
    completed_date: '',
    description: '',
    performed_by: '',
    external_provider: '',
    cost: '',
    downtime_days: '',
    next_maintenance_date: '',
    status: 'scheduled',
    work_order_number: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const response = await maintenanceApi.getAll(filters);
      setRecords(Array.isArray(response?.data) ? response.data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchData = async () => {
    try {
      const [typesRes, equipmentRes, summaryRes, dueRes] = await Promise.all([
        maintenanceApi.getTypes(),
        equipmentApi.getAll(),
        maintenanceApi.getSummary(),
        maintenanceApi.getDue(30),
      ]);
      setMaintenanceTypes(Array.isArray(typesRes?.data) ? typesRes.data : []);
      setEquipment(Array.isArray(equipmentRes?.data) ? equipmentRes.data : []);
      setSummary(summaryRes?.data || null);
      setDueRecords(Array.isArray(dueRes?.data) ? dueRes.data : []);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'all') {
      fetchRecords();
    }
  }, [fetchRecords, activeTab]);

  const handleOpenModal = (record = null) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        equipment_id: record.equipment_id,
        maintenance_type_id: record.maintenance_type_id,
        maintenance_date: record.maintenance_date?.split('T')[0] || '',
        completed_date: record.completed_date?.split('T')[0] || '',
        description: record.description || '',
        performed_by: record.performed_by || '',
        external_provider: record.external_provider || '',
        cost: record.cost || '',
        downtime_days: record.downtime_days || '',
        next_maintenance_date: record.next_maintenance_date?.split('T')[0] || '',
        status: record.status,
        work_order_number: record.work_order_number || '',
        notes: record.notes || '',
      });
    } else {
      setEditingRecord(null);
      setFormData({
        equipment_id: '',
        maintenance_type_id: '',
        maintenance_date: new Date().toISOString().split('T')[0],
        completed_date: '',
        description: '',
        performed_by: '',
        external_provider: '',
        cost: '',
        downtime_days: '',
        next_maintenance_date: '',
        status: 'scheduled',
        work_order_number: '',
        notes: '',
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const data = {
        ...formData,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        downtime_days: formData.downtime_days ? parseInt(formData.downtime_days) : 0,
      };
      
      if (editingRecord) {
        await maintenanceApi.update(editingRecord.id, data);
      } else {
        await maintenanceApi.create(data);
      }
      setShowModal(false);
      fetchRecords();
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (id) => {
    try {
      await maintenanceApi.complete(id, { completed_date: new Date().toISOString().split('T')[0] });
      fetchRecords();
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this maintenance record?')) return;
    
    try {
      await maintenanceApi.delete(id);
      fetchRecords();
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      scheduled: 'badge-consumable',
      in_progress: 'badge-checked-out',
      completed: 'badge-available',
      cancelled: 'badge',
    };
    return badges[status] || 'badge';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  if (loading && records.length === 0) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading maintenance records...
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Equipment Maintenance</h1>
          <p className="subtitle">Track repairs, servicing, and maintenance history</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          + Add Maintenance Record
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
          <button className="btn btn-sm" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card stat-danger">
          <div className="stat-value">{summary.overdue}</div>
          <div className="stat-label">Overdue</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-value">{summary.due_soon}</div>
          <div className="stat-label">Due Soon (30 days)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatCurrency(summary.cost_this_month)}</div>
          <div className="stat-label">Cost This Month</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatCurrency(summary.cost_this_year)}</div>
          <div className="stat-label">Cost This Year</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Records
        </button>
        <button
          className={`tab ${activeTab === 'due' ? 'active' : ''}`}
          onClick={() => setActiveTab('due')}
        >
          Due/Overdue ({dueRecords.length})
        </button>
      </div>

      {activeTab === 'all' && (
        <>
          {/* Filters */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
                <label className="form-label">Search</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Equipment, description, work order..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
                <label className="form-label">Status</label>
                <select 
                  className="form-input"
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="">All</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
                <label className="form-label">Type</label>
                <select 
                  className="form-input"
                  value={filters.type_id}
                  onChange={(e) => setFilters(prev => ({ ...prev, type_id: e.target.value }))}
                >
                  <option value="">All Types</option>
                  {maintenanceTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>
              <button 
                className="btn btn-secondary"
                onClick={() => setFilters({ status: '', type_id: '', search: '', from_date: '', to_date: '' })}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Records Table */}
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                      No maintenance records found
                    </td>
                  </tr>
                ) : (
                  records.map(record => (
                    <tr key={record.id}>
                      <td>
                        <Link to={`/equipment/${record.equipment_id}`} style={{ fontWeight: 500 }}>
                          {record.equipment_code}
                        </Link>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {record.equipment_name}
                        </div>
                      </td>
                      <td>{record.maintenance_type}</td>
                      <td>
                        <div>{formatDate(record.maintenance_date)}</div>
                        {record.completed_date && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                            Completed: {formatDate(record.completed_date)}
                          </div>
                        )}
                      </td>
                      <td style={{ maxWidth: '250px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {record.description}
                        </div>
                        {record.performed_by && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            By: {record.performed_by}
                          </div>
                        )}
                      </td>
                      <td>{formatCurrency(record.cost)}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(record.status)}`}>
                          {record.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {record.status !== 'completed' && record.status !== 'cancelled' && (
                            <button 
                              className="btn btn-sm btn-success"
                              onClick={() => handleComplete(record.id)}
                              title="Mark Complete"
                            >
                              <Icons.Check size={14} />
                            </button>
                          )}
                          <button 
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleOpenModal(record)}
                            title="Edit"
                          >
                            <Icons.Edit size={14} />
                          </button>
                          <button 
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(record.id)}
                            title="Delete"
                          >
                            <Icons.Trash size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'due' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Maintenance Due</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Category</th>
                <th>Next Maintenance</th>
                <th>Status</th>
                <th>Days</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {dueRecords.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                    No equipment due for maintenance
                  </td>
                </tr>
              ) : (
                dueRecords.map(item => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/equipment/${item.id}`} style={{ fontWeight: 500 }}>
                        {item.equipment_id}
                      </Link>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {item.equipment_name}
                      </div>
                    </td>
                    <td>{item.category}</td>
                    <td>{formatDate(item.next_maintenance_date)}</td>
                    <td>
                      <span className={`badge ${item.maintenance_status === 'overdue' ? 'badge-danger' : 'badge-consumable'}`}>
                        {item.maintenance_status}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: item.days_until_due < 0 ? 'var(--danger)' : 'inherit' }}>
                        {item.days_until_due < 0 ? `${Math.abs(item.days_until_due)} overdue` : item.days_until_due}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, equipment_id: item.id }));
                          handleOpenModal();
                        }}
                      >
                        Schedule
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingRecord ? 'Edit Maintenance Record' : 'Add Maintenance Record'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Equipment *</label>
                    <select
                      className="form-input"
                      value={formData.equipment_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, equipment_id: e.target.value }))}
                      required
                    >
                      <option value="">Select equipment...</option>
                      {equipment.map(eq => (
                        <option key={eq.id} value={eq.id}>
                          {eq.equipment_id} - {eq.equipment_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Maintenance Type *</label>
                    <select
                      className="form-input"
                      value={formData.maintenance_type_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, maintenance_type_id: e.target.value }))}
                      required
                    >
                      <option value="">Select type...</option>
                      {maintenanceTypes.map(type => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Maintenance Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.maintenance_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, maintenance_date: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-input"
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    required
                    placeholder="Describe the maintenance work..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Performed By</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.performed_by}
                      onChange={(e) => setFormData(prev => ({ ...prev, performed_by: e.target.value }))}
                      placeholder="Internal technician name"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">External Provider</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.external_provider}
                      onChange={(e) => setFormData(prev => ({ ...prev, external_provider: e.target.value }))}
                      placeholder="External service company"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cost (ZAR)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={formData.cost}
                      onChange={(e) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Downtime (Days)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.downtime_days}
                      onChange={(e) => setFormData(prev => ({ ...prev, downtime_days: e.target.value }))}
                      placeholder="0"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Completed Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.completed_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, completed_date: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Next Maintenance Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.next_maintenance_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, next_maintenance_date: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Work Order Number</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.work_order_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, work_order_number: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : (editingRecord ? 'Update' : 'Add Record')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Maintenance;
