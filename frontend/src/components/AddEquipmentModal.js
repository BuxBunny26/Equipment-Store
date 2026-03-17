import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { equipmentApi, categoriesApi, locationsApi, subcategoriesApi } from '../services/api';
import { Icons } from './Icons';

function AddEquipmentModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [duplicateMatch, setDuplicateMatch] = useState(null);
  const [checkingSerial, setCheckingSerial] = useState(false);
  const [formData, setFormData] = useState({
    equipment_id: '',
    equipment_name: '',
    description: '',
    category_id: '',
    subcategory_id: '',
    manufacturer: '',
    model: '',
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
    const fetchData = async () => {
      try {
        const [catRes, locRes] = await Promise.all([
          categoriesApi.getAll(),
          locationsApi.getAll(true),
        ]);
        setCategories(catRes.data);
        setLocations(locRes.data);
      } catch (err) {
        console.error('Error fetching form data:', err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (formData.category_id) {
      fetchSubcategories(formData.category_id);
    } else {
      setSubcategories([]);
    }
  }, [formData.category_id]);

  const fetchSubcategories = async (categoryId) => {
    try {
      const { data } = await subcategoriesApi.getAll(categoryId);
      setSubcategories(data);
    } catch (err) {
      console.error('Error fetching subcategories:', err);
    }
  };

  // Debounced serial number duplicate check
  const checkSerialNumber = useCallback(
    (() => {
      let timer;
      return (serial) => {
        clearTimeout(timer);
        if (!serial || serial.trim().length < 2) {
          setDuplicateMatch(null);
          setCheckingSerial(false);
          return;
        }
        setCheckingSerial(true);
        timer = setTimeout(async () => {
          try {
            const { data } = await equipmentApi.checkSerial(serial.trim());
            setDuplicateMatch(data.length > 0 ? data[0] : null);
          } catch {
            setDuplicateMatch(null);
          } finally {
            setCheckingSerial(false);
          }
        }, 500);
      };
    })(),
    []
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (duplicateMatch) return;
    setLoading(true);
    setError(null);

    try {
      const submitData = { ...formData };
      // Convert empty strings to null for FK fields
      if (!submitData.category_id) submitData.category_id = null;
      if (!submitData.subcategory_id) submitData.subcategory_id = null;
      if (!submitData.current_location_id) submitData.current_location_id = null;
      await equipmentApi.create(submitData);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newVal = type === 'checkbox' ? checked : value;
    setFormData((prev) => ({
      ...prev,
      [name]: newVal,
    }));
    if (name === 'serial_number') {
      checkSerialNumber(value);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add Equipment</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            {/* Duplicate Serial Warning */}
            {duplicateMatch && (
              <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <Icons.Warning size={20} />
                <div style={{ flex: 1 }}>
                  <strong>Duplicate Serial Number Found!</strong>
                  <br />
                  <span style={{ fontSize: '0.9rem' }}>
                    Serial <code>{duplicateMatch.serial_number}</code> already belongs to{' '}
                    <strong>{duplicateMatch.equipment_id}</strong> &mdash; {duplicateMatch.equipment_name}
                    {duplicateMatch.category_name && ` (${duplicateMatch.category_name})`}
                    {' '}&mdash; Status: {duplicateMatch.status}
                  </span>
                </div>
                <Link
                  to={`/equipment/${duplicateMatch.id}`}
                  className="btn btn-primary btn-sm"
                  onClick={onClose}
                >
                  Go to Equipment &rarr;
                </Link>
              </div>
            )}

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
                <label className="form-label">Manufacturer *</label>
                <input
                  type="text"
                  name="manufacturer"
                  className="form-input"
                  value={formData.manufacturer}
                  onChange={handleChange}
                  required
                  placeholder="e.g., SKF, Fluke, Emerson"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Model *</label>
                <input
                  type="text"
                  name="model"
                  className="form-input"
                  value={formData.model}
                  onChange={handleChange}
                  required
                  placeholder="e.g., CMXA 80, Ti480"
                />
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
                <label className="form-label">
                  Serial Number {formData.is_serialised && '*'}
                  {checkingSerial && <span style={{ marginLeft: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Checking...</span>}
                </label>
                <input
                  type="text"
                  name="serial_number"
                  className="form-input"
                  value={formData.serial_number}
                  onChange={handleChange}
                  required={formData.is_serialised}
                  disabled={!formData.is_serialised}
                  style={duplicateMatch ? { borderColor: 'var(--warning-color)' } : {}}
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
              <label className="form-label">Current Location *</label>
              <select
                name="current_location_id"
                className="form-select"
                value={formData.current_location_id}
                onChange={handleChange}
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
            <button type="submit" className="btn btn-primary" disabled={loading || !!duplicateMatch}>
              {loading ? 'Creating...' : 'Create Equipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEquipmentModal;
