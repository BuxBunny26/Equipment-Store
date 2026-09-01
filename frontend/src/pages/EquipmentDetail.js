import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { equipmentApi, calibrationApi, categoriesApi, subcategoriesApi } from '../services/api';
import EquipmentImageGallery from '../components/EquipmentImageGallery';
import { getCustomFieldRule, getCustomFieldValue } from '../utils/customFields';
import { useOperator } from '../context/OperatorContext';
import { pickCurrentCalibrationRecord } from '../utils/calibrationCurrent';

// Formats free-typed digits into DD/MM/YYYY, auto-inserting "/" -- built
// from the browser's own post-edit value each time, so native cursor and
// Backspace/Delete behaviour is never fought or reconstructed.
// Duplicated from Calibration.js (not imported) because that file mixes in
// unrelated in-progress work -- keeping this pure/local avoids touching it.
function formatDateInputChange(rawValue) {
  const digits = rawValue.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// Converts a complete DD/MM/YYYY string to YYYY-MM-DD, or null if it's
// incomplete or not a real calendar date (e.g. 31/04/2026, 29/02/2025).
function displayDateToIso(displayValue) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(displayValue || '');
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

// Converts a YYYY-MM-DD string to DD/MM/YYYY for display (e.g. today's default).
function isoDateToDisplay(isoValue) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoValue || '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function EquipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { operatorRole } = useOperator();
  const isAdmin = operatorRole && ['admin', 'manager'].includes(operatorRole.toLowerCase());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [history, setHistory] = useState([]);
  const [calibrationHistory, setCalibrationHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('details');
  const [editingChannel, setEditingChannel] = useState(false);
  const [channelValue, setChannelValue] = useState('');
  const [savingChannel, setSavingChannel] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const [catEditCatId, setCatEditCatId] = useState('');
  const [catEditSubId, setCatEditSubId] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [availableCats, setAvailableCats] = useState([]);
  const [availableSubs, setAvailableSubs] = useState([]);
  const [editingBasicInfo, setEditingBasicInfo] = useState(false);
  const [basicInfoName, setBasicInfoName] = useState('');
  const [basicInfoDescription, setBasicInfoDescription] = useState('');
  const [savingBasicInfo, setSavingBasicInfo] = useState(false);
  const [basicInfoEditError, setBasicInfoEditError] = useState(null);
  const [showAddCalibrationModal, setShowAddCalibrationModal] = useState(false);
  const [calibrationForm, setCalibrationForm] = useState({
    equipment_id: '',
    calibration_date: '',
    expiry_date: '',
    certificate_number: '',
    calibration_provider: '',
    notes: '',
  });
  const [calibrationFile, setCalibrationFile] = useState(null);
  const [calibrationSubmitting, setCalibrationSubmitting] = useState(false);
  const [calibrationAddError, setCalibrationAddError] = useState(null);
  const [calibrationAddSuccess, setCalibrationAddSuccess] = useState(null);

  useEffect(() => {
    fetchEquipment();
    fetchHistory();
    fetchCalibrationHistory();
  }, [id]);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const response = await equipmentApi.getById(id);
      setEquipment(response.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCategoryEdit = async () => {
    try {
      const [catRes, subRes] = await Promise.all([
        categoriesApi.getAll(),
        subcategoriesApi.getAll(equipment.category_id),
      ]);
      setAvailableCats(catRes.data || []);
      setAvailableSubs(subRes.data || []);
      setCatEditCatId(equipment.category_id?.toString() || '');
      setCatEditSubId(equipment.subcategory_id?.toString() || '');
      setEditingCategory(true);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const handleCatEditCategoryChange = async (newCatId) => {
    setCatEditCatId(newCatId);
    setCatEditSubId('');
    if (newCatId) {
      try {
        const { data } = await subcategoriesApi.getAll(newCatId);
        setAvailableSubs(data || []);
      } catch (err) {
        setAvailableSubs([]);
      }
    } else {
      setAvailableSubs([]);
    }
  };

  const handleSaveCategory = async () => {
    if (!catEditCatId || !catEditSubId) return;
    setSavingCategory(true);
    try {
      await equipmentApi.update(equipment.id, {
        category_id: parseInt(catEditCatId),
        subcategory_id: parseInt(catEditSubId),
      });
      const selectedCat = availableCats.find(c => c.id.toString() === catEditCatId);
      const selectedSub = availableSubs.find(s => s.id.toString() === catEditSubId);
      setEquipment(prev => ({
        ...prev,
        category_id: parseInt(catEditCatId),
        subcategory_id: parseInt(catEditSubId),
        category_name: selectedCat?.name || prev.category_name,
        subcategory_name: selectedSub?.name || prev.subcategory_name,
        is_checkout_allowed: selectedCat?.is_checkout_allowed ?? prev.is_checkout_allowed,
        is_consumable: selectedCat?.is_consumable ?? prev.is_consumable,
      }));
      setEditingCategory(false);
    } catch (err) {
      console.error('Failed to save category:', err);
    } finally {
      setSavingCategory(false);
    }
  };

  const openBasicInfoEdit = () => {
    setBasicInfoName(equipment.equipment_name || '');
    setBasicInfoDescription(equipment.description || '');
    setBasicInfoEditError(null);
    setEditingBasicInfo(true);
  };

  const handleCancelBasicInfoEdit = () => {
    setEditingBasicInfo(false);
    setBasicInfoEditError(null);
  };

  const handleSaveBasicInfo = async () => {
    const trimmedName = basicInfoName.trim();
    if (!trimmedName) {
      setBasicInfoEditError('Equipment Name is required');
      return;
    }
    setSavingBasicInfo(true);
    setBasicInfoEditError(null);
    try {
      const trimmedDescription = basicInfoDescription.trim() || null;
      await equipmentApi.update(equipment.id, {
        equipment_name: trimmedName,
        description: trimmedDescription,
      });
      setEquipment(prev => ({ ...prev, equipment_name: trimmedName, description: trimmedDescription }));
      setEditingBasicInfo(false);
    } catch (err) {
      setBasicInfoEditError('Error saving changes: ' + err.message);
    } finally {
      setSavingBasicInfo(false);
    }
  };

  const handleSaveChannel = async (rule) => {
    setSavingChannel(true);
    try {
      const existing = typeof equipment.custom_fields === 'string'
        ? JSON.parse(equipment.custom_fields || '{}')
        : (equipment.custom_fields || {});
      const updated = { ...existing, [rule.field]: channelValue };
      await equipmentApi.update(equipment.id, { custom_fields: updated });
      setEquipment(prev => ({ ...prev, custom_fields: updated }));
      setEditingChannel(false);
    } catch (err) {
      console.error('Failed to save channel:', err);
    } finally {
      setSavingChannel(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await equipmentApi.getHistory(id, 100);
      setHistory(response.data);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const fetchCalibrationHistory = async () => {
    try {
      const response = await calibrationApi.getHistory(id);
      setCalibrationHistory(response.data);
    } catch (err) {
      console.error('Error fetching calibration history:', err);
    }
  };

  const openAddCalibration = () => {
    setCalibrationForm({
      equipment_id: equipment.id,
      calibration_date: isoDateToDisplay(new Date().toISOString().split('T')[0]),
      expiry_date: '',
      certificate_number: '',
      calibration_provider: '',
      notes: '',
    });
    setCalibrationFile(null);
    setCalibrationAddError(null);
    setShowAddCalibrationModal(true);
  };

  const handleCloseAddCalibrationModal = () => {
    setShowAddCalibrationModal(false);
    setCalibrationAddError(null);
  };

  const handleAddCalibrationSubmit = async (e) => {
    e.preventDefault();
    if (calibrationFile && calibrationFile.size > 10 * 1024 * 1024) {
      setCalibrationAddError('Certificate file must be less than 10MB');
      return;
    }
    const isoCalibrationDate = displayDateToIso(calibrationForm.calibration_date);
    if (!isoCalibrationDate) {
      setCalibrationAddError('Calibration date must be a valid date in DD/MM/YYYY format');
      return;
    }
    const isoExpiryDate = calibrationForm.expiry_date ? displayDateToIso(calibrationForm.expiry_date) : null;
    if (calibrationForm.expiry_date && !isoExpiryDate) {
      setCalibrationAddError('Expiry date must be a valid date in DD/MM/YYYY format');
      return;
    }
    if (isoExpiryDate && isoExpiryDate < isoCalibrationDate) {
      setCalibrationAddError('Expiry date cannot be before calibration date');
      return;
    }
    setCalibrationSubmitting(true);
    try {
      await calibrationApi.create(
        { ...calibrationForm, calibration_date: isoCalibrationDate, expiry_date: isoExpiryDate },
        calibrationFile
      );
      setShowAddCalibrationModal(false);
      setCalibrationAddError(null);
      await fetchCalibrationHistory();
      setCalibrationAddSuccess('Calibration record added successfully!');
      setTimeout(() => setCalibrationAddSuccess(null), 5000);
    } catch (err) {
      setCalibrationAddError('Error adding calibration: ' + err.message);
    } finally {
      setCalibrationSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateOnly = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getCalibrationStatusBadge = (expiryDate) => {
    if (!expiryDate) return <span className="badge" style={{ background: 'var(--text-secondary)' }}>Not Calibrated</span>;
    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) return <span className="badge" style={{ background: 'var(--text-secondary)' }}>Not Calibrated</span>;
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return <span className="badge badge-expired" style={{ background: 'var(--error-color)' }}>Expired</span>;
    } else if (daysUntilExpiry <= 30) {
      return <span className="badge badge-due-soon" style={{ background: 'var(--warning-color)' }}>Due Soon ({daysUntilExpiry} days)</span>;
    }
    return <span className="badge badge-valid" style={{ background: 'var(--success-color)' }}>Valid</span>;
  };

  const openCertificate = (record) => {
    if (record.certificate_file_url) {
      window.open(record.certificate_file_url, '_blank', 'noopener,noreferrer');
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
        <div className="btn-group-wrap">
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

          {equipment.status === 'Checked Out' && history.length > 0 && (() => {
            const latestOut = history.find(m => m.action === 'OUT');
            if (!latestOut?.expected_return_date) return null;
            const isOverdue = new Date() > new Date(latestOut.expected_return_date);
            return (
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Expected Return</p>
                <p style={{ fontWeight: 500, color: isOverdue ? 'var(--error-color)' : 'inherit' }}>
                  {formatDateOnly(latestOut.expected_return_date)}
                  {isOverdue && ' (Overdue)'}
                </p>
              </div>
            );
          })()}

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
        <button
          className={`tab ${activeTab === 'images' ? 'active' : ''}`}
          onClick={() => setActiveTab('images')}
        >
          Images
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                Basic Information
                {isAdmin && !editingBasicInfo && (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={openBasicInfoEdit}
                    style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                    title="Edit name and description"
                  >
                    Edit
                  </button>
                )}
              </h3>
              {editingBasicInfo ? (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {basicInfoEditError && <div className="alert alert-error" style={{ fontSize: '0.8rem', padding: '6px 10px' }}>{basicInfoEditError}</div>}
                  <div>
                    <dt style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Equipment ID</dt>
                    <dd style={{ fontWeight: 500 }}>{equipment.equipment_id}</dd>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Equipment Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={basicInfoName}
                      onChange={e => setBasicInfoName(e.target.value)}
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Description</label>
                    <textarea
                      className="form-input"
                      value={basicInfoDescription}
                      onChange={e => setBasicInfoDescription(e.target.value)}
                      rows={3}
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={handleSaveBasicInfo}
                      disabled={savingBasicInfo}
                      style={{ fontSize: '0.78rem' }}
                    >
                      {savingBasicInfo ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={handleCancelBasicInfoEdit}
                      disabled={savingBasicInfo}
                      style={{ fontSize: '0.78rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
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
              )}
            </div>

            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                Classification
                {isAdmin && !editingCategory && (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={openCategoryEdit}
                    style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                    title="Reassign category"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" style={{ display: 'inline', marginRight: 3 }}>
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Reassign
                  </button>
                )}
              </h3>
              {editingCategory ? (
                <div style={{ display: 'grid', gap: '10px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Category</label>
                    <select
                      className="form-select"
                      value={catEditCatId}
                      onChange={e => handleCatEditCategoryChange(e.target.value)}
                      style={{ fontSize: '0.85rem' }}
                    >
                      <option value="">Select category...</option>
                      {availableCats.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}{cat.is_consumable ? ' (Consumable)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Subcategory</label>
                    <select
                      className="form-select"
                      value={catEditSubId}
                      onChange={e => setCatEditSubId(e.target.value)}
                      disabled={!catEditCatId}
                      style={{ fontSize: '0.85rem' }}
                    >
                      <option value="">Select subcategory...</option>
                      {availableSubs.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={handleSaveCategory}
                      disabled={!catEditCatId || !catEditSubId || savingCategory}
                      style={{ fontSize: '0.78rem' }}
                    >
                      {savingCategory ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setEditingCategory(false)}
                      style={{ fontSize: '0.78rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
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
              )}
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
                {/* Custom fields — e.g. AMS2140 channel count */}
                {(() => {
                  const rule = getCustomFieldRule(equipment.equipment_name, equipment.model);
                  if (!rule) return null;
                  const currentVal = getCustomFieldValue(equipment.custom_fields, rule.field);
                  return (
                    <div>
                      <dt style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{rule.label}</dt>
                      <dd style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {editingChannel ? (
                          <>
                            <select
                              value={channelValue}
                              onChange={e => setChannelValue(e.target.value)}
                              style={{
                                padding: '4px 8px', borderRadius: 6,
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                              }}
                            >
                              <option value="">Select...</option>
                              {rule.options.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleSaveChannel(rule)}
                              disabled={!channelValue || savingChannel}
                              style={{ fontSize: '0.78rem' }}
                            >
                              {savingChannel ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => setEditingChannel(false)}
                              style={{ fontSize: '0.78rem' }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <span style={{ fontWeight: 500 }}>{currentVal || '-'}</span>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => { setChannelValue(currentVal || ''); setEditingChannel(true); }}
                              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                              title={`Edit ${rule.label}`}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" style={{ display: 'inline', marginRight: 3 }}>
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              Edit
                            </button>
                          </>
                        )}
                      </dd>
                    </div>
                  );
                })()}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Calibration Records
            </h3>
            <button className="btn btn-sm btn-primary" onClick={openAddCalibration} title="Add Calibration Record">
              + Add Calibration
            </button>
          </div>
          {calibrationAddSuccess && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{calibrationAddSuccess}</div>}
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
                    <th>Current</th>
                    <th>Calibration Date</th>
                    <th>Expiry Date</th>
                    <th>Status</th>
                    <th>Certificate #</th>
                    <th>Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const currentRecordId = pickCurrentCalibrationRecord(calibrationHistory)?.id;
                    return calibrationHistory.map((record) => (
                      <tr key={record.id}>
                        <td>{record.id === currentRecordId && <span className="badge badge-valid" style={{ background: 'var(--success-color)' }}>Current</span>}</td>
                        <td>{formatDateOnly(record.calibration_date)}</td>
                        <td>{formatDateOnly(record.expiry_date)}</td>
                        <td>{getCalibrationStatusBadge(record.expiry_date)}</td>
                        <td style={{ fontWeight: 500 }}>{record.certificate_number || '-'}</td>
                        <td>
                          {record.certificate_file_url ? (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => openCertificate(record)}
                              title="View Certificate"
                            >
                              📄 View
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No file</span>
                          )}
                        </td>
                      </tr>
                    ));
                  })()}
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
                    <th>Photo</th>
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
                      <td>
                        {movement.photo_url ? (
                          <a href={movement.photo_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={movement.photo_url}
                              alt="Movement photo"
                              style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                            />
                          </a>
                        ) : '-'}
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

      {activeTab === 'images' && (
        <div className="card">
          <EquipmentImageGallery equipmentId={equipment.id} editable={true} />
        </div>
      )}

      {/* Add Calibration Modal */}
      {showAddCalibrationModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Calibration Record</h2>
              <button className="modal-close" onClick={handleCloseAddCalibrationModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="equipment-info" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '4px' }}>
                <strong>{equipment.equipment_name}</strong>
                <br />
                <span style={{ color: 'var(--text-secondary)' }}>
                  {equipment.equipment_id}{equipment.serial_number ? ` | Serial: ${equipment.serial_number}` : ''}
                </span>
              </div>

              {calibrationAddError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{calibrationAddError}</div>}

              <form onSubmit={handleAddCalibrationSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Calibration Date *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="DD/MM/YYYY"
                      maxLength={10}
                      className="form-input"
                      value={calibrationForm.calibration_date}
                      onChange={(e) => setCalibrationForm({ ...calibrationForm, calibration_date: formatDateInputChange(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiry Date *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="DD/MM/YYYY"
                      maxLength={10}
                      className="form-input"
                      value={calibrationForm.expiry_date}
                      onChange={(e) => setCalibrationForm({ ...calibrationForm, expiry_date: formatDateInputChange(e.target.value) })}
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
                    onChange={(e) => setCalibrationFile(e.target.files[0])}
                  />
                  <small style={{ color: 'var(--text-secondary)' }}>Max 10MB. Accepted: PDF, JPEG, PNG, TIFF, DOC, DOCX</small>
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
                  <button type="button" className="btn btn-secondary" onClick={handleCloseAddCalibrationModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={calibrationSubmitting}>
                    {calibrationSubmitting ? 'Saving...' : 'Save Calibration Record'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EquipmentDetail;
