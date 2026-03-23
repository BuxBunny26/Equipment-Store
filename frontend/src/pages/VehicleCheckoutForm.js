import React, { useState, useEffect, useCallback } from 'react';
import { vehiclesApi, vehicleCheckoutsApi, personnelApi } from '../services/api';
import { useOperator } from '../context/OperatorContext';
import { Icons } from '../components/Icons';

const CONDITION_OPTIONS = ['Excellent', 'Good', 'Average', 'Poor'];
const CHECK_OPTIONS = ['Yes', 'No', 'Good', 'Average', 'Damaged', 'Missing', 'Expired', 'N/A'];

const INSPECTION_CHECKS = [
  { key: 'check_sanitized', label: 'Sanitizing of vehicle', default: 'N/A' },
  { key: 'check_bodywork', label: 'Vehicle bodywork', default: 'Good' },
  { key: 'check_tyres', label: 'Tyres & tyre pressure', default: 'Good' },
  { key: 'check_oil_water', label: 'Oil & water', default: 'Yes' },
  { key: 'check_fuel', label: 'Fuel', default: 'Yes' },
  { key: 'check_first_auto_aa_cards', label: 'First Auto & AA cards in vehicle', default: 'Yes' },
  { key: 'check_windscreen_wipers_mirrors', label: 'Windscreen, windows, wiper blades & mirrors', default: 'Good' },
  { key: 'check_lights', label: 'Lights (front/rear & indicators)', default: 'Yes' },
  { key: 'check_spare_tyre_jack', label: 'Spare tyre, jack & wheel spanner', default: 'Yes' },
  { key: 'check_brakes', label: 'Brakes', default: 'Yes' },
  { key: 'check_hooter', label: 'Hooter', default: 'Yes' },
  { key: 'check_warning_triangle', label: 'Warning triangle', default: 'Yes' },
  { key: 'check_license_disk', label: 'License disk', default: 'Yes' },
  { key: 'check_fire_extinguisher', label: 'Fire extinguisher', default: 'Yes' },
  { key: 'check_first_aid_kit', label: 'First aid kit', default: 'Yes' },
  { key: 'check_warning_lights', label: 'Vehicle warning lights', default: 'Yes' },
  { key: 'check_wheel_chocks', label: 'Wheel chocks (where issued)', default: 'N/A' },
];

