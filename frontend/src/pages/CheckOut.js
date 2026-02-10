import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { reportsApi, locationsApi, personnelApi, movementsApi, customersApi } from '../services/api';
import { useOperator } from '../context/OperatorContext';
import OperatorWarning from '../components/OperatorWarning';
import PhotoCapture from '../components/PhotoCapture';
import { Icons } from '../components/Icons';

function CheckOut() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { operator, isOperatorSelected } = useOperator();
  const preselectedEquipmentId = searchParams.get('equipment');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [availableEquipment, setAvailableEquipment] = useState([]);
  const [locations, setLocations] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState(
    preselectedEquipmentId ? [preselectedEquipmentId] : []
  );
  const [formData, setFormData] = useState({
    destination_type: 'internal', // 'internal' or 'customer'
    location_id: '',
    customer_id: '',
    personnel_id: '',
    notes: '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (preselectedEquipmentId) {
      setSelectedEquipmentIds([preselectedEquipmentId]);
    }
  }, [preselectedEquipmentId]);

  const toggleEquipmentSelection = (equipmentId) => {
    const idStr = equipmentId.toString();
    setSelectedEquipmentIds(prev => {
      if (prev.includes(idStr)) {
        return prev.filter(id => id !== idStr);
      } else {
        return [...prev, idStr];
      }
    });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [equipmentRes, locationsRes, personnelRes, customersRes] = await Promise.all([
        reportsApi.getAvailable(),
        locationsApi.getAll(true),
        personnelApi.getAll(true),
        customersApi.getAll(),
      ]);

      setAvailableEquipment(Array.isArray(equipmentRes?.data) ? equipmentRes.data : []);
      setLocations(Array.isArray(locationsRes?.data) ? locationsRes.data : []);
      setPersonnel(Array.isArray(personnelRes?.data) ? personnelRes.data : []);
      setCustomers(Array.isArray(customersRes?.data) ? customersRes.data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Find customer name for notes if customer site selected
      const selectedCustomer = formData.destination_type === 'customer' && formData.customer_id && Array.isArray(customers)
        ? customers.find(c => c.id === parseInt(formData.customer_id))
        : null;

      const selectedItems = Array.isArray(availableEquipment) ? availableEquipment.filter(eq => 
        selectedEquipmentIds.includes(eq.id.toString())
      ) : [];

      const successNames = [];
      const errors = [];

      // Process each selected equipment
      for (const equipment of selectedItems) {
        try {
          const payload = {
            equipment_id: equipment.id,
            action: 'OUT',
            quantity: 1,
            location_id: formData.destination_type === 'internal' ? parseInt(formData.location_id) : null,
            customer_id: formData.destination_type === 'customer' ? parseInt(formData.customer_id) : null,
            personnel_id: parseInt(formData.personnel_id),
            notes: selectedCustomer 
              ? `Customer Site: ${selectedCustomer.display_name}${formData.notes ? ' | ' + formData.notes : ''}`
              : formData.notes,
            created_by: operator?.full_name || 'System',
          };

          // Only attach photo to first item
          await movementsApi.create(payload, successNames.length === 0 ? photoFile : null);
          successNames.push(equipment.equipment_name);
        } catch (err) {
          errors.push(`${equipment.equipment_name}: ${err.message}`);
        }
      }

      if (successNames.length > 0) {
        setSuccess(`Successfully checked out ${successNames.length} item(s): ${successNames.join(', ')}${selectedCustomer ? ` to ${selectedCustomer.display_name}` : ''}`);
      }
      if (errors.length > 0) {
        setError(`Failed to check out: ${errors.join('; ')}`);
      }

      // Reset form
      setSelectedEquipmentIds([]);
      setFormData({
        destination_type: 'internal',
        location_id: '',
        customer_id: '',
        personnel_id: '',
        notes: '',
      });
      setCustomerSearch('');
      setPhotoFile(null);
      setPhotoPreview(null);

      // Refresh available equipment
      const equipmentRes = await reportsApi.getAvailable();
      setAvailableEquipment(equipmentRes.data);

    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const filteredEquipment = Array.isArray(availableEquipment) ? availableEquipment.filter((eq) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      eq.equipment_id.toLowerCase().includes(term) ||
      eq.equipment_name.toLowerCase().includes(term) ||
      eq.serial_number?.toLowerCase().includes(term) ||
      eq.category?.toLowerCase().includes(term)
    );
  }) : [];

  const selectedEquipmentList = Array.isArray(availableEquipment) ? availableEquipment.filter(
    (eq) => selectedEquipmentIds.includes(eq.id.toString())
  ) : [];

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading...
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Check Out Equipment</h1>
          <p className="page-subtitle">Issue equipment to personnel</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      <OperatorWarning />

      {error && <div className="alert alert-error">{error}</div>}
      {success && (
        <div className="alert alert-success">
          {success}
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setSuccess(null)}
            style={{ marginLeft: 'auto' }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Equipment Selection */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Select Equipment</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {filteredEquipment.length} available
            </span>
          </div>

          <div className="form-group">
            <input
              type="text"
              className="form-input"
              placeholder="Search equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {filteredEquipment.length === 0 ? (
              <div className="empty-state">
                <p>No available equipment found</p>
              </div>
            ) : (
              filteredEquipment.map((eq) => {
                const isSelected = selectedEquipmentIds.includes(eq.id.toString());
                return (
                <div
                  key={eq.id}
                  onClick={() => toggleEquipmentSelection(eq.id)}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    background: isSelected ? 'rgba(25, 118, 210, 0.05)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                        background: isSelected ? 'var(--primary-color)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '14px',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}>
                        {isSelected && <Icons.Check size={14} />}
                      </div>
                      <div>
                        <strong>{eq.equipment_id}</strong>
                        <p style={{ margin: '4px 0', fontSize: '0.875rem' }}>{eq.equipment_name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {eq.category} → {eq.subcategory}
                        </p>
                        {eq.serial_number && (
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            S/N: {eq.serial_number}
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {eq.is_quantity_tracked ? (
                        <span style={{ fontSize: '0.8rem' }}>
                          {eq.available_quantity} {eq.unit} avail.
                        </span>
                      ) : (
                        <span className="badge badge-available">AVAILABLE</span>
                      )}
                      {eq.calibration_status && (
                        <span 
                          className={`badge ${
                            eq.calibration_status === 'Valid' ? 'badge-available' :
                            eq.calibration_status === 'Due Soon' ? 'badge-consumable' :
                            eq.calibration_status === 'Expired' ? 'badge-overdue' :
                            'badge-checked-out'
                          }`}
                          style={{ display: 'block', marginTop: '4px' }}
                        >
                          {eq.calibration_status === 'Valid' ? <><Icons.Check size={12} /> CALIBRATED</> :
                           eq.calibration_status === 'Due Soon' ? <><Icons.Clock size={12} /> CAL DUE SOON</> :
                           eq.calibration_status === 'Expired' ? <><Icons.Warning size={12} /> CAL EXPIRED</> :
                           <><Icons.Minus size={12} /> NOT CALIBRATED</>}
                        </span>
                      )}
                      {!eq.is_checkout_allowed && (
                        <span className="badge badge-overdue" style={{ marginLeft: '4px' }}>
                          No Checkout
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
              })
            )}
          </div>
        </div>

        {/* Checkout Form */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Checkout Details</h2>
          </div>

          <form onSubmit={handleSubmit}>
            {selectedEquipmentList.length > 0 ? (
              <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                <strong>Selected ({selectedEquipmentList.length}):</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                  {selectedEquipmentList.map(eq => (
                    <li key={eq.id} style={{ fontSize: '0.875rem' }}>
                      {eq.equipment_name}
                      {eq.serial_number && ` (S/N: ${eq.serial_number})`}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
                Select equipment from the list (click to select, click again to deselect)
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Issue To (Personnel) *</label>
              <select
                name="personnel_id"
                className="form-select"
                value={formData.personnel_id}
                onChange={handleChange}
                required
              >
                <option value="">Select person...</option>
                {personnel.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.employee_id} - {p.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Destination Type *</label>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="destination_type"
                    value="internal"
                    checked={formData.destination_type === 'internal'}
                    onChange={(e) => setFormData(prev => ({ ...prev, destination_type: e.target.value, customer_id: '', location_id: '' }))}
                  />
                  <span>Internal Location (Branch)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="destination_type"
                    value="customer"
                    checked={formData.destination_type === 'customer'}
                    onChange={(e) => setFormData(prev => ({ ...prev, destination_type: e.target.value, customer_id: '', location_id: '' }))}
                  />
                  <span>Customer Site</span>
                </label>
              </div>
            </div>

            {formData.destination_type === 'internal' ? (
              <div className="form-group">
                <label className="form-label">Destination Location *</label>
                <select
                  name="location_id"
                  className="form-select"
                  value={formData.location_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select branch location...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Customer Site *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search customers..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  style={{ marginBottom: '8px' }}
                />
                <select
                  name="customer_id"
                  className="form-select"
                  value={formData.customer_id}
                  onChange={handleChange}
                  required
                  size={5}
                  style={{ height: 'auto' }}
                >
                  {customers
                    .filter(c => {
                      if (!customerSearch) return true;
                      const term = customerSearch.toLowerCase();
                      return c.display_name.toLowerCase().includes(term) ||
                             c.customer_number?.toLowerCase().includes(term) ||
                             c.city?.toLowerCase().includes(term);
                    })
                    .slice(0, 50)
                    .map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.display_name} {cust.city ? `(${cust.city})` : ''} - {cust.region}
                      </option>
                    ))}
                </select>
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  {customers.filter(c => {
                    if (!customerSearch) return true;
                    const term = customerSearch.toLowerCase();
                    return c.display_name.toLowerCase().includes(term) ||
                           c.customer_number?.toLowerCase().includes(term) ||
                           c.city?.toLowerCase().includes(term);
                  }).length} customers found
                </small>
              </div>
            )}

            {selectedEquipmentList.some(eq => eq.is_quantity_tracked) && (
              <div className="form-group">
                <label className="form-label">
                  Quantity * (Available: {selectedEquipmentList.find(eq => eq.is_quantity_tracked)?.available_quantity} {selectedEquipmentList.find(eq => eq.is_quantity_tracked)?.unit})
                </label>
                <input
                  type="number"
                  name="quantity"
                  className="form-input"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="1"
                  max={selectedEquipmentList.find(eq => eq.is_quantity_tracked)?.available_quantity}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Photo (Optional)</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  onClick={() => setShowCamera(true)}
                  style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Icons.Camera size={16} /> Take Photo
                </button>
                <label className="btn btn-secondary" style={{ cursor: 'pointer', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icons.Image size={16} /> Choose from Gallery
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              {photoPreview && (
                <div style={{ position: 'relative', display: 'inline-block', marginTop: '8px' }}>
                  <img 
                    src={photoPreview} 
                    alt="Preview" 
                    style={{ 
                      maxWidth: '200px', 
                      maxHeight: '150px', 
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)'
                    }} 
                  />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      background: 'var(--error-color)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      lineHeight: '24px'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Notes (Optional)</label>
              <textarea
                name="notes"
                className="form-textarea"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Purpose, expected return date, special instructions..."
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={
                  !formData.equipment_id || 
                  !formData.personnel_id || 
                  (formData.destination_type === 'internal' ? !formData.location_id : !formData.customer_id) ||
                  submitting
                }
                style={{ flex: 1 }}
              >
                {submitting ? 'Processing...' : 'Check Out Equipment'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showCamera && (
        <PhotoCapture
          onPhotoCapture={(file, preview) => {
            setPhotoFile(file);
            setPhotoPreview(preview);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

export default CheckOut;
