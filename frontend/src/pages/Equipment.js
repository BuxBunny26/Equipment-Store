import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { equipmentApi, categoriesApi, calibrationApi } from '../services/api';
import { exportData, EXPORT_COLUMNS } from '../services/exportUtils';
import { Icons } from '../components/Icons';
import AddEquipmentModal from '../components/AddEquipmentModal';

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

      const [eqRes, calRes] = await Promise.all([
        equipmentApi.getAll(params),
        calibrationApi.getStatus()
      ]);

      // Build a map of equipment_id -> latest calibration_status
      const calMap = {};
      (calRes.data || []).forEach(r => {
        calMap[r.equipment_id] = r.calibration_status;
      });

      let items = eqRes.data.map(e => ({
        ...e,
        calibration_status: calMap[e.id] || 'N/A',
      }));

      // Apply calibration filter client-side
      if (filters.calibration_status) {
        if (filters.calibration_status === 'Not Calibrated') {
          items = items.filter(e => e.calibration_status === 'N/A');
        } else if (filters.calibration_status === 'Calibrated') {
          items = items.filter(e => e.calibration_status === 'Valid');
        } else {
          items = items.filter(e => e.calibration_status === filters.calibration_status);
        }
      }

      setEquipment(items);
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
      return <span className="badge" style={{ background: 'var(--error-color)' }}>Expired</span>;
    }
    if (item.calibration_status === 'Due Soon') {
      return <span className="badge" style={{ background: 'var(--warning-color)' }}>Due Soon</span>;
    }
    return <span className="badge" style={{ background: 'var(--success-color)' }}>Calibrated</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Equipment</h1>
          <p className="page-subtitle">Manage equipment inventory</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-secondary" onClick={() => exportData('csv', equipment, EXPORT_COLUMNS.equipment, 'equipment', 'Equipment List')} disabled={equipment.length === 0}>
            <Icons.Download size={16} /> CSV
          </button>
          <button className="btn btn-secondary" onClick={() => exportData('excel', equipment, EXPORT_COLUMNS.equipment, 'equipment', 'Equipment List')} disabled={equipment.length === 0}>
            <Icons.Download size={16} /> Excel
          </button>
          <button className="btn btn-secondary" onClick={() => exportData('pdf', equipment, EXPORT_COLUMNS.equipment, 'equipment', 'Equipment List')} disabled={equipment.length === 0}>
            <Icons.Download size={16} /> PDF
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Equipment
          </button>
        </div>
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

export default Equipment;