function VehicleCheckoutForm() {
  const { operator } = useOperator();

  const [vehicles, setVehicles] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [licenseWarning, setLicenseWarning] = useState('');
  const [odometerWarning, setOdometerWarning] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [activeTab, setActiveTab] = useState('checkout'); // 'checkout' | 'return' | 'history'
  const [activeTrips, setActiveTrips] = useState([]);
  const [tripHistory, setTripHistory] = useState([]);
  const [returnForm, setReturnForm] = useState({ id: null, end_odometer: '', return_notes: '' });
  const [returningId, setReturningId] = useState(null);

  const getInitialForm = () => ({
    vehicle_id: '',
    driver_name: operator?.full_name || '',
    driver_license_number: '',
    driver_license_expiry: '',
    supervisor: '',
    checkout_date: new Date().toISOString().split('T')[0],
    destination: '',
    reason_for_use: '',
    start_odometer: '',
    vehicle_condition: 'Good',
    ...Object.fromEntries(INSPECTION_CHECKS.map(c => [c.key, c.default])),
    first_aid_kit_contents: '',
    condition_notes: '',
    checks_not_performed_reason: '',
    driver_changed: false,
    new_driver_name: '',
    notes: '',
  });

  const [form, setForm] = useState(getInitialForm);

  const fetchTrips = useCallback(async () => {
    try {
      const [activeRes, allRes] = await Promise.all([
        vehicleCheckoutsApi.getAll(),
        vehicleCheckoutsApi.getAllIncludingReturned(),
      ]);
      setActiveTrips(activeRes.data || []);
      setTripHistory(allRes.data || []);
    } catch (err) {
      console.error('Error fetching trips:', err);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [vehiclesRes, personnelRes] = await Promise.all([
          vehiclesApi.getAll(true),
          personnelApi.getAll(true),
        ]);
        setVehicles(vehiclesRes.data || []);
        setPersonnel(personnelRes.data || []);
        await fetchTrips();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []); // eslint-disable-line

  // Pre-fill driver info when operator/personnel loads
  useEffect(() => {
    if (operator?.full_name && personnel.length > 0 && !form.supervisor) {
      const person = personnel.find(p => p.full_name === operator.full_name);
      if (person) {
        applyDriverInfo(person);
      } else {
        setForm(prev => ({ ...prev, driver_name: operator.full_name }));
      }
    }
  }, [operator, personnel]); // eslint-disable-line

  // Supervisors: personnel who are listed as someone's supervisor, or have Manager/Supervisor in job title
  const supervisorList = React.useMemo(() => {
    const supervisorNames = new Set(personnel.map(p => p.supervisor).filter(Boolean).map(s => s.toLowerCase()));
    return personnel.filter(p => {
      const title = (p.job_title || '').toLowerCase();
      const name = (p.full_name || '').toLowerCase();
      return supervisorNames.has(name) || title.includes('manager') || title.includes('supervisor') || title.includes('director');
    });
  }, [personnel]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const applyDriverInfo = (person) => {
    const updates = { driver_name: person.full_name };
    // Auto-fill license info from personnel record
    if (person.drivers_license_number) {
      updates.driver_license_number = person.drivers_license_number;
    }
    if (person.drivers_license_expiry) {
      const expiry = person.drivers_license_expiry.split('T')[0];
      updates.driver_license_expiry = expiry;
      if (new Date(expiry) < new Date()) {
        setLicenseWarning('WARNING: Driver license has expired!');
      } else {
        setLicenseWarning('');
      }
    }
    // Auto-fill supervisor from personnel record
    if (person.supervisor) {
      const supWords = person.supervisor.toLowerCase().split(/\s+/);
      const supMatch = personnel.find(p => {
        if (!p.full_name) return false;
        const fn = p.full_name.toLowerCase();
        return fn === person.supervisor.toLowerCase() || supWords.every(w => fn.includes(w));
      });
      updates.supervisor = supMatch ? supMatch.full_name : person.supervisor;
    }
    setForm(prev => ({ ...prev, ...updates }));
  };

  const handleDriverSelect = (e) => {
    const person = personnel.find(p => String(p.id) === e.target.value);
    if (person) {
      applyDriverInfo(person);
    }
  };

  const handleVehicleSelect = (e) => {
    const vId = e.target.value;
    const vehicle = vehicles.find(v => String(v.id) === vId);
    const odo = vehicle?.current_odometer || '';
    setForm(prev => ({
      ...prev,
      vehicle_id: vId,
      start_odometer: odo || prev.start_odometer,
    }));
    setOdometerWarning('');
  };

  const handleOdometerChange = (e) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, start_odometer: val }));
    if (selectedVehicle?.current_odometer && val && parseInt(val, 10) < selectedVehicle.current_odometer) {
      setOdometerWarning(`Odometer reading is less than the last recorded value (${selectedVehicle.current_odometer.toLocaleString()} km). Please verify.`);
    } else {
      setOdometerWarning('');
    }
  };

  const handleLicenseExpiryChange = (e) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, driver_license_expiry: val }));
    if (val && new Date(val) < new Date()) {
      setLicenseWarning('WARNING: Driver license has expired!');
    } else {
      setLicenseWarning('');
    }
  };

  const selectedVehicle = vehicles.find(v => String(v.id) === String(form.vehicle_id));

  const canProceedStep1 = form.vehicle_id && form.driver_name && form.start_odometer && form.checkout_date && form.destination;
  const canProceedStep2 = true; // Inspection has defaults, always valid

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id || !form.driver_name || !form.start_odometer || !form.destination) {
      alert('Please select a vehicle, driver, enter the odometer reading, and destination.');
      return;
    }
    if (form.driver_license_expiry && new Date(form.driver_license_expiry) < new Date()) {
      if (!window.confirm('WARNING: The driver\'s license has expired. Do you still want to proceed?')) return;
    }
    try {
      setSaving(true);
      const payload = { ...form };
      payload.vehicle_id = parseInt(payload.vehicle_id, 10);
      payload.start_odometer = parseInt(payload.start_odometer, 10);
      Object.keys(payload).forEach(k => {
        if (payload[k] === '') payload[k] = null;
      });
      payload.driver_changed = form.driver_changed;
      await vehicleCheckoutsApi.create(payload);
      setSubmitted(true);
      fetchTrips();
    } catch (err) {
      alert('Error submitting form: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReturnVehicle = async (checkoutId) => {
    if (!returnForm.end_odometer) {
      alert('Please enter the end odometer reading.');
      return;
    }
    const trip = activeTrips.find(t => t.id === checkoutId);
    if (trip && parseInt(returnForm.end_odometer, 10) < trip.start_odometer) {
      alert(`End odometer (${returnForm.end_odometer}) cannot be less than start odometer (${trip.start_odometer.toLocaleString()}).`);
      return;
    }
    try {
      setReturningId(checkoutId);
      await vehicleCheckoutsApi.returnVehicle(checkoutId, {
        endOdometer: parseInt(returnForm.end_odometer, 10),
        returnNotes: returnForm.return_notes || null,
      });
      setReturnForm({ id: null, end_odometer: '', return_notes: '' });
      await fetchTrips();
      // Refresh vehicles to get updated odometer
      const vehiclesRes = await vehiclesApi.getAll(true);
      setVehicles(vehiclesRes.data || []);
    } catch (err) {
      alert('Error returning vehicle: ' + err.message);
    } finally {
      setReturningId(null);
    }
  };

  const handleNewCheckout = () => {
    setForm(getInitialForm());
    setSubmitted(false);
    setCurrentStep(1);
    setLicenseWarning('');
    setOdometerWarning('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="loading-spinner" />
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Loading vehicle data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  // Success screen
  if (submitted) {
    return (
      <div className="page-container">
        <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'rgba(46, 125, 50, 0.1)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px'
          }}>
            <Icons.Check size={40} style={{ color: 'var(--success-color)' }} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.5rem' }}>Checkout Submitted!</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 8px' }}>
            Pre-trip inspection for <strong>{selectedVehicle?.make} {selectedVehicle?.model}</strong> ({selectedVehicle?.registration_number}) has been recorded.
          </p>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 32px' }}>
            Driver: <strong>{form.driver_name}</strong> | Odometer: <strong>{Number(form.start_odometer).toLocaleString()} km</strong>
          </p>
          <button className="btn btn-primary" onClick={handleNewCheckout} style={{ padding: '12px 32px', fontSize: '1rem' }}>
            New Pre-Trip Inspection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Vehicle Pre-Trip Inspection</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Complete this form before taking a vehicle
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid var(--border-color)' }}>
        {[
          { key: 'checkout', label: 'New Checkout', icon: <Icons.ArrowRight size={16} /> },
          { key: 'return', label: `Return Vehicle${activeTrips.length ? ` (${activeTrips.length})` : ''}`, icon: <Icons.Check size={16} /> },
          { key: 'history', label: 'Trip History', icon: <Icons.Clock size={16} /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer',
              background: 'transparent', fontSize: '0.9rem', fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.key ? '2px solid var(--primary-color)' : '2px solid transparent',
              marginBottom: '-2px', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ======================== NEW CHECKOUT TAB ======================== */}
      {activeTab === 'checkout' && (
        <>
          {/* Step Indicator */}
          <div style={{
            display: 'flex', gap: '8px', marginBottom: '24px', padding: '0 4px',
          }}>
            {[
              { num: 1, label: 'Driver & Vehicle' },
              { num: 2, label: 'Inspection Checklist' },
              { num: 3, label: 'Review & Submit' },
            ].map(step => (
              <div
                key={step.num}
                onClick={() => {
                  if (step.num < currentStep) setCurrentStep(step.num);
                  if (step.num === 2 && canProceedStep1) setCurrentStep(2);
                  if (step.num === 3 && canProceedStep1 && canProceedStep2) setCurrentStep(3);
                }}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                  background: currentStep === step.num ? 'var(--primary-color)' : currentStep > step.num ? 'rgba(46, 125, 50, 0.1)' : 'var(--bg-secondary)',
                  color: currentStep === step.num ? '#fff' : currentStep > step.num ? 'var(--success-color)' : 'var(--text-secondary)',
                  border: `1px solid ${currentStep === step.num ? 'var(--primary-color)' : currentStep > step.num ? 'var(--success-color)' : 'var(--border-color)'}`,
                  transition: 'all 0.2s',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Step {step.num}</div>
                <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>{step.label}</div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Step 1: Driver & Vehicle Info */}
            {currentStep === 1 && (
              <div className="card" style={{ maxWidth: '800px' }}>
                <div className="card-header" style={{ padding: '16px 0', marginBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                  <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Driver & Vehicle Information</h2>
                </div>

                {/* Vehicle Selection */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Vehicle *</label>
                  <select name="vehicle_id" value={form.vehicle_id} onChange={handleVehicleSelect} className="form-input" required>
                    <option value="">-- Select Vehicle --</option>
                    {vehicles.filter(v => v.vehicle_status === 'Active').map(v => (
                      <option key={v.id} value={v.id}>
                        {v.registration_number} — {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedVehicle && (
                  <div style={{
                    padding: '12px 16px', background: 'rgba(25, 118, 210, 0.05)',
                    borderRadius: '8px', border: '1px solid rgba(25, 118, 210, 0.15)',
                    marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.85rem',
                  }}>
                    <div><strong>Make:</strong> {selectedVehicle.make} {selectedVehicle.model}</div>
                    <div><strong>Color:</strong> {selectedVehicle.color || 'N/A'}</div>
                    <div><strong>Current Odometer:</strong> {selectedVehicle.current_odometer?.toLocaleString() || '0'} km</div>
                  </div>
                )}

                {/* Driver Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Driver Name *</label>
                    <select onChange={handleDriverSelect} className="form-input" value={personnel.find(p => p.full_name === form.driver_name)?.id || ''}>
                      <option value="">-- Select Driver --</option>
                      {personnel.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Supervisor</label>
                    <select name="supervisor" value={form.supervisor} onChange={handleChange} className="form-input">
                      <option value="">-- Select Supervisor --</option>
                      {supervisorList.map(p => (
                        <option key={p.id} value={p.full_name}>{p.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Driver License Number</label>
                    <input type="text" name="driver_license_number" value={form.driver_license_number} onChange={handleChange} className="form-input" placeholder="License number" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">License Expiry Date</label>
                    <input type="date" name="driver_license_expiry" value={form.driver_license_expiry} onChange={handleLicenseExpiryChange} className="form-input" />
                  </div>
                </div>

                {licenseWarning && (
                  <div style={{ padding: '10px 14px', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid var(--error-color)', borderRadius: '6px', color: 'var(--error-color)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icons.Warning size={16} /> {licenseWarning}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input type="date" name="checkout_date" value={form.checkout_date} onChange={handleChange} className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Start Odometer (km) *</label>
                    <input type="number" name="start_odometer" value={form.start_odometer} onChange={handleOdometerChange} className="form-input" placeholder="e.g. 45000" required min="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vehicle Condition</label>
                    <select name="vehicle_condition" value={form.vehicle_condition} onChange={handleChange} className="form-input">
                      {CONDITION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {odometerWarning && (
                  <div style={{ padding: '10px 14px', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid var(--error-color)', borderRadius: '6px', color: 'var(--error-color)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icons.Warning size={16} /> {odometerWarning}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Destination *</label>
                    <input type="text" name="destination" value={form.destination} onChange={handleChange} className="form-input" placeholder="e.g. Two Rivers, Client Site" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reason for Vehicle Usage</label>
                    <input type="text" name="reason_for_use" value={form.reason_for_use} onChange={handleChange} className="form-input" placeholder="e.g. Work, Client Visit" />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!canProceedStep1}
                    onClick={() => setCurrentStep(2)}
                    style={{ padding: '10px 32px' }}
                  >
                    Next: Inspection Checklist
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Pre-Trip Inspection Checklist */}
            {currentStep === 2 && (
              <div className="card" style={{ maxWidth: '800px' }}>
                <div className="card-header" style={{ padding: '16px 0', marginBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                  <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Pre-Trip Inspection Checklist</h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Check each item and select the appropriate status
                  </p>
                </div>

                <div style={{ display: 'grid', gap: '0' }}>
                  {/* Header row */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 140px', gap: '12px',
                    padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: '6px 6px 0 0',
                    fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)',
                  }}>
                    <div>Inspection Item</div>
                    <div style={{ textAlign: 'center' }}>Status</div>
                  </div>

                  {INSPECTION_CHECKS.map((check, i) => (
                    <div
                      key={check.key}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 140px', gap: '12px',
                        padding: '10px 12px', alignItems: 'center',
                        background: i % 2 === 0 ? 'transparent' : 'var(--bg-primary)',
                        borderBottom: '1px solid var(--border-color)',
                      }}
                    >
                      <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{check.label}</label>
                      <select
                        name={check.key}
                        value={form[check.key]}
                        onChange={handleChange}
                        className="form-input"
                        style={{
                          padding: '6px 8px', fontSize: '0.85rem', textAlign: 'center',
                          background: form[check.key] === 'No' || form[check.key] === 'Damaged' || form[check.key] === 'Missing' || form[check.key] === 'Expired'
                            ? 'rgba(231, 76, 60, 0.08)' : form[check.key] === 'Good' || form[check.key] === 'Yes'
                              ? 'rgba(46, 125, 50, 0.08)' : undefined,
                          borderColor: form[check.key] === 'No' || form[check.key] === 'Damaged' || form[check.key] === 'Missing' || form[check.key] === 'Expired'
                            ? 'var(--error-color)' : form[check.key] === 'Good' || form[check.key] === 'Yes'
                              ? 'var(--success-color)' : undefined,
                        }}
                      >
                        {CHECK_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {/* First Aid Kit Contents */}
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">First Aid Kit Contents</label>
                  <select name="first_aid_kit_contents" value={form.first_aid_kit_contents} onChange={handleChange} className="form-input">
                    <option value="">-- Select --</option>
                    <option value="All items present / Nothing missing">All items present / Nothing missing</option>
                    <option value="Some items missing">Some items missing</option>
                    <option value="Kit not present">Kit not present</option>
                  </select>
                </div>

                {/* Condition Notes */}
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Reason for vehicle condition (if not Excellent)</label>
                  <textarea name="condition_notes" value={form.condition_notes} onChange={handleChange} className="form-input" rows="2" placeholder="Describe any issues with the vehicle..." />
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Reason for any checks not performed</label>
                  <textarea name="checks_not_performed_reason" value={form.checks_not_performed_reason} onChange={handleChange} className="form-input" rows="2" placeholder="If any checks were skipped, explain why..." />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setCurrentStep(1)} style={{ padding: '10px 24px' }}>
                    Back
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => setCurrentStep(3)} style={{ padding: '10px 32px' }}>
                    Next: Review & Submit
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Submit */}
            {currentStep === 3 && (
              <div className="card" style={{ maxWidth: '800px' }}>
                <div className="card-header" style={{ padding: '16px 0', marginBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                  <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Review & Submit</h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Please review all details before submitting
                  </p>
                </div>

                {/* Vehicle & Driver Summary */}
                <div style={{
                  padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px',
                  marginBottom: '16px', border: '1px solid var(--border-color)',
                }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>Vehicle & Driver Details</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                    <div><strong>Vehicle:</strong> {selectedVehicle ? `${selectedVehicle.registration_number} — ${selectedVehicle.make} ${selectedVehicle.model}` : 'N/A'}</div>
                    <div><strong>Driver:</strong> {form.driver_name || 'N/A'}</div>
                    <div><strong>Date:</strong> {form.checkout_date}</div>
                    <div><strong>Supervisor:</strong> {form.supervisor || 'N/A'}</div>
                    <div><strong>Start Odometer:</strong> {form.start_odometer ? `${Number(form.start_odometer).toLocaleString()} km` : 'N/A'}</div>
                    <div><strong>Condition:</strong> {form.vehicle_condition}</div>
                    <div><strong>Destination:</strong> {form.destination || 'N/A'}</div>
                    <div><strong>Reason:</strong> {form.reason_for_use || 'N/A'}</div>
                    {form.driver_license_number && <div><strong>License #:</strong> {form.driver_license_number}</div>}
                    {form.driver_license_expiry && <div><strong>License Expiry:</strong> {form.driver_license_expiry}</div>}
                  </div>
                </div>

                {/* Inspection Summary */}
                <div style={{
                  padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px',
                  marginBottom: '16px', border: '1px solid var(--border-color)',
                }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>Inspection Results</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.85rem' }}>
                    {INSPECTION_CHECKS.map(check => {
                      const val = form[check.key];
                      const isBad = ['No', 'Damaged', 'Missing', 'Expired'].includes(val);
                      return (
                        <div key={check.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                          <span>{check.label}</span>
                          <span style={{
                            fontWeight: 600, marginLeft: '8px',
                            color: isBad ? 'var(--error-color)' : val === 'N/A' || val === 'Average' ? 'var(--text-secondary)' : 'var(--success-color)',
                          }}>
                            {val}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {form.first_aid_kit_contents && (
                    <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                      <strong>First Aid Kit:</strong> {form.first_aid_kit_contents}
                    </div>
                  )}
                </div>

                {/* Flagged Issues */}
                {INSPECTION_CHECKS.some(c => ['No', 'Damaged', 'Missing', 'Expired'].includes(form[c.key])) && (
                  <div style={{
                    padding: '12px 16px', background: 'rgba(231, 76, 60, 0.08)',
                    borderRadius: '8px', border: '1px solid var(--error-color)',
                    marginBottom: '16px', fontSize: '0.85rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--error-color)', fontWeight: 700 }}>
                      <Icons.Warning size={16} /> Issues Flagged:
                    </div>
                    <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                      {INSPECTION_CHECKS.filter(c => ['No', 'Damaged', 'Missing', 'Expired'].includes(form[c.key])).map(c => (
                        <li key={c.key} style={{ color: 'var(--error-color)' }}>{c.label}: <strong>{form[c.key]}</strong></li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Notes & Condition */}
                {(form.condition_notes || form.checks_not_performed_reason || form.notes) && (
                  <div style={{
                    padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px',
                    marginBottom: '16px', border: '1px solid var(--border-color)', fontSize: '0.85rem',
                  }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>Notes</h3>
                    {form.condition_notes && <p style={{ margin: '0 0 4px' }}><strong>Condition:</strong> {form.condition_notes}</p>}
                    {form.checks_not_performed_reason && <p style={{ margin: '0 0 4px' }}><strong>Skipped Checks:</strong> {form.checks_not_performed_reason}</p>}
                    {form.notes && <p style={{ margin: 0 }}><strong>Additional:</strong> {form.notes}</p>}
                  </div>
                )}

                {/* Driver Change */}
                <div style={{
                  padding: '12px 16px', border: '1px solid var(--border-color)',
                  borderRadius: '8px', marginBottom: '16px',
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" name="driver_changed" checked={form.driver_changed} onChange={handleChange} />
                    <strong style={{ fontSize: '0.9rem' }}>Driver will change during trip</strong>
                  </label>
                  {form.driver_changed && (
                    <div className="form-group" style={{ marginTop: '12px' }}>
                      <label className="form-label">New Driver Name</label>
                      <select
                        onChange={(e) => {
                          const p = personnel.find(pp => String(pp.id) === e.target.value);
                          if (p) setForm(prev => ({ ...prev, new_driver_name: p.full_name }));
                        }}
                        className="form-input"
                        value={personnel.find(p => p.full_name === form.new_driver_name)?.id || ''}
                      >
                        <option value="">-- Select New Driver --</option>
                        {personnel.map(p => (
                          <option key={p.id} value={p.id}>{p.full_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Additional Notes */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Additional Notes</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} className="form-input" rows="2" placeholder="Any additional notes..." />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setCurrentStep(2)} style={{ padding: '10px 24px' }}>
                    Back
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '12px 40px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {saving ? 'Submitting...' : <><Icons.Check size={18} /> Submit Pre-Trip Inspection</>}
                  </button>
                </div>
              </div>
            )}
          </form>
        </>
      )}

      {/* ======================== RETURN VEHICLE TAB ======================== */}
      {activeTab === 'return' && (
        <div style={{ maxWidth: '800px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>Active Trips - Return Vehicle</h2>
          {activeTrips.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Icons.Check size={40} style={{ color: 'var(--success-color)', marginBottom: '12px' }} />
              <h3 style={{ margin: '0 0 8px' }}>All Vehicles Returned</h3>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No active trips at the moment</p>
            </div>
          ) : (
            activeTrips.map(trip => {
              const vehicle = vehicles.find(v => v.id === trip.vehicle_id) || trip.vehicles || {};
              const isExpanded = returnForm.id === trip.id;
              return (
                <div key={trip.id} className="card" style={{ marginBottom: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                        {vehicle.registration_number || trip.vehicles?.registration_number} — {vehicle.make || trip.vehicles?.make} {vehicle.model || trip.vehicles?.model}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Driver: <strong>{trip.driver_name}</strong> | Date: {formatDate(trip.checkout_date)} | Odometer: {trip.start_odometer?.toLocaleString()} km
                      </div>
                      {trip.destination && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Destination: {trip.destination}
                        </div>
                      )}
                    </div>
                    <button
                      className={`btn btn-sm ${isExpanded ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => setReturnForm(isExpanded ? { id: null, end_odometer: '', return_notes: '' } : { id: trip.id, end_odometer: '', return_notes: '' })}
                    >
                      {isExpanded ? 'Cancel' : 'Return'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                        <div className="form-group">
                          <label className="form-label">End Odometer (km) *</label>
                          <input
                            type="number"
                            value={returnForm.end_odometer}
                            onChange={(e) => setReturnForm(prev => ({ ...prev, end_odometer: e.target.value }))}
                            className="form-input"
                            placeholder={`Must be >= ${trip.start_odometer?.toLocaleString()}`}
                            min={trip.start_odometer || 0}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Distance Travelled</label>
                          <input
                            type="text"
                            className="form-input"
                            value={returnForm.end_odometer ? `${(parseInt(returnForm.end_odometer, 10) - (trip.start_odometer || 0)).toLocaleString()} km` : '-'}
                            disabled
                          />
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label className="form-label">Return Notes</label>
                        <textarea
                          value={returnForm.return_notes}
                          onChange={(e) => setReturnForm(prev => ({ ...prev, return_notes: e.target.value }))}
                          className="form-input"
                          rows="2"
                          placeholder="Any notes about the return (fuel level, damage, etc.)"
                        />
                      </div>
                      <button
                        className="btn btn-success"
                        disabled={!returnForm.end_odometer || returningId === trip.id}
                        onClick={() => handleReturnVehicle(trip.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Icons.Check size={16} /> {returningId === trip.id ? 'Returning...' : 'Confirm Return'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ======================== TRIP HISTORY TAB ======================== */}
      {activeTab === 'history' && (
        <div>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>Trip History</h2>
          {tripHistory.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No trip records found</p>
            </div>
          ) : (
            <div className="card">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Driver</th>
                      <th>Date</th>
                      <th>Destination</th>
                      <th>Odometer</th>
                      <th>Distance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tripHistory.slice(0, 50).map(trip => {
                      const veh = trip.vehicles || {};
                      const distance = trip.end_odometer && trip.start_odometer
                        ? (trip.end_odometer - trip.start_odometer)
                        : null;
                      return (
                        <tr key={trip.id}>
                          <td>
                            <div style={{ fontWeight: 500 }}>{veh.registration_number}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{veh.make} {veh.model}</div>
                          </td>
                          <td>{trip.driver_name}</td>
                          <td style={{ fontSize: '0.85rem' }}>{formatDate(trip.checkout_date)}</td>
                          <td>{trip.destination || '-'}</td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {trip.start_odometer?.toLocaleString()}
                            {trip.end_odometer ? ` - ${trip.end_odometer.toLocaleString()}` : ''} km
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {distance !== null ? `${distance.toLocaleString()} km` : '-'}
                          </td>
                          <td>
                            <span className={`badge ${trip.is_returned ? 'badge-available' : 'badge-checked-out'}`}>
                              {trip.is_returned ? 'Returned' : 'Active'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default VehicleCheckoutForm;
