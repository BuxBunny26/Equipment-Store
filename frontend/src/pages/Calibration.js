import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { calibrationApi, categoriesApi } from '../services/api';
import { Icons } from '../components/Icons';

function Calibration() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({ summary: [], total: 0 });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    category: '',
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [calibrationHistory, setCalibrationHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form state for adding calibration
  const [calibrationForm, setCalibrationForm] = useState({
    equipment_id: '',
    calibration_date: '',
    expiry_date: '',
    certificate_number: '',
    calibration_provider: '',
    notes: '',
  });
  const [certificateFile, setCertificateFile] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchCalibrationStatus = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.category) params.category = filters.category;
      if (filters.search) params.search = filters.search;

      const response = await calibrationApi.getStatus(params);
      setEquipment(response.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.category, filters.search]);

  const fetchSummary = async () => {
    try {
      const response = await calibrationApi.getSummary();
      setSummary(response.data);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await categoriesApi.getAll();
      setCategories(response.data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchCalibrationStatus();
  }, [fetchCalibrationStatus]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCalibrationStatus();
  };

  const handleViewHistory = async (item) => {
    setSelectedEquipment(item);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const response = await calibrationApi.getHistory(item.equipment_id);
      setCalibrationHistory(response.data);
    } catch (err) {
      console.error('Error fetching history:', err);
      setCalibrationHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAddCalibration = (item) => {
    setSelectedEquipment(item);
    setCalibrationForm({
      equipment_id: item.equipment_id,
      calibration_date: new Date().toISOString().split('T')[0],
      expiry_date: '',
      certificate_number: '',
      calibration_provider: '',
      notes: '',
    });
    setCertificateFile(null);
    setShowAddModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      await calibrationApi.create(calibrationForm, certificateFile);
      setShowAddModal(false);
      fetchCalibrationStatus();
      fetchSummary();
      alert('Calibration record added successfully!');
    } catch (err) {
      alert('Error adding calibration: ' + err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleViewCertificate = (recordId) => {
    window.open(calibrationApi.getCertificateUrl(recordId), '_blank');
  };

  const handleDownloadCertificate = (recordId) => {
    window.open(calibrationApi.getDownloadUrl(recordId), '_blank');
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      'Valid': 'badge-available',
      'Due Soon': 'badge-warning',
      'Expired': 'badge-checked-out',
      'Not Calibrated': 'badge-low-stock',
      'N/A': 'badge-secondary',
    };
    return <span className={`badge ${statusClasses[status] || 'badge-secondary'}`}>{status}</span>;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-ZA');
  };

  const getSummaryCount = (status) => {
    const item = summary.summary.find(s => s.calibration_status === status);
    return item ? parseInt(item.count) : 0;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Calibration Management</h1>
          <p className="page-subtitle">Track equipment calibration status and certificates</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #dc3545' }}>
          <div className="stat-content">
            <div className="stat-value" style={{ color: '#dc3545' }}>{getSummaryCount('Expired')}</div>
            <div className="stat-label">Expired</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #ffc107' }}>
          <div className="stat-content">
            <div className="stat-value" style={{ color: '#ffc107' }}>{getSummaryCount('Due Soon')}</div>
            <div className="stat-label">Due Soon (30 days)</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #28a745' }}>
          <div className="stat-content">
            <div className="stat-value" style={{ color: '#28a745' }}>{getSummaryCount('Valid')}</div>
            <div className="stat-label">Valid</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #6c757d' }}>
          <div className="stat-content">
            <div className="stat-value" style={{ color: '#6c757d' }}>{getSummaryCount('Not Calibrated')}</div>
            <div className="stat-label">Not Calibrated</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <form onSubmit={handleSearch}>
          <div className="search-bar">
            <input
              type="text"
              className="form-input search-input"
              placeholder="Search by name, serial number, or manufacturer..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </div>

          <div className="filter-row" style={{ marginTop: '1rem' }}>
            <div className="filter-group">
              <label className="form-label">Status</label>
              <select
                className="form-input"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All Statuses</option>
                <option value="Expired">Expired</option>
                <option value="Due Soon">Due Soon</option>
                <option value="Valid">Valid</option>
                <option value="Not Calibrated">Not Calibrated</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="form-label">Category</label>
              <select
                className="form-input"
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              >
                <option value="">All Categories</option>
                {categories.filter(c => c.requires_calibration).map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* Equipment Table */}
      <div className="card">
        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading-spinner">Loading...</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Equipment ID</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Serial Number</th>
                  <th>Manufacturer</th>
                  <th>Last Calibration</th>
                  <th>Expiry Date</th>
                  <th>Days Left</th>
                  <th>Status</th>
                  <th>Certificate</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {equipment.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', padding: '2rem' }}>
                      No equipment found matching the criteria
                    </td>
                  </tr>
                ) : (
                  equipment.map((item) => (
                    <tr key={item.equipment_id}>
                      <td>
                        <Link to={`/equipment/${item.equipment_id}`} className="equipment-link">
                          {item.equipment_code}
                        </Link>
                      </td>
                      <td>{item.equipment_name}</td>
                      <td>{item.category}</td>
                      <td><code>{item.serial_number}</code></td>
                      <td>{item.manufacturer || '-'}</td>
                      <td>{formatDate(item.last_calibration_date)}</td>
                      <td>{formatDate(item.calibration_expiry_date)}</td>
                      <td>
                        {item.days_until_expiry !== null ? (
                          <span style={{ 
                            color: item.days_until_expiry < 0 ? '#dc3545' : 
                                   item.days_until_expiry <= 30 ? '#ffc107' : '#28a745',
                            fontWeight: 600
                          }}>
                            {item.days_until_expiry}
                          </span>
                        ) : '-'}
                      </td>
                      <td>{getStatusBadge(item.calibration_status)}</td>
                      <td>
                        {item.calibration_record_id ? (
                          <button
                            className="btn btn-small btn-secondary"
                            onClick={() => handleViewCertificate(item.calibration_record_id)}
                            title="View Certificate"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Icons.FileText size={14} /> View
                          </button>
                        ) : (
                          <span style={{ color: '#6c757d' }}>-</span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-small btn-primary"
                            onClick={() => handleAddCalibration(item)}
                            title="Add Calibration Record"
                          >
                            + Calibrate
                          </button>
                          <button
                            className="btn btn-small btn-secondary"
                            onClick={() => handleViewHistory(item)}
                            title="View History"
                          >
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Calibration Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Calibration Record</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {selectedEquipment && (
                <div className="equipment-info" style={{ marginBottom: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
                  <strong>{selectedEquipment.equipment_name}</strong>
                  <br />
                  <span style={{ color: '#6c757d' }}>
                    Serial: {selectedEquipment.serial_number} | {selectedEquipment.category}
                  </span>
                </div>
              )}

              <form onSubmit={handleFormSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Calibration Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={calibrationForm.calibration_date}
                      onChange={(e) => setCalibrationForm({ ...calibrationForm, calibration_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiry Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={calibrationForm.expiry_date}
                      onChange={(e) => setCalibrationForm({ ...calibrationForm, expiry_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Certificate Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., CAL-2026-001"
                      value={calibrationForm.certificate_number}
                      onChange={(e) => setCalibrationForm({ ...calibrationForm, certificate_number: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Calibration Provider</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Company/Lab name"
                      value={calibrationForm.calibration_provider}
                      onChange={(e) => setCalibrationForm({ ...calibrationForm, calibration_provider: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Certificate File (PDF, Image)</label>
                  <input
                    type="file"
                    className="form-input"
                    accept=".pdf,.jpg,.jpeg,.png,.tiff,.doc,.docx"
                    onChange={(e) => setCertificateFile(e.target.files[0])}
                  />
                  <small style={{ color: '#6c757d' }}>Max 10MB. Accepted: PDF, JPEG, PNG, TIFF, DOC, DOCX</small>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Any additional notes..."
                    value={calibrationForm.notes}
                    onChange={(e) => setCalibrationForm({ ...calibrationForm, notes: e.target.value })}
                  />
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                    {formSubmitting ? 'Saving...' : 'Save Calibration Record'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Calibration History</h2>
              <button className="modal-close" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {selectedEquipment && (
                <div className="equipment-info" style={{ marginBottom: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
                  <strong>{selectedEquipment.equipment_name}</strong>
                  <br />
                  <span style={{ color: '#6c757d' }}>
                    Serial: {selectedEquipment.serial_number} | {selectedEquipment.manufacturer || 'Unknown manufacturer'}
                  </span>
                </div>
              )}

              {historyLoading ? (
                <div className="loading-spinner">Loading history...</div>
              ) : calibrationHistory.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6c757d', padding: '2rem' }}>
                  No calibration history found for this equipment.
                </p>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Calibration Date</th>
                        <th>Expiry Date</th>
                        <th>Validity (Days)</th>
                        <th>Certificate #</th>
                        <th>Provider</th>
                        <th>Notes</th>
                        <th>Certificate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calibrationHistory.map((record, index) => (
                        <tr key={record.id} style={index === 0 ? { background: '#e8f5e9' } : {}}>
                          <td>{formatDate(record.calibration_date)}</td>
                          <td>{formatDate(record.expiry_date)}</td>
                          <td>{record.validity_days}</td>
                          <td><code>{record.certificate_number || '-'}</code></td>
                          <td>{record.calibration_provider || '-'}</td>
                          <td>{record.notes || '-'}</td>
                          <td>
                            {record.certificate_file_path ? (
                              <div className="action-buttons">
                                <button
                                  className="btn btn-small btn-secondary"
                                  onClick={() => handleViewCertificate(record.id)}
                                  title="View"
                                >
                                  <Icons.Eye size={14} />
                                </button>
                                <button
                                  className="btn btn-small btn-secondary"
                                  onClick={() => handleDownloadCertificate(record.id)}
                                  title="Download"
                                >
                                  <Icons.Download size={14} />
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: '#6c757d' }}>-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => handleAddCalibration(selectedEquipment)}>
                + Add New Calibration
              </button>
              <button className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Calibration;
