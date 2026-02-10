import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { reportsApi, locationsApi, movementsApi } from '../services/api';
import { useOperator } from '../context/OperatorContext';
import OperatorWarning from '../components/OperatorWarning';
import PhotoCapture from '../components/PhotoCapture';
import { Icons } from '../components/Icons';

function CheckIn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { operator, isOperatorSelected } = useOperator();
  const preselectedEquipmentId = searchParams.get('equipment');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [checkedOutEquipment, setCheckedOutEquipment] = useState([]);
  const [locations, setLocations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    equipment_id: preselectedEquipmentId || '',
    location_id: '',
    quantity: 1,
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
      setFormData((prev) => ({ ...prev, equipment_id: preselectedEquipmentId }));
    }
  }, [preselectedEquipmentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [equipmentRes, locationsRes] = await Promise.all([
        reportsApi.getCheckedOut(),
        locationsApi.getAll(true),
      ]);

      setCheckedOutEquipment(Array.isArray(equipmentRes?.data) ? equipmentRes.data : []);
      setLocations(Array.isArray(locationsRes?.data) ? locationsRes.data : []);
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
      const selectedEquipment = checkedOutEquipment.find(
        (eq) => eq.id === parseInt(formData.equipment_id)
      );

      const payload = {
        equipment_id: parseInt(formData.equipment_id),
        action: 'IN',
        quantity: 1, // For equipment, always 1
        location_id: parseInt(formData.location_id),
        notes: formData.notes,
        created_by: operator?.full_name || 'System',
      };

      await movementsApi.create(payload, photoFile);

      setSuccess(`Successfully returned: ${selectedEquipment?.equipment_name}`);

      // Reset form
      setFormData({
        equipment_id: '',
        location_id: '',
        quantity: 1,
        notes: '',
      });
      setPhotoFile(null);
      setPhotoPreview(null);

      // Refresh checked out equipment
      const equipmentRes = await reportsApi.getCheckedOut();
      setCheckedOutEquipment(equipmentRes.data);

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

  const filteredEquipment = Array.isArray(checkedOutEquipment) ? checkedOutEquipment.filter((eq) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      eq.equipment_id.toLowerCase().includes(term) ||
      eq.equipment_name.toLowerCase().includes(term) ||
      eq.serial_number?.toLowerCase().includes(term) ||
      eq.checked_out_to?.toLowerCase().includes(term) ||
      eq.current_location?.toLowerCase().includes(term)
    );
  }) : [];

  const selectedEquipment = Array.isArray(checkedOutEquipment) ? checkedOutEquipment.find(
    (eq) => eq.id === parseInt(formData.equipment_id)
  ) : null;

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
          <h1 className="page-title">Check In Equipment</h1>
          <p className="page-subtitle">Return equipment to store</p>
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
            <h2 className="card-title">Checked Out Equipment</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {filteredEquipment.length} items out
            </span>
          </div>

          <div className="form-group">
            <input
              type="text"
              className="form-input"
              placeholder="Search by equipment, person, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {filteredEquipment.length === 0 ? (
              <div className="empty-state">
                <p>No equipment currently checked out</p>
              </div>
            ) : (
              filteredEquipment.map((eq) => (
                <div
                  key={eq.id}
                  onClick={() => setFormData((prev) => ({ ...prev, equipment_id: eq.id.toString() }))}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    border: `2px solid ${formData.equipment_id === eq.id.toString() ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    background: formData.equipment_id === eq.id.toString() ? 'rgba(25, 118, 210, 0.05)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
                    <div style={{ textAlign: 'right' }}>
                      {eq.is_overdue ? (
                        <span className="badge badge-overdue">Overdue</span>
                      ) : (
                        <span className="badge badge-checked-out">Checked Out</span>
                      )}
                      <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                        {eq.days_out} days out
                      </p>
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', padding: '8px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                    <strong>With:</strong> {eq.checked_out_to} ({eq.holder_employee_id})
                    <br />
                    <strong>At:</strong> {eq.current_location}
                    <br />
                    <strong>Since:</strong> {formatDate(eq.checked_out_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Check-in Form */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Return Details</h2>
          </div>

          <form onSubmit={handleSubmit}>
            {selectedEquipment ? (
              <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                <div>
                  <strong>Returning:</strong> {selectedEquipment.equipment_name}
                  {selectedEquipment.serial_number && ` (S/N: ${selectedEquipment.serial_number})`}
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.875rem' }}>
                  <strong>Currently with:</strong> {selectedEquipment.checked_out_to}
                </div>
                <div style={{ fontSize: '0.875rem' }}>
                  <strong>Location:</strong> {selectedEquipment.current_location}
                </div>
                {selectedEquipment.is_overdue && (
                  <div style={{ marginTop: '8px', color: 'var(--error-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icons.Warning size={16} /> This item is overdue by {selectedEquipment.days_out - 14} days
                  </div>
                )}
              </div>
            ) : (
              <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
                Select equipment to return from the list
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Return Location *</label>
              <select
                name="location_id"
                className="form-select"
                value={formData.location_id}
                onChange={handleChange}
                required
              >
                <option value="">Select return location...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

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
                placeholder="Condition notes, issues, remarks..."
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="submit"
                className="btn btn-success btn-lg"
                disabled={!formData.equipment_id || !formData.location_id || submitting}
                style={{ flex: 1 }}
              >
                {submitting ? 'Processing...' : 'Check In Equipment'}
              </button>
            </div>
          </form>

          {/* Quick Handover Option */}
          {selectedEquipment && (
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '0.875rem', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                Quick Handover
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Need to transfer this equipment directly to another person?
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate(`/check-out?equipment=${selectedEquipment.id}`)}
              >
                Return & Re-issue →
              </button>
            </div>
          )}
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

export default CheckIn;
