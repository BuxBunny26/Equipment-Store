import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { reportsApi, locationsApi, personnelApi, movementsApi, customersApi } from '../services/api';
import { useOperator } from '../context/OperatorContext';
import OperatorWarning from '../components/OperatorWarning';
import PhotoCapture from '../components/PhotoCapture';
import AddEquipmentModal from '../components/AddEquipmentModal';
import { Icons } from '../components/Icons';

function CheckOut() {
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingSubmit, setPendingSubmit] = useState(null);
    const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { operator, isOperatorSelected } = useOperator();
  const preselectedEquipmentId = searchParams.get('equipment');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [availableEquipment, setAvailableEquipment] = useState([]);
  const [checkedOutEquipment, setCheckedOutEquipment] = useState([]);
  const [locations, setLocations] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState(
    preselectedEquipmentId ? [preselectedEquipmentId] : []
  );
  const [formData, setFormData] = useState({
    destination_type: 'internal', // 'internal', 'customer', 'calibration', 'transfer'
    location_id: '',
    customer_id: '',
    personnel_id: '',
    receiving_personnel_id: '',
    notes: '',
    condition: '',
    reason: '',
    calibration_provider: '',
    from_site_id: '',
    to_site_id: '',
    quantity: '',
  });
    // Helper: Should show reason field?
    const shouldShowReason = () => {
      if (!formData.condition) return false;
      return formData.condition !== 'Excellent';
    };

    // Inline help for condition logic
    const conditionHelp = shouldShowReason()
      ? 'A reason is required for non-Excellent or worsened conditions.'
      : 'Select the current condition. If not Excellent or worsened, a reason is required.';
  const [lastConditions, setLastConditions] = useState({});
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

  // Default personnel to current operator
  useEffect(() => {
    if (operator && personnel.length > 0 && !formData.personnel_id) {
      const match = personnel.find(p => p.employee_id === operator.employee_id);
      if (match) {
        setFormData(prev => ({ ...prev, personnel_id: match.id.toString() }));
      }
    }
  }, [operator, personnel]);

  // Fetch last condition for selected equipment
  useEffect(() => {
    const fetchLastConditions = async () => {
      const conditions = {};
      for (const idStr of selectedEquipmentIds) {
        try {
          const res = await movementsApi.getAll({ equipment_id: parseInt(idStr), action: 'OUT', limit: 1 });
          if (res.data && res.data.length > 0) {
            const movement = res.data[0];
            const conditionMatch = movement.notes?.match(/Condition:\s*(Excellent|Good|Poor)/i);
            if (conditionMatch) {
              conditions[idStr] = {
                condition: conditionMatch[1],
                date: new Date(movement.created_at).toLocaleDateString('en-GB'),
              };
            } else {
              conditions[idStr] = null;
            }
          } else {
            conditions[idStr] = null;
          }
        } catch {
          conditions[idStr] = null;
        }
      }
      setLastConditions(conditions);
    };
    if (selectedEquipmentIds.length > 0) {
      fetchLastConditions();
    } else {
      setLastConditions({});
    }
  }, [selectedEquipmentIds]);

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
      const [equipmentRes, checkedOutRes, locationsRes, personnelRes, customersRes] = await Promise.all([
        reportsApi.getAvailable(),
        reportsApi.getCheckedOut(),
        locationsApi.getAll(true),
        personnelApi.getAll(true),
        customersApi.getAll(),
      ]);

      setAvailableEquipment(equipmentRes.data);
      setCheckedOutEquipment(checkedOutRes.data || []);
      setLocations(locationsRes.data);
      setPersonnel(personnelRes.data);
      setCustomers(customersRes.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPendingSubmit(() => () => {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      submitCheckout();
    });
    setShowConfirm(true);
  };

  const submitCheckout = async () => {
    try {
      // Sanitize input
      const sanitize = (str) =>
        typeof str === 'string' ? str.replace(/[<>]/g, '').trim() : str;

      // Find customer name for notes if customer site selected
      const selectedCustomer = formData.destination_type === 'customer' && formData.customer_id
        ? customers.find(c => c.id === parseInt(formData.customer_id))
        : null;

      const receivingPerson = (formData.destination_type === 'customer' || formData.destination_type === 'transfer') && formData.receiving_personnel_id
        ? personnel.find(p => p.id === parseInt(formData.receiving_personnel_id))
        : null;

      const sourceEquipment = formData.destination_type === 'transfer' ? checkedOutEquipment : availableEquipment;
      const selectedItems = sourceEquipment.filter(eq => 
        selectedEquipmentIds.includes(eq.id.toString())
      );

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
            customer_id: formData.destination_type === 'customer' ? parseInt(formData.customer_id)
              : formData.destination_type === 'transfer' ? parseInt(formData.to_site_id)
              : null,
            personnel_id: parseInt(formData.personnel_id),
            is_transfer: formData.destination_type === 'transfer',
            notes: sanitize([
              formData.condition ? `Condition: ${formData.condition}` : null,
              formData.reason ? `Reason: ${formData.reason}` : null,
              selectedCustomer ? `Customer Site: ${selectedCustomer.display_name}` : null,
              receivingPerson ? `Receiving: ${receivingPerson.full_name}` : null,
              sanitize(formData.notes) || null,
            ].filter(Boolean).join(' | ')),
            reason: sanitize(formData.reason),
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
        const itemText = `${successNames.length} item(s): ${successNames.join(', ')}`;
        let actionText;
        if (formData.destination_type === 'internal') {
          const destLoc = locations.find(l => l.id === parseInt(formData.location_id));
          actionText = `Successfully transferred ${itemText} to ${destLoc?.name || 'internal location'}`;
        } else if (formData.destination_type === 'customer') {
          actionText = `Successfully checked out ${itemText}${selectedCustomer ? ` to ${selectedCustomer.display_name}` : ''}`;
        } else if (formData.destination_type === 'calibration') {
          actionText = `Successfully sent ${itemText} for calibration${formData.calibration_provider ? ` (${formData.calibration_provider})` : ''}`;
        } else if (formData.destination_type === 'transfer') {
          const fromSites = [...new Set(selectedItems.map(eq => eq.current_location).filter(Boolean))];
          const toSite = customers.find(c => c.id === parseInt(formData.to_site_id));
          actionText = `Successfully transferred ${itemText}${fromSites.length > 0 ? ` from ${fromSites.join(', ')}` : ''}${toSite ? ` to ${toSite.display_name}` : ''}`;
        } else {
          actionText = `Successfully checked out ${itemText}`;
        }
        setSuccess(actionText);
        setTimeout(() => setSuccess(null), 5000);
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
        receiving_personnel_id: '',
        notes: '',
        condition: '',
        reason: '',
        calibration_provider: '',
        from_site_id: '',
        to_site_id: '',
        quantity: '',
      });
      setPhotoFile(null);
      setPhotoPreview(null);

      // Refresh equipment lists
      const [equipmentRes, checkedOutRes] = await Promise.all([
        reportsApi.getAvailable(),
        reportsApi.getCheckedOut(),
      ]);
      setAvailableEquipment(equipmentRes.data);
      setCheckedOutEquipment(checkedOutRes.data || []);

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

  // Use checked-out equipment for transfers, available equipment for everything else
  const displayEquipment = formData.destination_type === 'transfer' ? checkedOutEquipment : availableEquipment;

  // Get unique categories from displayed equipment
  const categories = [...new Set(displayEquipment.map(eq => eq.category).filter(Boolean))].sort();

  const filteredEquipment = displayEquipment.filter((eq) => {
    // Filter by selected category/technology first
    if (selectedCategory && eq.category !== selectedCategory) return false;
    if (!debouncedSearchTerm) return true;
    const term = debouncedSearchTerm.toLowerCase();
    return (
      eq.equipment_id.toLowerCase().includes(term) ||
      eq.equipment_name.toLowerCase().includes(term) ||
      eq.serial_number?.toLowerCase().includes(term) ||
      eq.category?.toLowerCase().includes(term)
    );
  });

  const selectedEquipmentList = displayEquipment.filter(
    (eq) => selectedEquipmentIds.includes(eq.id.toString())
  );

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
          &larr; Back
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
            &times;
          </button>
        </div>
      )}

      <div className="two-column-grid">
        {/* Equipment Selection */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="card-title">{formData.destination_type === 'transfer' ? 'Select Checked Out Equipment' : 'Select Equipment'}</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {filteredEquipment.length} {formData.destination_type === 'transfer' ? 'checked out' : 'available'}
              </span>
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => setShowAddEquipment(true)}>
              + Add New
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Technology *</label>
            <select
              className="form-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Technologies</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
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

          <div className="equipment-selection-list">
            {filteredEquipment.length === 0 ? (
              <div className="empty-state">
                <p>No {formData.destination_type === 'transfer' ? 'checked out' : 'available'} equipment found</p>
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
                    background: isSelected ? 'rgba(var(--primary-rgb, 25, 118, 210), 0.05)' : 'transparent',
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
                          {eq.category} &rarr; {eq.subcategory}
                        </p>
                        {eq.serial_number && (
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            S/N: {eq.serial_number}
                          </p>
                        )}
                        {eq.current_location && (
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            📍 {eq.current_location}
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {formData.destination_type === 'transfer' ? (
                        <>
                          <span className="badge badge-checked-out">Checked Out</span>
                          {eq.checked_out_to && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {eq.checked_out_to}
                            </p>
                          )}
                          {eq.days_out != null && (
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              {eq.days_out} day{eq.days_out !== 1 ? 's' : ''} out
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                      {eq.is_quantity_tracked ? (
                        <span style={{ fontSize: '0.8rem' }}>
                          {eq.available_quantity} {eq.unit} avail.
                        </span>
                      ) : (
                        <span className="badge badge-available">Available</span>
                      )}
                      <span 
                        className={`badge ${
                          eq.calibration_status === 'Valid' ? 'badge-available' :
                          eq.calibration_status === 'Due Soon' ? 'badge-consumable' :
                          eq.calibration_status === 'Expired' ? 'badge-overdue' :
                          'badge-checked-out'
                        }`}
                        style={{ display: 'block', marginTop: '4px' }}
                      >
                        {eq.calibration_status === 'Valid' ? <><Icons.Check size={12} /> Calibrated</> :
                         eq.calibration_status === 'Due Soon' ? <><Icons.Clock size={12} /> Cal Due Soon</> :
                         eq.calibration_status === 'Expired' ? <><Icons.Warning size={12} /> Cal Expired</> :
                         <><Icons.Minus size={12} /> Not Calibrated</>}
                      </span>
                      {!eq.is_checkout_allowed && (
                        <span className="badge badge-overdue" style={{ marginLeft: '4px' }}>
                          No Checkout
                        </span>
                      )}
                        </>
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
                  {showConfirm && (
                    <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.7)' }}>
                      <div className="modal" style={{ padding: '24px', borderRadius: '8px', maxWidth: '400px', margin: 'auto' }}>
                        <h2>Confirm Checkout</h2>
                        <p>Are you sure you want to check out the selected equipment?</p>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '24px', justifyContent: 'center' }}>
                          <button className="btn btn-primary" onClick={() => { setShowConfirm(false); pendingSubmit && pendingSubmit(); }}>Yes, Proceed</button>
                          <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
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
                    {p.employee_id} - {p.first_name === p.last_name ? p.first_name : `${p.first_name} ${p.last_name}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Destination Type *</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    name="destination_type"
                    value="internal"
                    checked={formData.destination_type === 'internal'}
                    onChange={(e) => { setSelectedEquipmentIds([]); setFormData(prev => ({ ...prev, destination_type: e.target.value, customer_id: '', location_id: '', calibration_provider: '', from_site_id: '', to_site_id: '', receiving_personnel_id: '' })); }}
                  />
                  <span>Internal Location (Branch)</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="destination_type"
                    value="customer"
                    checked={formData.destination_type === 'customer'}
                    onChange={(e) => { setSelectedEquipmentIds([]); setFormData(prev => ({ ...prev, destination_type: e.target.value, customer_id: '', location_id: '', calibration_provider: '', from_site_id: '', to_site_id: '', receiving_personnel_id: '' })); }}
                  />
                  <span>Customer Site</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="destination_type"
                    value="calibration"
                    checked={formData.destination_type === 'calibration'}
                    onChange={(e) => { setSelectedEquipmentIds([]); setFormData(prev => ({ ...prev, destination_type: e.target.value, customer_id: '', location_id: '', calibration_provider: '', from_site_id: '', to_site_id: '', receiving_personnel_id: '' })); }}
                  />
                  <span>Calibration</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="destination_type"
                    value="transfer"
                    checked={formData.destination_type === 'transfer'}
                    onChange={(e) => { setSelectedEquipmentIds([]); setFormData(prev => ({ ...prev, destination_type: e.target.value, customer_id: '', location_id: '', calibration_provider: '', from_site_id: '', to_site_id: '', receiving_personnel_id: '' })); }}
                  />
                  <span>Transfer (Site-to-Site)</span>
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
                  {locations
                    .filter(loc => loc.name.startsWith('WearCheck'))
                    .map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : formData.destination_type === 'customer' ? (
              <div className="form-group">
                <label className="form-label">Customer Site *</label>
                <select
                  name="customer_id"
                  className="form-select"
                  value={formData.customer_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select customer site...</option>
                  {customers.map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {cust.display_name} {cust.billing_city ? `(${cust.billing_city})` : ''} {cust.billing_state ? `- ${cust.billing_state}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : formData.destination_type === 'calibration' ? (
              <div className="form-group">
                <label className="form-label">Calibration Provider *</label>
                <input
                  type="text"
                  name="calibration_provider"
                  className="form-input"
                  value={formData.calibration_provider || ''}
                  onChange={handleChange}
                  required
                  placeholder="Enter calibration provider or location"
                />
              </div>
            ) : formData.destination_type === 'transfer' ? (
              <>
                <div className="form-group">
                  <label className="form-label">From Site</label>
                  <div style={{
                    padding: '10px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem'
                  }}>
                    {selectedEquipmentList.length > 0
                      ? [...new Set(selectedEquipmentList.map(eq => eq.current_location).filter(Boolean))].join(', ') || 'Unknown location'
                      : <span style={{ color: 'var(--text-secondary)' }}>Select equipment to see current location</span>}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">To Site *</label>
                  <select
                    name="to_site_id"
                    className="form-select"
                    value={formData.to_site_id || ''}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select destination site...</option>
                    {customers.map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.display_name} {cust.billing_city ? `(${cust.billing_city})` : ''} {cust.billing_state ? `- ${cust.billing_state}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}

            {(formData.destination_type === 'customer' || formData.destination_type === 'transfer') && (
              <div className="form-group">
                <label className="form-label">Receiving Employee *</label>
                <select
                  name="receiving_personnel_id"
                  className="form-select"
                  value={formData.receiving_personnel_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select receiving employee...</option>
                  {personnel
                    .filter(p => p.id.toString() !== formData.personnel_id)
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name} {person.employee_id ? `(${person.employee_id})` : ''}
                      </option>
                    ))}
                </select>
                <span className="form-help" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  The employee who will be taking over the equipment at the destination site
                </span>
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

            {selectedEquipmentList.length > 0 && (
              <div style={{
                padding: '12px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                marginBottom: '16px',
                fontSize: '0.875rem'
              }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Previous Condition:</strong>
                {selectedEquipmentList.map(eq => {
                  const lc = lastConditions[eq.id.toString()];
                  return (
                    <div key={eq.id} style={{ padding: '2px 0' }}>
                      <span style={{ fontWeight: 500 }}>{eq.equipment_name}:</span>{' '}
                      {lc ? `${lc.condition} on ${lc.date}` : 'Previous condition not available'}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="condition-select">Condition *</label>
              <span className="form-help" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{conditionHelp}</span>
              <select
                id="condition-select"
                name="condition"
                className="form-select"
                value={formData.condition || ''}
                onChange={handleChange}
                required
                aria-label="Select equipment condition"
              >
                <option value="">Select condition...</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Poor">Poor</option>
              </select>
            </div>

            {shouldShowReason() && (
              <div className="form-group">
                <label className="form-label" htmlFor="reason-input">Reason *</label>
                <input
                  id="reason-input"
                  type="text"
                  name="reason"
                  className="form-input"
                  value={formData.reason}
                  onChange={handleChange}
                  required
                  placeholder="Please provide a reason for this condition"
                  aria-label="Reason for condition"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Photo (Optional)</label>
              <div className="photo-buttons">
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  onClick={() => setShowCamera(true)}
                >
                  <Icons.Camera size={16} /> Take Photo
                </button>
                <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
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
                    &times;
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

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={
                  selectedEquipmentIds.length === 0 ||
                  !formData.personnel_id ||
                  ((formData.destination_type === 'customer' || formData.destination_type === 'transfer') && !formData.receiving_personnel_id) ||
                  (formData.destination_type === 'internal' ? !formData.location_id :
                    formData.destination_type === 'customer' ? !formData.customer_id :
                    formData.destination_type === 'calibration' ? !formData.calibration_provider :
                    formData.destination_type === 'transfer' ? !formData.to_site_id : false) ||
                  submitting ||
                  (shouldShowReason() && !formData.reason) ||
                  (selectedEquipmentList.some(eq => eq.is_quantity_tracked) && (!formData.quantity || formData.quantity < 1 || formData.quantity > selectedEquipmentList.find(eq => eq.is_quantity_tracked)?.available_quantity))
                }
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

      {showAddEquipment && (
        <AddEquipmentModal
          onClose={() => setShowAddEquipment(false)}
          onSuccess={() => {
            setShowAddEquipment(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

export default CheckOut;
