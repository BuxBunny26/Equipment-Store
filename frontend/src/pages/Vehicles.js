import React, { useState, useEffect } from 'react';
import { vehiclesApi, vehicleCheckoutsApi, vehicleFinesApi, vehicleServicesApi, personnelApi } from '../services/api';
import { useOperator } from '../context/OperatorContext';
import { Icons } from '../components/Icons';

const VEHICLE_STATUSES = [
  { value: 'Active', label: 'Active', badge: 'badge-available' },
  { value: 'In Use', label: 'In Use', badge: 'badge-checked-out' },
  { value: 'In Service', label: 'In Service', badge: 'badge-low-stock' },
  { value: 'Repairs', label: 'Repairs', badge: 'badge-low-stock' },
  { value: 'Decommissioned', label: 'Decommissioned', badge: 'badge-overdue' },
  { value: 'Sold', label: 'Sold', badge: 'badge-overdue' },
  { value: 'Written Off', label: 'Written Off', badge: 'badge-overdue' },
];

const CONDITION_OPTIONS = ['Excellent', 'Good', 'Average', 'Poor'];
const CHECK_OPTIONS = ['Yes', 'No', 'Good', 'Average', 'Damaged', 'Missing', 'Expired', 'N/A'];

function Vehicles() {
  const { operatorRole } = useOperator();
  const isAdminOrManager = operatorRole && ['admin', 'manager'].includes(operatorRole.toLowerCase());

  const [activeTab, setActiveTab] = useState('fleet');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fleet data
  const [vehicles, setVehicles] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Checkouts data
  const [checkouts, setCheckouts] = useState([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [editCheckout, setEditCheckout] = useState(null);
  const [showReturned, setShowReturned] = useState(false);
  const [checkoutSearch, setCheckoutSearch] = useState('');

  // Fines data
  const [fines, setFines] = useState([]);
  const [showFineModal, setShowFineModal] = useState(false);
  const [editFine, setEditFine] = useState(null);

  // Services data
  const [services, setServices] = useState([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editService, setEditService] = useState(null);

  // Return modal
  const [returnCheckout, setReturnCheckout] = useState(null);

  // Detail view
  const [detailVehicle, setDetailVehicle] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab, showReturned]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [vehiclesRes, personnelRes] = await Promise.all([
        vehiclesApi.getAll(false),
        personnelApi.getAll(true),
      ]);
      setVehicles(vehiclesRes.data || []);
      setPersonnel(personnelRes.data || []);

      if (activeTab === 'checkouts') {
        const checkoutsRes = showReturned
          ? await vehicleCheckoutsApi.getAllIncludingReturned()
          : await vehicleCheckoutsApi.getAll();
        setCheckouts(checkoutsRes.data || []);
      } else if (activeTab === 'fines') {
        const finesRes = await vehicleFinesApi.getAll();
        setFines(finesRes.data || []);
      } else if (activeTab === 'services') {
        const servicesRes = await vehicleServicesApi.getAll();
        setServices(servicesRes.data || []);
      }
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Fleet Handlers ----------
  const handleDeleteVehicle = async (v) => {
    if (!window.confirm(`Delete vehicle ${v.make} ${v.model} (${v.registration_number})?`)) return;
    try {
      await vehiclesApi.delete(v.id);
      fetchData();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleStatusChange = async (v, newStatus) => {
    if (!window.confirm(`Change status of ${v.registration_number} to ${newStatus}?`)) return;
    try {
      await vehiclesApi.updateStatus(v.id, newStatus);
      fetchData();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ---------- Checkout Handlers ----------
  const handleReturnVehicle = async (endOdometer) => {
    if (!returnCheckout) return;
    try {
      await vehicleCheckoutsApi.returnVehicle(returnCheckout.id, endOdometer);
      setReturnCheckout(null);
      fetchData();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleDeleteCheckout = async (c) => {
    if (!window.confirm('Delete this checkout record?')) return;
    try {
      await vehicleCheckoutsApi.delete(c.id);
      fetchData();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ---------- Fine Handlers ----------
  const handleDeleteFine = async (f) => {
    if (!window.confirm('Delete this fine record?')) return;
    try {
      await vehicleFinesApi.delete(f.id);
      fetchData();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ---------- Service Handlers ----------
  const handleDeleteService = async (s) => {
    if (!window.confirm('Delete this service record?')) return;
    try {
      await vehicleServicesApi.delete(s.id);
      fetchData();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ---------- Filtering ----------
  const filteredVehicles = vehicles.filter(v => {
    if (statusFilter && v.vehicle_status !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      v.make?.toLowerCase().includes(term) ||
      v.model?.toLowerCase().includes(term) ||
      v.registration_number?.toLowerCase().includes(term) ||
      v.vin_number?.toLowerCase().includes(term) ||
      v.assigned_to?.toLowerCase().includes(term) ||
      v.fuel_type?.toLowerCase().includes(term)
    );
  });

  const filteredCheckouts = checkouts.filter(c => {
    if (!checkoutSearch) return true;
    const term = checkoutSearch.toLowerCase();
    return (
      c.driver_name?.toLowerCase().includes(term) ||
      c.vehicles?.registration_number?.toLowerCase().includes(term) ||
      c.vehicles?.make?.toLowerCase().includes(term) ||
      c.destination?.toLowerCase().includes(term)
    );
  });

  // ---------- Alerts ----------
  const licenseDiskAlerts = vehicles.filter(v => {
    if (!v.license_disk_expiry || !v.is_active) return false;
    const expiry = new Date(v.license_disk_expiry);
    const daysUntil = (expiry - new Date()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 30;
  });

  const serviceAlerts = vehicles.filter(v => {
    if (!v.next_service_date || !v.is_active) return false;
    const svcDate = new Date(v.next_service_date);
    const daysUntil = (svcDate - new Date()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 30;
  });

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading vehicles...
      </div>
    );
  }

  const tabs = [
    { key: 'fleet', label: 'Fleet', count: vehicles.filter(v => v.is_active).length },
    { key: 'checkouts', label: 'Checkouts', count: checkouts.filter(c => !c.is_returned).length },
    { key: 'fines', label: 'Fines', count: fines.length },
    { key: 'services', label: 'Services', count: services.length },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Vehicles</h1>
          <p className="page-subtitle">Manage company vehicles, checkouts, fines, and services</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isAdminOrManager && activeTab === 'fleet' && (
            <button className="btn btn-primary" onClick={() => { setEditVehicle(null); setShowVehicleModal(true); }}>
              + Add Vehicle
            </button>
          )}
          {activeTab === 'checkouts' && (
            <button className="btn btn-primary" onClick={() => { setEditCheckout(null); setShowCheckoutModal(true); }}>
              + Vehicle Checkout
            </button>
          )}
          {isAdminOrManager && activeTab === 'fines' && (
            <button className="btn btn-primary" onClick={() => { setEditFine(null); setShowFineModal(true); }}>
              + Record Fine
            </button>
          )}
          {isAdminOrManager && activeTab === 'services' && (
            <button className="btn btn-primary" onClick={() => { setEditService(null); setShowServiceModal(true); }}>
              + Record Service
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button className="btn btn-sm btn-secondary" onClick={fetchData} style={{ marginLeft: 'auto' }}>Retry</button>
        </div>
      )}

      {/* Alerts */}
      {(licenseDiskAlerts.length > 0 || serviceAlerts.length > 0) && (
        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {licenseDiskAlerts.map(v => (
            <div key={`lic-${v.id}`} className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icons.Warning size={16} />
              <span><strong>{v.registration_number}</strong> — License disk {new Date(v.license_disk_expiry) < new Date() ? 'EXPIRED' : 'expiring soon'}: {new Date(v.license_disk_expiry).toLocaleDateString()}</span>
            </div>
          ))}
          {serviceAlerts.map(v => (
            <div key={`svc-${v.id}`} className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(243, 156, 18, 0.1)', borderColor: '#f39c12', color: '#f39c12' }}>
              <Icons.Wrench size={16} />
              <span><strong>{v.registration_number}</strong> — Service {new Date(v.next_service_date) < new Date() ? 'OVERDUE' : 'due soon'}: {new Date(v.next_service_date).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '2px solid var(--border-color)', paddingBottom: '0' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '3px solid var(--primary-color)' : '3px solid transparent',
              background: activeTab === tab.key ? 'var(--bg-secondary)' : 'transparent',
              color: activeTab === tab.key ? 'var(--primary-color)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              borderRadius: '6px 6px 0 0',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                marginLeft: '6px',
                background: activeTab === tab.key ? 'var(--primary-color)' : 'var(--text-secondary)',
                color: '#fff',
                borderRadius: '10px',
                padding: '1px 8px',
                fontSize: '0.75rem',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Fleet Tab */}
      {activeTab === 'fleet' && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--success-color)' }}>
                {vehicles.filter(v => v.vehicle_status === 'Active').length}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Available</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                {vehicles.filter(v => v.vehicle_status === 'In Use').length}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>In Use</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f39c12' }}>
                {vehicles.filter(v => ['In Service', 'Repairs'].includes(v.vehicle_status)).length}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Service / Repairs</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--error-color)' }}>
                {licenseDiskAlerts.length}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>License Alerts</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {vehicles.length}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total</div>
            </div>
          </div>

          {/* Filters */}
          <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by make, model, registration..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ flex: 1, minWidth: '200px' }}
              />
              <select
                className="form-input"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ minWidth: '150px' }}
              >
                <option value="">All Statuses</option>
                {VEHICLE_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fleet Table */}
          <div className="card">
            {filteredVehicles.length === 0 ? (
              <div className="empty-state">
                <h3>No vehicles found</h3>
                <p>{searchTerm ? 'Try a different search term' : 'Click "Add Vehicle" to register the first vehicle'}</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Registration</th>
                      <th>Fuel</th>
                      <th>Assigned To</th>
                      <th>Odometer</th>
                      <th>License Disk Expiry</th>
                      <th>Next Service</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVehicles.map(v => {
                      const licenseExpired = v.license_disk_expiry && new Date(v.license_disk_expiry) < new Date();
                      const licenseSoon = v.license_disk_expiry && !licenseExpired && (new Date(v.license_disk_expiry) - new Date()) / (1000*60*60*24) <= 30;
                      const serviceDue = v.next_service_date && (new Date(v.next_service_date) - new Date()) / (1000*60*60*24) <= 30;
                      return (
                        <tr key={v.id}>
                          <td>
                            <div>
                              <strong>{v.make} {v.model}</strong>
                              {v.year && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{v.year}</div>}
                              {v.qr_code && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>QR: {v.qr_code}</div>}
                            </div>
                          </td>
                          <td><strong style={{ fontFamily: 'monospace' }}>{v.registration_number}</strong></td>
                          <td>{v.fuel_type || '-'}</td>
                          <td>{v.assigned_to || '-'}</td>
                          <td>{v.current_odometer ? v.current_odometer.toLocaleString() + ' km' : '-'}</td>
                          <td>
                            {v.license_disk_expiry ? (
                              <span style={{ color: licenseExpired ? 'var(--error-color)' : licenseSoon ? '#f39c12' : 'inherit', fontWeight: licenseExpired || licenseSoon ? 600 : 400 }}>
                                {new Date(v.license_disk_expiry).toLocaleDateString()}
                                {licenseExpired && ' ⚠ EXPIRED'}
                                {licenseSoon && ' ⚠ Soon'}
                              </span>
                            ) : '-'}
                          </td>
                          <td>
                            {v.next_service_date ? (
                              <span style={{ color: serviceDue ? '#f39c12' : 'inherit', fontWeight: serviceDue ? 600 : 400 }}>
                                {new Date(v.next_service_date).toLocaleDateString()}
                              </span>
                            ) : '-'}
                          </td>
                          <td>
                            {(() => {
                              const st = VEHICLE_STATUSES.find(s => s.value === v.vehicle_status) || VEHICLE_STATUSES[0];
                              return <span className={`badge ${st.badge}`}>{st.label}</span>;
                            })()}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <button className="btn btn-sm btn-secondary" onClick={() => setDetailVehicle(v)} title="View Details">
                                <Icons.Clock size={14} />
                              </button>
                              {isAdminOrManager && (
                                <button className="btn btn-sm btn-secondary" onClick={() => { setEditVehicle(v); setShowVehicleModal(true); }} title="Edit">
                                  <Icons.Edit size={14} />
                                </button>
                              )}
                              {isAdminOrManager && (
                                <select
                                  className="form-input"
                                  value={v.vehicle_status}
                                  onChange={e => handleStatusChange(v, e.target.value)}
                                  style={{ padding: '4px 6px', fontSize: '0.75rem', minWidth: '100px' }}
                                >
                                  {VEHICLE_STATUSES.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                  ))}
                                </select>
                              )}
                              {isAdminOrManager && (
                                <button className="btn btn-sm btn-danger" onClick={() => handleDeleteVehicle(v)} title="Delete">
                                  <Icons.Trash size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Checkouts Tab */}
      {activeTab === 'checkouts' && (
        <>
          <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by driver, vehicle, destination..."
                value={checkoutSearch}
                onChange={e => setCheckoutSearch(e.target.value)}
                style={{ flex: 1, minWidth: '200px' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={showReturned}
                  onChange={e => setShowReturned(e.target.checked)}
                />
                Show returned trips
              </label>
            </div>
          </div>

          <div className="card">
            {filteredCheckouts.length === 0 ? (
              <div className="empty-state">
                <h3>No checkout records found</h3>
                <p>Click "Vehicle Checkout" to record a new trip</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Driver</th>
                      <th>Date</th>
                      <th>Destination</th>
                      <th>Odometer</th>
                      <th>Condition</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCheckouts.map(c => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.vehicles?.make} {c.vehicles?.model}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {c.vehicles?.registration_number}
                          </div>
                        </td>
                        <td>
                          <strong>{c.driver_name}</strong>
                          {c.driver_changed && c.new_driver_name && (
                            <div style={{ fontSize: '0.75rem', color: '#f39c12' }}>→ {c.new_driver_name}</div>
                          )}
                          {c.supervisor && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Sup: {c.supervisor}</div>
                          )}
                        </td>
                        <td>{new Date(c.checkout_date).toLocaleDateString()}</td>
                        <td>
                          <div>{c.destination || '-'}</div>
                          {c.reason_for_use && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.reason_for_use}</div>
                          )}
                        </td>
                        <td>
                          <div>{c.start_odometer?.toLocaleString()}</div>
                          {c.end_odometer && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              → {c.end_odometer.toLocaleString()} ({(c.end_odometer - c.start_odometer).toLocaleString()} km)
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${c.vehicle_condition === 'Excellent' ? 'badge-available' : c.vehicle_condition === 'Good' ? 'badge-available' : c.vehicle_condition === 'Average' ? 'badge-low-stock' : 'badge-overdue'}`}>
                            {c.vehicle_condition || 'Good'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${c.is_returned ? 'badge-checked-out' : 'badge-available'}`}>
                            {c.is_returned ? 'Returned' : 'Out'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                            {!c.is_returned && (
                              <button className="btn btn-sm btn-primary" onClick={() => setReturnCheckout(c)} title="Return Vehicle">
                                Return
                              </button>
                            )}
                            {isAdminOrManager && (
                              <button className="btn btn-sm btn-secondary" onClick={() => { setEditCheckout(c); setShowCheckoutModal(true); }} title="Edit">
                                <Icons.Edit size={14} />
                              </button>
                            )}
                            {isAdminOrManager && (
                              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteCheckout(c)} title="Delete">
                                <Icons.Trash size={14} />
                              </button>
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
        </>
      )}

      {/* Fines Tab */}
      {activeTab === 'fines' && (
        <div className="card">
          {fines.length === 0 ? (
            <div className="empty-state">
              <h3>No fines recorded</h3>
              <p>Click "Record Fine" to add a fine</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Driver</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fines.map(f => (
                    <tr key={f.id}>
                      <td>
                        <strong>{f.vehicles?.make} {f.vehicles?.model}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {f.vehicles?.registration_number}
                        </div>
                      </td>
                      <td><strong>{f.driver_name}</strong></td>
                      <td>{new Date(f.fine_date).toLocaleDateString()}</td>
                      <td>{f.fine_type || '-'}</td>
                      <td style={{ fontWeight: 600 }}>{f.fine_amount ? `R ${parseFloat(f.fine_amount).toFixed(2)}` : '-'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{f.fine_reference || '-'}</td>
                      <td>
                        <span className={`badge ${f.status === 'Paid' ? 'badge-available' : 'badge-overdue'}`}>{f.status}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {isAdminOrManager && (
                            <button className="btn btn-sm btn-secondary" onClick={() => { setEditFine(f); setShowFineModal(true); }}>
                              <Icons.Edit size={14} />
                            </button>
                          )}
                          {isAdminOrManager && (
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteFine(f)}>
                              <Icons.Trash size={14} />
                            </button>
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
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <div className="card">
          {services.length === 0 ? (
            <div className="empty-state">
              <h3>No service records</h3>
              <p>Click "Record Service" to log a service or repair</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Odometer</th>
                    <th>Provider</th>
                    <th>Cost</th>
                    <th>Next Service</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(s => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.vehicles?.make} {s.vehicles?.model}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {s.vehicles?.registration_number}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${s.service_type === 'Service' ? 'badge-available' : 'badge-low-stock'}`}>
                          {s.service_type}
                        </span>
                      </td>
                      <td>{new Date(s.service_date).toLocaleDateString()}</td>
                      <td>{s.odometer_at_service ? s.odometer_at_service.toLocaleString() + ' km' : '-'}</td>
                      <td>{s.service_provider || '-'}</td>
                      <td style={{ fontWeight: 600 }}>{s.cost ? `R ${parseFloat(s.cost).toFixed(2)}` : '-'}</td>
                      <td>{s.next_service_date ? new Date(s.next_service_date).toLocaleDateString() : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {isAdminOrManager && (
                            <button className="btn btn-sm btn-secondary" onClick={() => { setEditService(s); setShowServiceModal(true); }}>
                              <Icons.Edit size={14} />
                            </button>
                          )}
                          {isAdminOrManager && (
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteService(s)}>
                              <Icons.Trash size={14} />
                            </button>
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
      )}

      {/* ===== MODALS ===== */}

      {showVehicleModal && (
        <VehicleModal
          item={editVehicle}
          onClose={() => { setShowVehicleModal(false); setEditVehicle(null); }}
          onSuccess={() => { setShowVehicleModal(false); setEditVehicle(null); fetchData(); }}
        />
      )}

      {showCheckoutModal && (
        <CheckoutModal
          item={editCheckout}
          vehicles={vehicles.filter(v => v.is_active)}
          personnel={personnel}
          onClose={() => { setShowCheckoutModal(false); setEditCheckout(null); }}
          onSuccess={() => { setShowCheckoutModal(false); setEditCheckout(null); fetchData(); }}
        />
      )}

      {returnCheckout && (
        <ReturnModal
          checkout={returnCheckout}
          onClose={() => setReturnCheckout(null)}
          onReturn={handleReturnVehicle}
        />
      )}

      {showFineModal && (
        <FineModal
          item={editFine}
          vehicles={vehicles}
          personnel={personnel}
          onClose={() => { setShowFineModal(false); setEditFine(null); }}
          onSuccess={() => { setShowFineModal(false); setEditFine(null); fetchData(); }}
        />
      )}

      {showServiceModal && (
        <ServiceModal
          item={editService}
          vehicles={vehicles}
          onClose={() => { setShowServiceModal(false); setEditService(null); }}
          onSuccess={() => { setShowServiceModal(false); setEditService(null); fetchData(); }}
        />
      )}

      {detailVehicle && (
        <VehicleDetailModal
          vehicle={detailVehicle}
          onClose={() => setDetailVehicle(null)}
        />
      )}
    </div>
  );
}


// ============================================
// Vehicle Add/Edit Modal
// ============================================
function VehicleModal({ item, onClose, onSuccess }) {
  const [form, setForm] = useState({
    qr_code: item?.qr_code || '',
    make: item?.make || '',
    model: item?.model || '',
    registration_number: item?.registration_number || '',
    year: item?.year || '',
    color: item?.color || '',
    fuel_type: item?.fuel_type || '',
    vin_number: item?.vin_number || '',
    assigned_to: item?.assigned_to || '',
    vehicle_status: item?.vehicle_status || 'Active',
    license_disk_expiry: item?.license_disk_expiry || '',
    registration_expiry: item?.registration_expiry || '',
    next_service_date: item?.next_service_date || '',
    next_service_odometer: item?.next_service_odometer || '',
    current_odometer: item?.current_odometer || '',
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.make || !form.model || !form.registration_number) {
      alert('Please fill in make, model, and registration number');
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form };
      // Clean empty fields
      Object.keys(payload).forEach(k => {
        if (payload[k] === '') payload[k] = null;
      });
      if (payload.year) payload.year = parseInt(payload.year, 10);
      if (payload.current_odometer) payload.current_odometer = parseInt(payload.current_odometer, 10);
      if (payload.next_service_odometer) payload.next_service_odometer = parseInt(payload.next_service_odometer, 10);
      payload.is_active = !['Decommissioned', 'Sold', 'Written Off'].includes(payload.vehicle_status);

      if (item) {
        await vehiclesApi.update(item.id, payload);
      } else {
        await vehiclesApi.create(payload);
      }
      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>{item ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Make *</label>
                <select name="make" value={form.make} onChange={handleChange} className="form-input" required>
                  <option value="">-- Select Make --</option>
                  {['Toyota', 'Ford', 'Volkswagen', 'Nissan', 'Isuzu', 'Hyundai', 'Kia', 'Mercedes-Benz', 'BMW', 'Renault', 'Mitsubishi', 'Mazda', 'Suzuki', 'Chevrolet', 'Other'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Model *</label>
                <input type="text" name="model" value={form.model} onChange={handleChange} className="form-input" placeholder="e.g. Hilux (D/C)" required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Registration Number *</label>
                <input type="text" name="registration_number" value={form.registration_number} onChange={handleChange} className="form-input" placeholder="e.g. BR 02 GL ZN" required />
              </div>
              <div className="form-group">
                <label className="form-label">Year</label>
                <input type="number" name="year" value={form.year} onChange={handleChange} className="form-input" placeholder="e.g. 2023" min="1990" max="2030" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Color</label>
                <input type="text" name="color" value={form.color} onChange={handleChange} className="form-input" placeholder="e.g. White" />
              </div>
              <div className="form-group">
                <label className="form-label">Fuel Type</label>
                <select name="fuel_type" value={form.fuel_type} onChange={handleChange} className="form-input">
                  <option value="">-- Select --</option>
                  {['Petrol', 'Diesel', 'Hybrid', 'Electric'].map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">VIN Number</label>
                <input type="text" name="vin_number" value={form.vin_number} onChange={handleChange} className="form-input" placeholder="Vehicle Identification Number" />
              </div>
              <div className="form-group">
                <label className="form-label">Assigned To</label>
                <input type="text" name="assigned_to" value={form.assigned_to} onChange={handleChange} className="form-input" placeholder="e.g. Pool Vehicle, RS Pool Vehicle" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">QR Code</label>
                <input type="text" name="qr_code" value={form.qr_code} onChange={handleChange} className="form-input" placeholder="QR code identifier" />
              </div>
              <div className="form-group">
                <label className="form-label">Current Odometer (km)</label>
                <input type="number" name="current_odometer" value={form.current_odometer} onChange={handleChange} className="form-input" placeholder="e.g. 45000" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">License Disk Expiry</label>
                <input type="date" name="license_disk_expiry" value={form.license_disk_expiry} onChange={handleChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Registration Expiry</label>
                <input type="date" name="registration_expiry" value={form.registration_expiry} onChange={handleChange} className="form-input" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Next Service Date</label>
                <input type="date" name="next_service_date" value={form.next_service_date} onChange={handleChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Next Service Odometer (km)</label>
                <input type="number" name="next_service_odometer" value={form.next_service_odometer} onChange={handleChange} className="form-input" placeholder="e.g. 55000" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select name="vehicle_status" value={form.vehicle_status} onChange={handleChange} className="form-input">
                {VEHICLE_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} className="form-input" rows="2" placeholder="Any additional notes" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (item ? 'Update Vehicle' : 'Add Vehicle')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ============================================
// Vehicle Checkout / Pre-Trip Inspection Modal
// ============================================
function CheckoutModal({ item, vehicles, personnel, onClose, onSuccess }) {
  const [form, setForm] = useState({
    vehicle_id: item?.vehicle_id || '',
    driver_name: item?.driver_name || '',
    driver_license_number: item?.driver_license_number || '',
    driver_license_expiry: item?.driver_license_expiry || '',
    supervisor: item?.supervisor || '',
    checkout_date: item?.checkout_date ? item.checkout_date.split('T')[0] : new Date().toISOString().split('T')[0],
    destination: item?.destination || '',
    reason_for_use: item?.reason_for_use || '',
    start_odometer: item?.start_odometer || '',
    vehicle_condition: item?.vehicle_condition || 'Good',

    // Pre-trip inspection
    check_sanitized: item?.check_sanitized || 'N/A',
    check_bodywork: item?.check_bodywork || 'Good',
    check_tyres: item?.check_tyres || 'Good',
    check_oil_water: item?.check_oil_water || 'Yes',
    check_fuel: item?.check_fuel || 'Yes',
    check_first_auto_aa_cards: item?.check_first_auto_aa_cards || 'Yes',
    check_windscreen_wipers_mirrors: item?.check_windscreen_wipers_mirrors || 'Good',
    check_lights: item?.check_lights || 'Yes',
    check_spare_tyre_jack: item?.check_spare_tyre_jack || 'Yes',
    check_brakes: item?.check_brakes || 'Yes',
    check_hooter: item?.check_hooter || 'Yes',
    check_warning_triangle: item?.check_warning_triangle || 'Yes',
    check_license_disk: item?.check_license_disk || 'Yes',
    check_fire_extinguisher: item?.check_fire_extinguisher || 'Yes',
    check_first_aid_kit: item?.check_first_aid_kit || 'Yes',
    check_warning_lights: item?.check_warning_lights || 'Yes',
    check_wheel_chocks: item?.check_wheel_chocks || 'N/A',

    first_aid_kit_contents: item?.first_aid_kit_contents || '',
    condition_notes: item?.condition_notes || '',
    checks_not_performed_reason: item?.checks_not_performed_reason || '',

    driver_changed: item?.driver_changed || false,
    new_driver_name: item?.new_driver_name || '',

    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [licenseWarning, setLicenseWarning] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleDriverSelect = (e) => {
    const personId = e.target.value;
    const person = personnel.find(p => String(p.id) === personId);
    if (person) {
      setForm(prev => ({ ...prev, driver_name: person.full_name }));
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

  const handleVehicleSelect = (e) => {
    const vId = e.target.value;
    const vehicle = vehicles.find(v => String(v.id) === vId);
    setForm(prev => ({
      ...prev,
      vehicle_id: vId,
      start_odometer: vehicle?.current_odometer || prev.start_odometer,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id || !form.driver_name || !form.start_odometer) {
      alert('Please select a vehicle, driver, and enter the start odometer');
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
      // Clean empty fields
      Object.keys(payload).forEach(k => {
        if (payload[k] === '') payload[k] = null;
      });
      payload.driver_changed = form.driver_changed;

      if (item) {
        await vehicleCheckoutsApi.update(item.id, payload);
      } else {
        await vehicleCheckoutsApi.create(payload);
      }
      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const inspectionChecks = [
    { key: 'check_sanitized', label: 'Sanitizing of vehicle' },
    { key: 'check_bodywork', label: 'Vehicle bodywork' },
    { key: 'check_tyres', label: 'Tyres & tyre pressure' },
    { key: 'check_oil_water', label: 'Oil & water' },
    { key: 'check_fuel', label: 'Fuel' },
    { key: 'check_first_auto_aa_cards', label: 'First Auto & AA cards in vehicle' },
    { key: 'check_windscreen_wipers_mirrors', label: 'Windscreen, windows, wiper blades & mirrors' },
    { key: 'check_lights', label: 'Lights (front/rear & indicators)' },
    { key: 'check_spare_tyre_jack', label: 'Spare tyre, jack & wheel spanner' },
    { key: 'check_brakes', label: 'Brakes' },
    { key: 'check_hooter', label: 'Hooter' },
    { key: 'check_warning_triangle', label: 'Warning triangle' },
    { key: 'check_license_disk', label: 'License disk' },
    { key: 'check_fire_extinguisher', label: 'Fire extinguisher' },
    { key: 'check_first_aid_kit', label: 'First aid kit' },
    { key: 'check_warning_lights', label: 'Vehicle warning lights' },
    { key: 'check_wheel_chocks', label: 'Wheel chocks (where issued)' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h2>{item ? 'Edit Vehicle Checkout' : 'Vehicle Checkout — Pre-Trip Inspection'}</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '75vh', overflowY: 'auto' }}>

            {/* Vehicle Selection */}
            <div className="form-group">
              <label className="form-label">Vehicle *</label>
              <select name="vehicle_id" value={form.vehicle_id} onChange={handleVehicleSelect} className="form-input" required>
                <option value="">-- Select Vehicle --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.make} {v.model} — {v.registration_number}</option>
                ))}
              </select>
            </div>

            {/* Driver Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Driver *</label>
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
                  {personnel.map(p => (
                    <option key={p.id} value={p.full_name}>{p.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
              <div style={{ padding: '8px 12px', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid var(--error-color)', borderRadius: '6px', color: 'var(--error-color)', fontWeight: 600, fontSize: '0.85rem' }}>
                ⚠ {licenseWarning}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" name="checkout_date" value={form.checkout_date} onChange={handleChange} className="form-input" required />
              </div>
              <div className="form-group">
                <label className="form-label">Start Odometer *</label>
                <input type="number" name="start_odometer" value={form.start_odometer} onChange={handleChange} className="form-input" placeholder="e.g. 45000" required />
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle Condition</label>
                <select name="vehicle_condition" value={form.vehicle_condition} onChange={handleChange} className="form-input">
                  {CONDITION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Destination</label>
                <input type="text" name="destination" value={form.destination} onChange={handleChange} className="form-input" placeholder="e.g. Two Rivers" />
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Vehicle Usage</label>
                <input type="text" name="reason_for_use" value={form.reason_for_use} onChange={handleChange} className="form-input" placeholder="e.g. Work, Client Visit" />
              </div>
            </div>

            {/* Pre-Trip Inspection Checklist */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem' }}>Pre-Trip Inspection Checklist</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {inspectionChecks.map(check => (
                  <div key={check.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                    <label style={{ fontSize: '0.85rem', flex: 1 }}>{check.label}</label>
                    <select
                      name={check.key}
                      value={form[check.key]}
                      onChange={handleChange}
                      className="form-input"
                      style={{ width: '110px', padding: '4px 6px', fontSize: '0.8rem' }}
                    >
                      {CHECK_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">First Aid Kit Contents</label>
              <select name="first_aid_kit_contents" value={form.first_aid_kit_contents} onChange={handleChange} className="form-input">
                <option value="">-- Select --</option>
                <option value="All items present / Nothing missing">All items present / Nothing missing</option>
                <option value="Some items missing">Some items missing</option>
                <option value="Kit not present">Kit not present</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Reason for vehicle condition (if not Excellent)</label>
              <textarea name="condition_notes" value={form.condition_notes} onChange={handleChange} className="form-input" rows="2" placeholder="Describe any issues..." />
            </div>

            <div className="form-group">
              <label className="form-label">Reason for any checks not performed</label>
              <textarea name="checks_not_performed_reason" value={form.checks_not_performed_reason} onChange={handleChange} className="form-input" rows="2" />
            </div>

            {/* Driver Change */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                <input type="checkbox" name="driver_changed" checked={form.driver_changed} onChange={handleChange} />
                <strong>Driver Changed During Trip</strong>
              </label>
              {form.driver_changed && (
                <div className="form-group" style={{ marginTop: '8px' }}>
                  <label className="form-label">New Driver Name</label>
                  <select onChange={(e) => { const p = personnel.find(pp => String(pp.id) === e.target.value); if (p) setForm(prev => ({ ...prev, new_driver_name: p.full_name })); }} className="form-input">
                    <option value="">-- Select New Driver --</option>
                    {personnel.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Additional Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} className="form-input" rows="2" placeholder="Any additional notes..." />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (item ? 'Update' : 'Submit Checkout')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ============================================
// Return Vehicle Modal
// ============================================
function ReturnModal({ checkout, onClose, onReturn }) {
  const [endOdometer, setEndOdometer] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!endOdometer) { alert('Please enter the end odometer reading'); return; }
    if (parseInt(endOdometer, 10) < checkout.start_odometer) {
      alert('End odometer cannot be less than start odometer');
      return;
    }
    setSaving(true);
    await onReturn(parseInt(endOdometer, 10));
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2>Return Vehicle</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '10px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px' }}>
              <strong>{checkout.driver_name}</strong>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {checkout.vehicles?.make} {checkout.vehicles?.model} — {checkout.vehicles?.registration_number}
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                Start odometer: <strong>{checkout.start_odometer?.toLocaleString()} km</strong>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">End Odometer (km) *</label>
              <input
                type="number"
                value={endOdometer}
                onChange={e => setEndOdometer(e.target.value)}
                className="form-input"
                placeholder="e.g. 45250"
                required
                min={checkout.start_odometer}
              />
            </div>
            {endOdometer && parseInt(endOdometer, 10) > checkout.start_odometer && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Distance travelled: <strong>{(parseInt(endOdometer, 10) - checkout.start_odometer).toLocaleString()} km</strong>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Returning...' : 'Return Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ============================================
// Fine Modal
// ============================================
function FineModal({ item, vehicles, personnel, onClose, onSuccess }) {
  const [form, setForm] = useState({
    vehicle_id: item?.vehicle_id || '',
    driver_name: item?.driver_name || '',
    fine_date: item?.fine_date || new Date().toISOString().split('T')[0],
    fine_amount: item?.fine_amount || '',
    fine_type: item?.fine_type || '',
    fine_reference: item?.fine_reference || '',
    description: item?.description || '',
    status: item?.status || 'Unpaid',
    paid_date: item?.paid_date || '',
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id || !form.driver_name || !form.fine_date) {
      alert('Please fill in vehicle, driver, and date');
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form };
      payload.vehicle_id = parseInt(payload.vehicle_id, 10);
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
      if (payload.fine_amount) payload.fine_amount = parseFloat(payload.fine_amount);

      if (item) {
        await vehicleFinesApi.update(item.id, payload);
      } else {
        await vehicleFinesApi.create(payload);
      }
      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
        <div className="modal-header">
          <h2>{item ? 'Edit Fine' : 'Record Fine'}</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="form-group">
              <label className="form-label">Vehicle *</label>
              <select name="vehicle_id" value={form.vehicle_id} onChange={handleChange} className="form-input" required>
                <option value="">-- Select Vehicle --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.make} {v.model} — {v.registration_number}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Driver *</label>
                <select name="driver_name" value={form.driver_name} onChange={handleChange} className="form-input" required>
                  <option value="">-- Select Driver --</option>
                  {personnel.map(p => (
                    <option key={p.id} value={p.full_name}>{p.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fine Date *</label>
                <input type="date" name="fine_date" value={form.fine_date} onChange={handleChange} className="form-input" required />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Fine Type</label>
                <select name="fine_type" value={form.fine_type} onChange={handleChange} className="form-input">
                  <option value="">-- Select Type --</option>
                  {['Speeding', 'Red Light', 'Parking', 'License Disk', 'Overloading', 'Reckless Driving', 'Other'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount (R)</label>
                <input type="number" name="fine_amount" value={form.fine_amount} onChange={handleChange} className="form-input" step="0.01" placeholder="e.g. 500.00" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Reference Number</label>
                <input type="text" name="fine_reference" value={form.fine_reference} onChange={handleChange} className="form-input" placeholder="Fine reference #" />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select name="status" value={form.status} onChange={handleChange} className="form-input">
                  <option value="Unpaid">Unpaid</option>
                  <option value="Paid">Paid</option>
                  <option value="Disputed">Disputed</option>
                  <option value="Written Off">Written Off</option>
                </select>
              </div>
            </div>
            {form.status === 'Paid' && (
              <div className="form-group">
                <label className="form-label">Date Paid</label>
                <input type="date" name="paid_date" value={form.paid_date} onChange={handleChange} className="form-input" />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} className="form-input" rows="2" placeholder="Details about the fine..." />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} className="form-input" rows="2" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (item ? 'Update' : 'Record Fine')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ============================================
// Service / Repair Modal
// ============================================
function ServiceModal({ item, vehicles, onClose, onSuccess }) {
  const [form, setForm] = useState({
    vehicle_id: item?.vehicle_id || '',
    service_type: item?.service_type || 'Service',
    service_date: item?.service_date || new Date().toISOString().split('T')[0],
    odometer_at_service: item?.odometer_at_service || '',
    description: item?.description || '',
    service_provider: item?.service_provider || '',
    cost: item?.cost || '',
    next_service_date: item?.next_service_date || '',
    next_service_odometer: item?.next_service_odometer || '',
    status: item?.status || 'Completed',
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id || !form.service_date) {
      alert('Please select a vehicle and service date');
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form };
      payload.vehicle_id = parseInt(payload.vehicle_id, 10);
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
      if (payload.odometer_at_service) payload.odometer_at_service = parseInt(payload.odometer_at_service, 10);
      if (payload.next_service_odometer) payload.next_service_odometer = parseInt(payload.next_service_odometer, 10);
      if (payload.cost) payload.cost = parseFloat(payload.cost);

      if (item) {
        await vehicleServicesApi.update(item.id, payload);
      } else {
        await vehicleServicesApi.create(payload);
      }

      // Update the vehicle's next service info if provided
      if (payload.next_service_date || payload.next_service_odometer) {
        const updates = {};
        if (payload.next_service_date) updates.next_service_date = payload.next_service_date;
        if (payload.next_service_odometer) updates.next_service_odometer = payload.next_service_odometer;
        if (payload.odometer_at_service) updates.current_odometer = payload.odometer_at_service;
        await vehiclesApi.update(payload.vehicle_id, updates);
      }

      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
        <div className="modal-header">
          <h2>{item ? 'Edit Service Record' : 'Record Service / Repair'}</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="form-group">
              <label className="form-label">Vehicle *</label>
              <select name="vehicle_id" value={form.vehicle_id} onChange={handleChange} className="form-input" required>
                <option value="">-- Select Vehicle --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.make} {v.model} — {v.registration_number}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select name="service_type" value={form.service_type} onChange={handleChange} className="form-input">
                  <option value="Service">Service</option>
                  <option value="Repair">Repair</option>
                  <option value="Tyres">Tyres</option>
                  <option value="Body Work">Body Work</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Service Date *</label>
                <input type="date" name="service_date" value={form.service_date} onChange={handleChange} className="form-input" required />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Odometer at Service (km)</label>
                <input type="number" name="odometer_at_service" value={form.odometer_at_service} onChange={handleChange} className="form-input" placeholder="e.g. 50000" />
              </div>
              <div className="form-group">
                <label className="form-label">Cost (R)</label>
                <input type="number" name="cost" value={form.cost} onChange={handleChange} className="form-input" step="0.01" placeholder="e.g. 3500.00" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Service Provider</label>
              <input type="text" name="service_provider" value={form.service_provider} onChange={handleChange} className="form-input" placeholder="e.g. Toyota Dealer, John's Auto" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} className="form-input" rows="3" placeholder="What was done..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Next Service Date</label>
                <input type="date" name="next_service_date" value={form.next_service_date} onChange={handleChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Next Service Odometer (km)</label>
                <input type="number" name="next_service_odometer" value={form.next_service_odometer} onChange={handleChange} className="form-input" placeholder="e.g. 60000" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select name="status" value={form.status} onChange={handleChange} className="form-input">
                <option value="Completed">Completed</option>
                <option value="In Progress">In Progress</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} className="form-input" rows="2" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (item ? 'Update' : 'Record Service')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ============================================
// Vehicle Detail Modal (history overview)
// ============================================
function VehicleDetailModal({ vehicle, onClose }) {
  const [checkouts, setCheckouts] = useState([]);
  const [fines, setFines] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      vehicleCheckoutsApi.getAllIncludingReturned(vehicle.id),
      vehicleFinesApi.getAll(vehicle.id),
      vehicleServicesApi.getAll(vehicle.id),
    ]).then(([c, f, s]) => {
      setCheckouts(c.data || []);
      setFines(f.data || []);
      setServices(s.data || []);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, [vehicle.id]);

  const totalFines = fines.reduce((sum, f) => sum + (parseFloat(f.fine_amount) || 0), 0);
  const unpaidFines = fines.filter(f => f.status === 'Unpaid');
  const totalServiceCost = services.reduce((sum, s) => sum + (parseFloat(s.cost) || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h2>{vehicle.make} {vehicle.model} — {vehicle.registration_number}</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {loading ? (
            <div className="loading"><div className="spinner"></div> Loading...</div>
          ) : (
            <>
              {/* Vehicle Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{checkouts.length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Trips</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: fines.length > 0 ? 'var(--error-color)' : 'inherit' }}>{fines.length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Fines (R {totalFines.toFixed(2)})</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: unpaidFines.length > 0 ? 'var(--error-color)' : 'var(--success-color)' }}>{unpaidFines.length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Unpaid Fines</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{services.length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Services (R {totalServiceCost.toFixed(2)})</div>
                </div>
              </div>

              {/* Vehicle Details */}
              <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                  {vehicle.year && <div><strong>Year:</strong> {vehicle.year}</div>}
                  {vehicle.color && <div><strong>Color:</strong> {vehicle.color}</div>}
                  {vehicle.vin_number && <div><strong>VIN:</strong> {vehicle.vin_number}</div>}
                  {vehicle.qr_code && <div><strong>QR Code:</strong> {vehicle.qr_code}</div>}
                  <div><strong>Odometer:</strong> {vehicle.current_odometer ? vehicle.current_odometer.toLocaleString() + ' km' : 'N/A'}</div>
                  <div><strong>Status:</strong> {vehicle.vehicle_status}</div>
                  {vehicle.license_disk_expiry && <div><strong>License Disk Expiry:</strong> {new Date(vehicle.license_disk_expiry).toLocaleDateString()}</div>}
                  {vehicle.next_service_date && <div><strong>Next Service:</strong> {new Date(vehicle.next_service_date).toLocaleDateString()}</div>}
                </div>
                {vehicle.notes && <div style={{ marginTop: '8px', fontSize: '0.85rem' }}><strong>Notes:</strong> {vehicle.notes}</div>}
              </div>

              {/* Recent Trips */}
              <h3 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>Recent Trips (last 10)</h3>
              {checkouts.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No trips recorded</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                  {checkouts.slice(0, 10).map(c => (
                    <div key={c.id} style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.83rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{c.driver_name}</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>{new Date(c.checkout_date).toLocaleDateString()}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        {c.destination || c.reason_for_use || '-'} | Odometer: {c.start_odometer?.toLocaleString()}
                        {c.end_odometer ? ` → ${c.end_odometer.toLocaleString()} (${(c.end_odometer - c.start_odometer).toLocaleString()} km)` : ''}
                        <span className={`badge ${c.is_returned ? 'badge-checked-out' : 'badge-available'}`} style={{ marginLeft: '8px', fontSize: '0.7rem' }}>
                          {c.is_returned ? 'Returned' : 'Out'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fines */}
              {fines.length > 0 && (
                <>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>Fines</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                    {fines.map(f => (
                      <div key={f.id} style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.83rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{f.driver_name} — {f.fine_type || 'Fine'}</strong>
                          <span className={`badge ${f.status === 'Paid' ? 'badge-available' : 'badge-overdue'}`}>{f.status}</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {new Date(f.fine_date).toLocaleDateString()} | R {parseFloat(f.fine_amount || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Services */}
              {services.length > 0 && (
                <>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>Service History</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {services.map(s => (
                      <div key={s.id} style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.83rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{s.service_type} — {s.service_provider || 'N/A'}</strong>
                          <span style={{ color: 'var(--text-secondary)' }}>{new Date(s.service_date).toLocaleDateString()}</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {s.description || '-'} | R {parseFloat(s.cost || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default Vehicles;
