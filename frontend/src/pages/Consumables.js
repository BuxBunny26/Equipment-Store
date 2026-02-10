import React, { useState, useEffect } from 'react';
import { reportsApi, movementsApi, locationsApi, personnelApi } from '../services/api';
import { Icons } from '../components/Icons';

function Consumables() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [consumables, setConsumables] = useState([]);
  const [locations, setLocations] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [consumablesRes, locationsRes, personnelRes] = await Promise.all([
        reportsApi.getConsumables(),
        locationsApi.getAll(true),
        personnelApi.getAll(true),
      ]);

      setConsumables(consumablesRes.data);
      setLocations(locationsRes.data);
      setPersonnel(personnelRes.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIssue = (item) => {
    setSelectedItem(item);
    setShowIssueModal(true);
  };

  const handleRestock = (item) => {
    setSelectedItem(item);
    setShowRestockModal(true);
  };

  const getStockStatus = (item) => {
    if (item.available_quantity <= 0) {
      return <span className="badge badge-overdue">Out of Stock</span>;
    }
    if (item.is_low_stock) {
      return <span className="badge badge-low-stock">Low Stock</span>;
    }
    return <span className="badge badge-available">In Stock</span>;
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading consumables...
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Consumables</h1>
          <p className="page-subtitle">Manage consumable inventory</p>
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

      {/* Low Stock Alert */}
      {consumables.filter((c) => c.is_low_stock).length > 0 && (
        <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icons.Warning size={18} />
          <span><strong>Low Stock Alert:</strong> {consumables.filter((c) => c.is_low_stock).length} items need restocking</span>
        </div>
      )}

      {/* Consumables Table */}
      <div className="card">
        {consumables.length === 0 ? (
          <div className="empty-state">
            <h3>No consumables found</h3>
            <p>Add items to the Consumables category to track them here</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Item ID</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Stock Level</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {consumables.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.equipment_id}</strong>
                    </td>
                    <td>{item.equipment_name}</td>
                    <td>
                      <span style={{ fontSize: '0.8rem' }}>
                        {item.category}
                        <br />
                        <span style={{ color: 'var(--text-secondary)' }}>{item.subcategory}</span>
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '60px',
                            height: '8px',
                            background: 'var(--border-color)',
                            borderRadius: '4px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, (item.available_quantity / Math.max(item.total_quantity, 1)) * 100)}%`,
                              height: '100%',
                              background: item.is_low_stock ? 'var(--error-color)' : 'var(--success-color)',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.875rem' }}>
                          {item.available_quantity} / {item.total_quantity} {item.unit}
                        </span>
                      </div>
                      {item.reorder_level > 0 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          Reorder at: {item.reorder_level}
                        </span>
                      )}
                    </td>
                    <td>{getStockStatus(item)}</td>
                    <td>{item.current_location || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleIssue(item)}
                          disabled={item.available_quantity <= 0}
                        >
                          Issue
                        </button>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleRestock(item)}
                        >
                          Restock
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

      {/* Issue Modal */}
      {showIssueModal && selectedItem && (
        <IssueModal
          item={selectedItem}
          locations={locations}
          personnel={personnel}
          onClose={() => {
            setShowIssueModal(false);
            setSelectedItem(null);
          }}
          onSuccess={() => {
            setShowIssueModal(false);
            setSelectedItem(null);
            fetchData();
          }}
        />
      )}

      {/* Restock Modal */}
      {showRestockModal && selectedItem && (
        <RestockModal
          item={selectedItem}
          onClose={() => {
            setShowRestockModal(false);
            setSelectedItem(null);
          }}
          onSuccess={() => {
            setShowRestockModal(false);
            setSelectedItem(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// Issue Modal Component
function IssueModal({ item, locations, personnel, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    quantity: 1,
    location_id: '',
    personnel_id: '',
    notes: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await movementsApi.create({
        equipment_id: item.id,
        action: 'ISSUE',
        quantity: parseInt(formData.quantity),
        location_id: parseInt(formData.location_id),
        personnel_id: parseInt(formData.personnel_id),
        notes: formData.notes,
        created_by: 'System',
      });

      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Issue Consumable</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="alert alert-info" style={{ marginBottom: '16px' }}>
              <strong>{item.equipment_name}</strong>
              <br />
              Available: {item.available_quantity} {item.unit}
            </div>

            <div className="form-group">
              <label className="form-label">Quantity to Issue *</label>
              <input
                type="number"
                className="form-input"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                min="1"
                max={item.available_quantity}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Issue To (Personnel) *</label>
              <select
                className="form-select"
                value={formData.personnel_id}
                onChange={(e) => setFormData({ ...formData, personnel_id: e.target.value })}
                required
              >
                <option value="">Select person...</option>
                {personnel.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.employee_id} - {p.first_name === p.last_name ? p.first_name : `${p.first_name} ${p.last_name}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Location *</label>
              <select
                className="form-select"
                value={formData.location_id}
                onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                required
              >
                <option value="">Select location...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processing...' : 'Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Restock Modal Component
function RestockModal({ item, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    quantity: 1,
    notes: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await movementsApi.create({
        equipment_id: item.id,
        action: 'RESTOCK',
        quantity: parseInt(formData.quantity),
        notes: formData.notes,
        created_by: 'System',
      });

      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Restock Consumable</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="alert alert-info" style={{ marginBottom: '16px' }}>
              <strong>{item.equipment_name}</strong>
              <br />
              Current Stock: {item.available_quantity} / {item.total_quantity} {item.unit}
            </div>

            <div className="form-group">
              <label className="form-label">Quantity to Add *</label>
              <input
                type="number"
                className="form-input"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                min="1"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="PO number, supplier, etc."
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-success" disabled={loading}>
              {loading ? 'Processing...' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Consumables;
