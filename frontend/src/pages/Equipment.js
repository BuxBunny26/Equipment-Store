import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { equipmentApi, categoriesApi } from '../services/api';

function Equipment() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    category_id: '',
    is_consumable: 'false',
    calibration_status: '',
  });
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchEquipment();
  }, [filters.status, filters.category_id, filters.is_consumable, filters.calibration_status]);

  const fetchCategories = async () => {
    try {
      const response = await categoriesApi.getAll();
      setCategories(response.data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.is_consumable !== '') params.is_consumable = filters.is_consumable;
      if (filters.search) params.search = filters.search;
      if (filters.calibration_status) params.calibration_status = filters.calibration_status;

      const response = await equipmentApi.getAll(params);
      setEquipment(response.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchEquipment();
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

  const getCalibrationBadge = (item) => {
    if (!item.calibration_status || item.calibration_status === 'N/A') {
      return <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>N/A</span>;
    }
    if (item.calibration_status === 'Expired') {
      return <span className="badge" style={{ background: '#ef4444' }}>Expired</span>;
    }
    if (item.calibration_status === 'Due Soon') {
      return <span className="badge" style={{ background: '#f59e0b' }}>Due Soon</span>;
    }
    return <span className="badge" style={{ background: '#10b981' }}>Valid</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Equipment</h1>
          <p className="page-subtitle">Manage equipment inventory</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + Add Equipment
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <form onSubmit={handleSearch}>
          <div className="search-bar">
            <input
              type="text"
              className="form-input search-input"
              placeholder="Search by ID, name, or serial number..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </div>

          <div className="filter-group">
            <select
              className="form-select"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Checked Out">Checked Out</option>
            </select>

            <select
              className="form-select"
              value={filters.category_id}
              onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
            >
              <option value="">All Categories</option>
              {categories.filter(c => !c.is_consumable).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <select
              className="form-select"
              value={filters.calibration_status}
              onChange={(e) => setFilters({ ...filters, calibration_status: e.target.value })}
            >
              <option value="">All Calibration</option>
              <option value="Calibrated">Calibrated (Valid)</option>
              <option value="Due Soon">Due Soon</option>
              <option value="Expired">Expired</option>
              <option value="Not Calibrated">Not Calibrated</option>
            </select>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setFilters({ search: '', status: '', category_id: '', is_consumable: 'false', calibration_status: '' })}
            >
              Clear Filters
            </button>
          </div>
        </form>
      </div>

      {/* Equipment Table */}
      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            Loading equipment...
          </div>
        ) : error ? (
          <div className="alert alert-error">
            {error}
            <button className="btn btn-sm btn-secondary" onClick={fetchEquipment} style={{ marginLeft: 'auto' }}>
              Retry
            </button>
          </div>
        ) : equipment.length === 0 ? (
          <div className="empty-state">
            <h3>No equipment found</h3>
            <p>Try adjusting your filters or add new equipment</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="equipment-table">
              <thead>
                <tr>
                  <th>Equipment ID</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Serial Number</th>
                  <th>Status</th>
                  <th>Calibration</th>
                  <th>Location</th>
                  <th>Holder</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/equipment/${item.id}`} style={{ fontWeight: 600 }}>
                        {item.equipment_id}
                      </Link>
                    </td>
                    <td>{item.equipment_name}</td>
                    <td>
                      <span style={{ fontSize: '0.8rem' }}>
                        {item.category_name}
                        <br />
                        <span style={{ color: 'var(--text-secondary)' }}>{item.subcategory_name}</span>
                      </span>
                    </td>
                    <td>{item.serial_number || '-'}</td>
                    <td>
                      {getStatusBadge(item)}
                      {item.is_quantity_tracked && (
                        <span style={{ marginLeft: '8px', fontSize: '0.8rem' }}>
                          ({item.available_quantity}/{item.total_quantity})
                        </span>
                      )}
                    </td>
                    <td>{getCalibrationBadge(item)}</td>
                    <td>{item.current_location || '-'}</td>
                    <td>{item.current_holder || '-'}</td>
                    <td>
                      <div className="actions-cell">
                        <Link to={`/equipment/${item.id}`} className="btn btn-sm btn-secondary">
                          View
                        </Link>
                        {item.status === 'Available' && item.is_checkout_allowed && !item.is_consumable && (
                          <Link to={`/check-out?equipment=${item.id}`} className="btn btn-sm btn-primary">
                            Check Out
                          </Link>
                        )}
                        {item.status === 'Checked Out' && !item.is_consumable && (
                          <Link to={`/check-in?equipment=${item.id}`} className="btn btn-sm btn-success">
                            Check In
                          </Link>
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

      {/* Add Equipment Modal */}
      {showAddModal && (
        <AddEquipmentModal
          categories={categories}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchEquipment();
          }}
        />
      )}
    </div>
  );
}

// Add Equipment Modal Component
function AddEquipmentModal({ categories, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [subcategories, setSubcategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [formData, setFormData] = useState({
    equipment_id: '',
    equipment_name: '',
    description: '',
    category_id: '',
    subcategory_id: '',
    is_serialised: true,
    serial_number: '',
    is_quantity_tracked: false,
    total_quantity: 1,
    unit: 'ea',
    reorder_level: 0,
    current_location_id: '',
    notes: '',
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (formData.category_id) {
      fetchSubcategories(formData.category_id);
    } else {
      setSubcategories([]);
    }
  }, [formData.category_id]);

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations?active_only=true');
      const data = await response.json();
      setLocations(data);
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const fetchSubcategories = async (categoryId) => {
    try {
      const response = await fetch(`/api/subcategories?category_id=${categoryId}`);
      const data = await response.json();
      setSubcategories(data);
    } catch (err) {
      console.error('Error fetching subcategories:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await equipmentApi.create(formData);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add Equipment</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Equipment ID *</label>
                <input
                  type="text"
                  name="equipment_id"
                  className="form-input"
                  value={formData.equipment_id}
                  onChange={handleChange}
                  required
                  placeholder="e.g., EQP-001"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Equipment Name *</label>
                <input
                  type="text"
                  name="equipment_name"
                  className="form-input"
                  value={formData.equipment_name}
                  onChange={handleChange}
                  required
                  placeholder="e.g., SKF Vibration Analyzer"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                name="description"
                className="form-textarea"
                value={formData.description}
                onChange={handleChange}
                rows={2}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  name="category_id"
                  className="form-select"
                  value={formData.category_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} {cat.is_consumable ? '(Consumable)' : ''} {!cat.is_checkout_allowed ? '(Non-checkout)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Subcategory *</label>
                <select
                  name="subcategory_id"
                  className="form-select"
                  value={formData.subcategory_id}
                  onChange={handleChange}
                  required
                  disabled={!formData.category_id}
                >
                  <option value="">Select subcategory...</option>
                  {subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    name="is_serialised"
                    checked={formData.is_serialised}
                    onChange={handleChange}
                  />
                  Serialised Equipment
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Serial Number {formData.is_serialised && '*'}</label>
                <input
                  type="text"
                  name="serial_number"
                  className="form-input"
                  value={formData.serial_number}
                  onChange={handleChange}
                  required={formData.is_serialised}
                  disabled={!formData.is_serialised}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    name="is_quantity_tracked"
                    checked={formData.is_quantity_tracked}
                    onChange={handleChange}
                  />
                  Track Quantity
                </label>
              </div>

              {formData.is_quantity_tracked && (
                <>
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input
                      type="number"
                      name="total_quantity"
                      className="form-input"
                      value={formData.total_quantity}
                      onChange={handleChange}
                      min="1"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <input
                      type="text"
                      name="unit"
                      className="form-input"
                      value={formData.unit}
                      onChange={handleChange}
                      placeholder="ea, roll, pack"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Current Location</label>
              <select
                name="current_location_id"
                className="form-select"
                value={formData.current_location_id}
                onChange={handleChange}
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
                name="notes"
                className="form-textarea"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Equipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Equipment;
