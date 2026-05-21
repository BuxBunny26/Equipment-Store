import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { equipmentApi, categoriesApi, locationsApi, subcategoriesApi, customersApi, personnelApi } from '../services/api';
import { Icons } from './Icons';
import SearchableSelect from './SearchableSelect';
import { getCustomFieldRule } from '../utils/customFields';
import { uniqueCountries, customerMatchesCountry, regionLabel } from '../utils/provinces';

function AddEquipmentModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [duplicateMatch, setDuplicateMatch] = useState(null);
  const [checkingSerial, setCheckingSerial] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState({});
  // Unified site picker state (mirrors the destination picker on Check Out)
  const [siteType, setSiteType] = useState('internal'); // 'internal' | 'customer'
  const [siteCountryFilter, setSiteCountryFilter] = useState('South Africa');
  const [siteSearchTerm, setSiteSearchTerm] = useState('');
  // Multi-site selection: first id in each array is the primary site.
  // Extras are recorded in notes as roving sites.
  const [selectedLocationIds, setSelectedLocationIds] = useState([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
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
    current_customer_id: '',
    current_holder_id: '',
    notes: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, locRes, custRes, perRes] = await Promise.all([
          categoriesApi.getAll(),
          locationsApi.getAll(true),
          customersApi.getAll(),
          personnelApi.getAll(true),
        ]);
        setCategories(catRes.data);
        setLocations(locRes.data);
        setCustomers(custRes.data || []);
        setPersonnel(perRes.data || []);
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

    // Resolve primary + roving sites from the multi-select arrays.
    const primaryLocationId = siteType === 'internal' && selectedLocationIds[0]
      ? parseInt(selectedLocationIds[0]) : null;
    const primaryCustomerId = siteType === 'customer' && selectedCustomerIds[0]
      ? parseInt(selectedCustomerIds[0]) : null;

    if (!primaryLocationId && !primaryCustomerId) {
      setError('Please select a current location or customer site.');
      setLoading(false);
      return;
    }

    const extraLocationNames = siteType === 'internal'
      ? selectedLocationIds.slice(1)
          .map(id => locations.find(l => l.id.toString() === id.toString())?.name)
          .filter(Boolean)
      : [];
    const extraCustomerNames = siteType === 'customer'
      ? selectedCustomerIds.slice(1)
          .map(id => customers.find(c => c.id.toString() === id.toString())?.display_name)
          .filter(Boolean)
      : [];
    const rovingNames = [...extraLocationNames, ...extraCustomerNames];

    try {
      const submitData = { ...formData };
      submitData.current_location_id = primaryLocationId;
      submitData.current_customer_id = primaryCustomerId;
      // Convert empty strings to null for FK fields
      if (!submitData.category_id) submitData.category_id = null;
      if (!submitData.subcategory_id) submitData.subcategory_id = null;
      if (!submitData.current_holder_id) submitData.current_holder_id = null;
      else submitData.current_holder_id = parseInt(submitData.current_holder_id);
      // Append roving sites to notes for traceability
      if (rovingNames.length > 0) {
        const rovingLine = `Roving Sites: ${rovingNames.join(', ')}`;
        submitData.notes = [submitData.notes, rovingLine].filter(Boolean).join(' | ');
      }
      // Include custom fields if any were set
      if (Object.keys(customFieldValues).length > 0) {
        submitData.custom_fields = customFieldValues;
      }
      await equipmentApi.create(submitData);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle helpers for multi-site selection
  const toggleLocation = (id) => {
    const s = id.toString();
    setSelectedLocationIds(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };
  const toggleCustomer = (id) => {
    const s = id.toString();
    setSelectedCustomerIds(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };
  const setPrimaryLocation = (id) => {
    const s = id.toString();
    setSelectedLocationIds(prev => {
      const without = prev.filter(x => x !== s);
      return [s, ...without];
    });
  };
  const setPrimaryCustomer = (id) => {
    const s = id.toString();
    setSelectedCustomerIds(prev => {
      const without = prev.filter(x => x !== s);
      return [s, ...without];
    });
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

              {/* Site type toggle */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="site_type"
                    value="internal"
                    checked={siteType === 'internal'}
                    onChange={() => {
                      setSiteType('internal');
                      setSelectedCustomerIds([]);
                      setSiteSearchTerm('');
                    }}
                  />
                  Internal Location (Branch)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="site_type"
                    value="customer"
                    checked={siteType === 'customer'}
                    onChange={() => {
                      setSiteType('customer');
                      setSelectedLocationIds([]);
                      setSiteSearchTerm('');
                    }}
                  />
                  Customer Site
                </label>
              </div>

              {/* Country filter — only meaningful for customer sites */}
              {siteType === 'customer' && (
                <div style={{ marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Country</label>
                  <select
                    className="form-select"
                    value={siteCountryFilter}
                    onChange={(e) => setSiteCountryFilter(e.target.value)}
                  >
                    <option value="">All Countries</option>
                    {uniqueCountries(customers).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search input */}
              <input
                type="text"
                className="form-input"
                placeholder={
                  siteType === 'internal'
                    ? 'Search branch by name...'
                    : 'Search customer site by name, city, or number...'
                }
                value={siteSearchTerm}
                onChange={(e) => setSiteSearchTerm(e.target.value)}
                style={{ marginBottom: '8px' }}
              />

              {/* Searchable list with single-select */}
              <div style={{
                maxHeight: '220px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px',
              }}>
                {siteType === 'internal' ? (() => {
                  const q = siteSearchTerm.trim().toLowerCase();
                  // Internal branches are WearCheck-owned locations only.
                  // Anything else lives under "Customer Site".
                  const filtered = locations
                    .filter(loc => (loc.name || '').toLowerCase().includes('wearcheck'))
                    .filter(loc =>
                      !q || (loc.name || '').toLowerCase().includes(q)
                                  || (loc.description || '').toLowerCase().includes(q)
                    );
                  if (filtered.length === 0) {
                    return <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '12px' }}>No branches match your search</p>;
                  }
                  return filtered.map(loc => {
                    const idStr = loc.id.toString();
                    const isSelected = selectedLocationIds.includes(idStr);
                    const isPrimary = isSelected && selectedLocationIds[0] === idStr;
                    return (
                      <label
                        key={loc.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '6px 4px', cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleLocation(loc.id)}
                        />
                        <span style={{ fontSize: '0.875rem', flex: 1 }}>
                          {loc.name}
                          {loc.description ? (
                            <span style={{ color: 'var(--text-secondary)' }}> — {loc.description}</span>
                          ) : null}
                        </span>
                        {isSelected && (
                          isPrimary ? (
                            <span style={{
                              fontSize: '0.75rem', fontWeight: 600,
                              color: 'var(--primary-color, #1976d2)',
                              padding: '2px 6px',
                              border: '1px solid var(--primary-color, #1976d2)',
                              borderRadius: '4px',
                            }}>★ Primary</span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); setPrimaryLocation(loc.id); }}
                              style={{
                                fontSize: '0.75rem',
                                background: 'transparent',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                              }}
                            >Set primary</button>
                          )
                        )}
                      </label>
                    );
                  });
                })() : (() => {
                  const q = siteSearchTerm.trim().toLowerCase();
                  const filtered = customers
                    .filter(c => customerMatchesCountry(c, siteCountryFilter))
                    .filter(c => {
                      if (!q) return true;
                      return (
                        (c.display_name || '').toLowerCase().includes(q) ||
                        (c.billing_city || '').toLowerCase().includes(q) ||
                        (c.billing_state || '').toLowerCase().includes(q) ||
                        (c.customer_number || '').toLowerCase().includes(q)
                      );
                    });
                  if (filtered.length === 0) {
                    return <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '12px' }}>No customer sites match your search</p>;
                  }
                  return filtered.map(cust => {
                    const idStr = cust.id.toString();
                    const isSelected = selectedCustomerIds.includes(idStr);
                    const isPrimary = isSelected && selectedCustomerIds[0] === idStr;
                    return (
                      <label
                        key={cust.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '6px 4px', cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCustomer(cust.id)}
                        />
                        <span style={{ fontSize: '0.875rem', flex: 1 }}>
                          {cust.display_name}
                          {cust.billing_city ? ` (${cust.billing_city})` : ''}
                          {regionLabel(cust) ? ` - ${regionLabel(cust)}` : ''}
                        </span>
                        {isSelected && (
                          isPrimary ? (
                            <span style={{
                              fontSize: '0.75rem', fontWeight: 600,
                              color: 'var(--primary-color, #1976d2)',
                              padding: '2px 6px',
                              border: '1px solid var(--primary-color, #1976d2)',
                              borderRadius: '4px',
                            }}>★ Primary</span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); setPrimaryCustomer(cust.id); }}
                              style={{
                                fontSize: '0.75rem',
                                background: 'transparent',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                              }}
                            >Set primary</button>
                          )
                        )}
                      </label>
                    );
                  });
                })()}
              </div>
              <span className="form-help" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Pick one or more sites where this equipment lives. The first one is the primary; click “Set primary” on another to switch. Extras are recorded as roving sites in the equipment notes.
              </span>
            </div>

            {/* Optional current holder */}
            <div className="form-group">
              <label className="form-label">Current Holder (optional)</label>
              <SearchableSelect
                value={formData.current_holder_id}
                onChange={(id) => setFormData(prev => ({ ...prev, current_holder_id: id }))}
                options={personnel.map(p => ({
                  id: p.id,
                  label: p.full_name,
                  sublabel: p.employee_id || '',
                  searchText: `${p.full_name} ${p.employee_id || ''} ${p.email || ''}`,
                }))}
                placeholder="Search personnel by name or employee ID..."
                allowClear
              />
              <span className="form-help" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Leave blank if the equipment isn’t currently assigned to a person.
              </span>
            </div>

            {/* Custom fields — e.g. AMS2140 channel count */}
            {(() => {
              const rule = getCustomFieldRule(formData.equipment_name);
              if (!rule) return null;
              return (
                <div className="form-group">
                  <label className="form-label">{rule.label}</label>
                  <select
                    className="form-select"
                    value={customFieldValues[rule.field] || ''}
                    onChange={e => setCustomFieldValues(prev => ({ ...prev, [rule.field]: e.target.value }))}
                  >
                    <option value="">Select {rule.label.toLowerCase()}...</option>
                    {rule.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              );
            })()}

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
