import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { equipmentApi, calibrationApi } from '../services/api';

function EquipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [history, setHistory] = useState([]);
  const [calibrationHistory, setCalibrationHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    fetchEquipment();
    fetchHistory();
    fetchCalibrationHistory();
  }, [id]);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const response = await equipmentApi.getById(id);
      setEquipment(response?.data || null);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await equipmentApi.getHistory(id, 100);
      setHistory(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const fetchCalibrationHistory = async () => {
    try {
      const response = await calibrationApi.getHistory(id);
      setCalibrationHistory(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      console.error('Error fetching calibration history:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateOnly = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getCalibrationStatusBadge = (expiryDate) => {
    if (!expiryDate) return <span className="badge" style={{ background: '#6b7280' }}>Not Calibrated</span>;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return <span className="badge badge-expired" style={{ background: '#ef4444' }}>Expired</span>;
    } else if (daysUntilExpiry <= 30) {
      return <span className="badge badge-due-soon" style={{ background: '#f59e0b' }}>Due Soon ({daysUntilExpiry} days)</span>;
    }
    return <span className="badge badge-valid" style={{ background: '#10b981' }}>Valid</span>;
  };

  const openCertificate = (record) => {
    // Open certificate via SharePoint URL
    if (record.certificate_file_url) {
      window.open(record.certificate_file_url, '_blank');
    }
  };

  const getStatusBadge = (item) => {
    if (item.is_consumable) {
      if (item.available_quantity <= item.reorder_level) {
        return <span className="badge badge-low-stock">Low Stock</span>;
      }
      return <span className="badge badge-consumable">Consumable</span>;
    }

    if (item.status === 'Available') {
      return <span className="badge badge-available">Available</span>;
    }
    return <span className="badge badge-checked-out">Checked Out</span>;
  };

  const getActionBadge = (action) => {
    const badges = {
      OUT: 'badge-checked-out',
      IN: 'badge-available',
      ISSUE: 'badge-consumable',
      RESTOCK: 'badge-available',
    };
    return badges[action] || '';
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading equipment details...
      </div>
    );
  }

  if (error || !equipment) {
    return (
      <div className="alert alert-error">
        {error || 'Equipment not found'}
        <Link to="/equipment" className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }}>
          Back to Equipment
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{equipment.equipment_name}</h1>
          <p className="page-subtitle">{equipment.equipment_id}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {equipment.status === 'Available' && equipment.is_checkout_allowed && !equipment.is_consumable && (
            <Link to={`/check-out?equipment=${equipment.id}`} className="btn btn-primary">
              Check Out
            </Link>
          )}
          {equipment.status === 'Checked Out' && !equipment.is_consumable && (
            <Link to={`/check-in?equipment=${equipment.id}`} className="btn btn-success">
              Check In
            </Link>
          )}
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
      </div>

      {/* Status Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Status</p>
            {getStatusBadge(equipment)}
          </div>

          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Current Location</p>
            <p style={{ fontWeight: 500 }}>{equipment.current_location || 'Not set'}</p>
          </div>

          {equipment.status === 'Checked Out' && (
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Checked Out To</p>
              <p style={{ fontWeight: 500 }}>{equipment.current_holder || '-'}</p>
            </div>
          )}

          {equipment.last_action_timestamp && (
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Last Action</p>
              <p style={{ fontWeight: 500 }}>
                {equipment.last_action} - {formatDate(equipment.last_action_timestamp)}
              </p>
            </div>
          )}

          {equipment.is_quantity_tracked && (
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Quantity</p>
              <p style={{ fontWeight: 500 }}>
                {equipment.available_quantity} / {equipment.total_quantity} {equipment.unit}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          className={`tab ${activeTab === 'calibration' ? 'active' : ''}`}
          onClick={() => setActiveTab('calibration')}
        >
          Calibration ({calibrationHistory.length})
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Movement History ({history.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>
                Basic Information
              </h3>
              <dl style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <dt style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Equipment ID</dt>
                  <dd style={{ fontWeight: 500 }}>{equipment.equipment_id}</dd>
                </div>
                <div>
                  <dt style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Name</dt>
                  <dd style={{ fontWeight: 500 }}>{equipment.equipment_name}</dd>
                </div>
                <div>
                  <dt style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Description</dt>
                  <dd>{equipment.description || '-'}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>
                Classification
              </h3>
              <dl style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <dt style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Category</dt>
                  <dd style={{ fontWeight: 500 }}>{equipment.category_name}</dd>
                </div>
                <div>
                  <dt style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Subcategory</dt>
                  <dd style={{ fontWeight: 500 }}>{equipment.subcategory_name}</dd>
                </div>
                <div>
                  <dt style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Checkout Allowed</dt>
                  <dd>{equipment.is_checkout_allowed ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Consumable</dt>
                  <dd>{equipment.is_consumable ? 'Yes' : 'No'}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>
                Identification
              </h3>
              <dl style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <dt style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Serialised</dt>
                  <dd>{equipment.is_serialised ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Serial Number</dt>
                  <dd style={{ fontWeight: 500 }}>{equipment.serial_number || '-'}</dd>
                </div>
                <div>
                  <dt style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Quantity Tracked</dt>
                  <dd>{equipment.is_quantity_tracked ? 'Yes' : 'No'}</dd>
                </div>
                {equipment.is_quantity_tracked && (
                  <>
                    <div>
                      <dt style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Quantity</dt>
                      <dd>{equipment.total_quantity} {equipment.unit}</dd>
                    </div>
                    <div>
                      <dt style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Available Quantity</dt>
                      <dd>{equipment.available_quantity} {equipment.unit}</dd>
                    </div>
                    {equipment.reorder_level > 0 && (
                      <div>
                        <dt style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Reorder Level</dt>
                        <dd>{equipment.reorder_level} {equipment.unit}</dd>
                      </div>
                    )}
                  </>
                )}
              </dl>
            </div>

            {equipment.notes && (
              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>
                  Notes
                </h3>
                <p>{equipment.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'calibration' && (
        <div className="card">
          {calibrationHistory.length === 0 ? (
            <div className="empty-state">
              <h3>No calibration records</h3>
              <p>This equipment has no calibration history</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Calibration Date</th>
                    <th>Expiry Date</th>
                    <th>Status</th>
                    <th>Certificate #</th>
                    <th>Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {calibrationHistory.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDateOnly(record.calibration_date)}</td>
                      <td>{formatDateOnly(record.expiry_date)}</td>
                      <td>{getCalibrationStatusBadge(record.expiry_date)}</td>
                      <td style={{ fontWeight: 500 }}>{record.certificate_number || '-'}</td>
                      <td>
                        {record.certificate_file_url ? (
                          <div>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => openCertificate(record)}
                              title={record.certificate_filename ? `Look for: ${record.certificate_filename}` : 'Open Certificate Folder'}
                            >
                              📂 Open Folder
                            </button>
                            {record.certificate_filename && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                File: {record.certificate_filename}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No file</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          {history.length === 0 ? (
            <div className="empty-state">
              <h3>No movement history</h3>
              <p>This equipment has not been checked out yet</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date/Time</th>
                    <th>Action</th>
                    <th>Quantity</th>
                    <th>Location</th>
                    <th>Personnel</th>
                    <th>Notes</th>
                    <th>Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((movement) => (
                    <tr key={movement.id}>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {formatDate(movement.created_at)}
                      </td>
                      <td>
                        <span className={`badge ${getActionBadge(movement.action)}`}>
                          {movement.action}
                        </span>
                      </td>
                      <td>{movement.quantity > 1 ? movement.quantity : '-'}</td>
                      <td>{movement.location || '-'}</td>
                      <td>
                        {movement.personnel && (
                          <>
                            {movement.personnel}
                            <br />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {movement.personnel_employee_id}
                            </span>
                          </>
                        )}
                        {!movement.personnel && '-'}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{movement.notes || '-'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{movement.created_by || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EquipmentDetail;
