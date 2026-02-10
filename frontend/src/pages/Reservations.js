import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { reservationsApi, equipmentApi, personnelApi, customersApi } from '../services/api';
import { Icons } from '../components/Icons';

function Reservations() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState({ by_status: [], upcoming_week: 0 });
  
  const [filters, setFilters] = useState({
    status: '',
    equipment_id: '',
    start_date: '',
    end_date: '',
  });
  
  const [showModal, setShowModal] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [formData, setFormData] = useState({
    equipment_id: '',
    personnel_id: '',
    customer_id: '',
    start_date: '',
    end_date: '',
    purpose: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [availability, setAvailability] = useState(null);

  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.equipment_id) params.equipment_id = filters.equipment_id;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      
      const response = await reservationsApi.getAll(params);
      setReservations(Array.isArray(response?.data) ? response.data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchData = async () => {
    try {
      const [equipmentRes, personnelRes, customersRes, summaryRes] = await Promise.all([
        equipmentApi.getAll(), // Get ALL equipment to show status
        personnelApi.getAll(true),
        customersApi.getAll(),
        reservationsApi.getSummary(),
      ]);
      setEquipment(Array.isArray(equipmentRes?.data) ? equipmentRes.data : []);
      setPersonnel(Array.isArray(personnelRes?.data) ? personnelRes.data : []);
      setCustomers(Array.isArray(customersRes?.data) ? customersRes.data : []);
      setSummary(summaryRes?.data || { pending: 0, approved: 0, total: 0 });
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const checkAvailability = async () => {
    if (formData.equipment_id && formData.start_date && formData.end_date) {
      try {
        const response = await reservationsApi.checkAvailability(
          formData.equipment_id,
          formData.start_date,
          formData.end_date,
          editingReservation?.id
        );
        setAvailability(response.data);
      } catch (err) {
        console.error('Error checking availability:', err);
      }
    }
  };

  useEffect(() => {
    checkAvailability();
  }, [formData.equipment_id, formData.start_date, formData.end_date]);

  const handleOpenModal = (reservation = null) => {
    if (reservation) {
      setEditingReservation(reservation);
      setFormData({
        equipment_id: reservation.equipment_id,
        personnel_id: reservation.personnel_id,
        customer_id: reservation.customer_id || '',
        start_date: reservation.start_date?.split('T')[0] || '',
        end_date: reservation.end_date?.split('T')[0] || '',
        purpose: reservation.purpose || '',
        notes: reservation.notes || '',
      });
    } else {
      setEditingReservation(null);
      setFormData({
        equipment_id: '',
        personnel_id: '',
        customer_id: '',
        start_date: '',
        end_date: '',
        purpose: '',
        notes: '',
      });
    }
    setAvailability(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      if (editingReservation) {
        await reservationsApi.update(editingReservation.id, formData);
      } else {
        await reservationsApi.create(formData);
      }
      setShowModal(false);
      fetchReservations();
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await reservationsApi.updateStatus(id, newStatus);
      fetchReservations();
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this reservation?')) return;
    
    try {
      await reservationsApi.delete(id);
      fetchReservations();
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'badge-consumable',
      approved: 'badge-available',
      active: 'badge-checked-out',
      completed: 'badge',
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

  if (loading && reservations.length === 0) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading reservations...
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Equipment Reservations</h1>
          <p className="subtitle">Reserve equipment in advance for planned jobs</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          + New Reservation
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
        <div className="stat-card">
          <div className="stat-value">{summary.upcoming_week}</div>
          <div className="stat-label">Upcoming (7 days)</div>
        </div>
        {summary.by_status.map(item => (
          <div className="stat-card" key={item.status}>
            <div className="stat-value">{item.count}</div>
            <div className="stat-label" style={{ textTransform: 'capitalize' }}>{item.status}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
            <label className="form-label">Status</label>
            <select 
              className="form-input"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
            <label className="form-label">From Date</label>
            <input
              type="date"
              className="form-input"
              value={filters.start_date}
              onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
            <label className="form-label">To Date</label>
            <input
              type="date"
              className="form-input"
              value={filters.end_date}
              onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
            />
          </div>
          <button 
            className="btn btn-secondary"
            onClick={() => setFilters({ status: '', equipment_id: '', start_date: '', end_date: '' })}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Reservations Table */}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Equipment</th>
              <th>Personnel</th>
              <th>Customer</th>
              <th>Dates</th>
              <th>Purpose</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                  No reservations found
                </td>
              </tr>
            ) : (
              reservations.map(res => (
                <tr key={res.id}>
                  <td>
                    <Link to={`/equipment/${res.equipment_id}`} style={{ fontWeight: 500 }}>
                      {res.equipment_code}
                    </Link>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {res.equipment_name}
                    </div>
                  </td>
                  <td>{res.personnel_name}</td>
                  <td>{res.customer_name || '-'}</td>
                  <td>
                    <div style={{ fontSize: '0.9rem' }}>
                      {formatDate(res.start_date)} - {formatDate(res.end_date)}
                    </div>
                  </td>
                  <td style={{ maxWidth: '200px' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {res.purpose || '-'}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(res.status)}`}>
                      {res.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {res.status === 'pending' && (
                        <button 
                          className="btn btn-sm btn-success"
                          onClick={() => handleStatusChange(res.id, 'approved')}
                          title="Approve"
                        >
                          <Icons.Check size={14} />
                        </button>
                      )}
                      {res.status === 'approved' && (
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => handleStatusChange(res.id, 'active')}
                          title="Activate"
                        >
                          <Icons.Play size={14} />
                        </button>
                      )}
                      {res.status === 'active' && (
                        <button 
                          className="btn btn-sm btn-success"
                          onClick={() => handleStatusChange(res.id, 'completed')}
                          title="Complete"
                        >
                          <Icons.Check size={14} />
                        </button>
                      )}
                      {['pending', 'approved'].includes(res.status) && (
                        <>
                          <button 
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleOpenModal(res)}
                            title="Edit"
                          >
                            <Icons.Edit size={14} />
                          </button>
                          <button 
                            className="btn btn-sm"
                            onClick={() => handleStatusChange(res.id, 'cancelled')}
                            title="Cancel"
                          >
                            <Icons.Close size={14} />
                          </button>
                        </>
                      )}
                      {res.status === 'cancelled' && (
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(res.id)}
                          title="Delete"
                        >
                          <Icons.Trash size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{editingReservation ? 'Edit Reservation' : 'New Reservation'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
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
                        {eq.equipment_id} - {eq.equipment_name} {eq.serial_number ? `(S/N: ${eq.serial_number})` : ''} [{eq.status}] {eq.calibration_status ? `[${eq.calibration_status}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.start_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.end_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                {availability && !availability.available && (
                  <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                    Equipment is not available for these dates. Conflicts:
                    <ul style={{ margin: '0.5rem 0 0 1rem', paddingLeft: 0 }}>
                      {availability.conflicts.map(c => (
                        <li key={c.id}>
                          {formatDate(c.start_date)} - {formatDate(c.end_date)} ({c.reserved_by})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {availability && availability.available && (
                  <div className="alert alert-success" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icons.Check size={16} /> Equipment is available for these dates
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Personnel *</label>
                  <select
                    className="form-input"
                    value={formData.personnel_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, personnel_id: e.target.value }))}
                    required
                  >
                    <option value="">Select person...</option>
                    {personnel.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.employee_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Customer (Optional)</label>
                  <select
                    className="form-input"
                    value={formData.customer_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_id: e.target.value }))}
                  >
                    <option value="">No customer / Internal use</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Purpose</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.purpose}
                    onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                    placeholder="e.g., Site visit, Training, Project work..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting || (availability && !availability.available)}
                >
                  {submitting ? 'Saving...' : (editingReservation ? 'Update' : 'Create Reservation')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reservations;
