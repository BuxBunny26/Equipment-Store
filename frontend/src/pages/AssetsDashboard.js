import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { laptopAssignmentsApi, cellphoneAssignmentsApi, vehiclesApi, vehicleCheckoutsApi, vehicleFinesApi } from '../services/api';
import { Icons } from '../components/Icons';

function AssetsDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [laptops, setLaptops] = useState([]);
  const [cellphones, setCellphones] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [activeCheckouts, setActiveCheckouts] = useState([]);
  const [fines, setFines] = useState([]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [laptopRes, phoneRes, vehicleRes, checkoutRes, fineRes] = await Promise.all([
        laptopAssignmentsApi.getAll(false),
        cellphoneAssignmentsApi.getAll(false),
        vehiclesApi.getAll(false),
        vehicleCheckoutsApi.getAll(),
        vehicleFinesApi.getAll(),
      ]);
      setLaptops(laptopRes.data || []);
      setCellphones(phoneRes.data || []);
      setVehicles(vehicleRes.data || []);
      setActiveCheckouts(checkoutRes.data || []);
      setFines(fineRes.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading assets dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        Error loading assets: {error}
        <button className="btn btn-sm btn-secondary" onClick={fetchAll} style={{ marginLeft: 'auto' }}>Retry</button>
      </div>
    );
  }

  // Laptop stats
  const laptopActive = laptops.filter(l => l.laptop_status === 'Active').length;
  const laptopRepairs = laptops.filter(l => l.laptop_status === 'Repairs').length;
  const laptopDamaged = laptops.filter(l => ['Damaged', 'Stolen', 'Lost'].includes(l.laptop_status)).length;

  // Cellphone stats
  const phoneActive = cellphones.filter(c => c.phone_status === 'Active').length;
  const phoneRepairs = cellphones.filter(c => c.phone_status === 'Repairs').length;
  const phoneDamaged = cellphones.filter(c => ['Damaged', 'Stolen', 'Lost'].includes(c.phone_status)).length;

  // Vehicle stats
  const vehicleAvailable = vehicles.filter(v => v.vehicle_status === 'Active').length;
  const vehicleInUse = vehicles.filter(v => v.vehicle_status === 'In Use').length;
  const vehicleService = vehicles.filter(v => ['In Service', 'Repairs'].includes(v.vehicle_status)).length;
  const vehicleActive = vehicles.filter(v => v.is_active).length;

  // Vehicle alerts
  const licenseDiskAlerts = vehicles.filter(v => {
    if (!v.license_disk_expiry || !v.is_active) return false;
    const daysUntil = (new Date(v.license_disk_expiry) - new Date()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 30;
  });
  const serviceAlerts = vehicles.filter(v => {
    if (!v.next_service_date || !v.is_active) return false;
    const daysUntil = (new Date(v.next_service_date) - new Date()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 30;
  });

  // Fine stats
  const unpaidFines = fines.filter(f => f.status === 'Unpaid');
  const totalUnpaid = unpaidFines.reduce((sum, f) => sum + (parseFloat(f.fine_amount) || 0), 0);

  // Total asset count
  const totalAssets = laptops.length + cellphones.length + vehicles.length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Assets Dashboard</h1>
          <p className="page-subtitle">Overview of all company assets — laptops, cellphones & vehicles</p>
        </div>
      </div>

      {/* Alerts */}
      {(licenseDiskAlerts.length > 0 || serviceAlerts.length > 0 || unpaidFines.length > 0) && (
        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {licenseDiskAlerts.map(v => (
            <div key={`lic-${v.id}`} className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icons.Warning size={16} />
              <span>
                <strong>{v.registration_number}</strong> — License disk {new Date(v.license_disk_expiry) < new Date() ? 'EXPIRED' : 'expiring soon'}: {new Date(v.license_disk_expiry).toLocaleDateString()}
              </span>
              <Link to="/vehicles" className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }}>View</Link>
            </div>
          ))}
          {serviceAlerts.map(v => (
            <div key={`svc-${v.id}`} className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(243, 156, 18, 0.1)', borderColor: '#f39c12', color: '#f39c12' }}>
              <Icons.Wrench size={16} />
              <span>
                <strong>{v.registration_number}</strong> — Service {new Date(v.next_service_date) < new Date() ? 'OVERDUE' : 'due soon'}: {new Date(v.next_service_date).toLocaleDateString()}
              </span>
              <Link to="/vehicles" className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }}>View</Link>
            </div>
          ))}
          {unpaidFines.length > 0 && (
            <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icons.Warning size={16} />
              <span><strong>{unpaidFines.length}</strong> unpaid vehicle fine{unpaidFines.length > 1 ? 's' : ''} totalling <strong>R {totalUnpaid.toFixed(2)}</strong></span>
              <Link to="/vehicles" className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }}>View</Link>
            </div>
          )}
        </div>
      )}

      {/* Overall Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Icons.Package size={24} /></div>
          <div className="stat-content">
            <h3>{totalAssets}</h3>
            <p>Total Assets</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Icons.Check size={24} /></div>
          <div className="stat-content">
            <h3>{laptopActive + phoneActive + vehicleAvailable}</h3>
            <p>Active / Available</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Icons.Wrench size={24} /></div>
          <div className="stat-content">
            <h3>{laptopRepairs + phoneRepairs + vehicleService}</h3>
            <p>In Repairs / Service</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><Icons.Warning size={24} /></div>
          <div className="stat-content">
            <h3>{laptopDamaged + phoneDamaged + licenseDiskAlerts.length}</h3>
            <p>Needs Attention</p>
          </div>
        </div>
      </div>

      {/* Three Column Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>

        {/* Laptops Card */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9" />
                <path d="M2 17h20l-1 2H3l-1-2z" />
              </svg>
              Laptops
            </h2>
            <Link to="/laptop-assignments" className="btn btn-sm btn-secondary">View All</Link>
          </div>
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1rem' }}>
            <div className="stat-card">
              <div className="stat-icon green"><Icons.Check size={20} /></div>
              <div className="stat-content">
                <h3>{laptopActive}</h3>
                <p>Active</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon orange"><Icons.Wrench size={20} /></div>
              <div className="stat-content">
                <h3>{laptopRepairs}</h3>
                <p>Repairs</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total</span>
            <strong>{laptops.length}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Damaged / Stolen / Lost</span>
            <strong style={{ color: laptopDamaged > 0 ? 'var(--error-color)' : 'inherit' }}>{laptopDamaged}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Returned / Decommissioned</span>
            <strong>{laptops.filter(l => ['Returned', 'Decommissioned'].includes(l.laptop_status)).length}</strong>
          </div>
        </div>

        {/* Cellphones Card */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <rect x="7" y="2" width="10" height="20" rx="2" ry="2" />
                <line x1="11" y1="18" x2="13" y2="18" />
              </svg>
              Cellphones
            </h2>
            <Link to="/cellphone-assignments" className="btn btn-sm btn-secondary">View All</Link>
          </div>
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1rem' }}>
            <div className="stat-card">
              <div className="stat-icon green"><Icons.Check size={20} /></div>
              <div className="stat-content">
                <h3>{phoneActive}</h3>
                <p>Active</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon orange"><Icons.Wrench size={20} /></div>
              <div className="stat-content">
                <h3>{phoneRepairs}</h3>
                <p>Repairs</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total</span>
            <strong>{cellphones.length}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Damaged / Stolen / Lost</span>
            <strong style={{ color: phoneDamaged > 0 ? 'var(--error-color)' : 'inherit' }}>{phoneDamaged}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Returned / Decommissioned</span>
            <strong>{cellphones.filter(c => ['Returned', 'Decommissioned'].includes(c.phone_status)).length}</strong>
          </div>
        </div>

        {/* Vehicles Card */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              Vehicles
            </h2>
            <Link to="/vehicles" className="btn btn-sm btn-secondary">View All</Link>
          </div>
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1rem' }}>
            <div className="stat-card">
              <div className="stat-icon green"><Icons.Check size={20} /></div>
              <div className="stat-content">
                <h3>{vehicleAvailable}</h3>
                <p>Available</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
              </div>
              <div className="stat-content">
                <h3>{vehicleInUse}</h3>
                <p>In Use</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total Fleet</span>
            <strong>{vehicleActive}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>In Service / Repairs</span>
            <strong style={{ color: vehicleService > 0 ? '#f39c12' : 'inherit' }}>{vehicleService}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>License / Service Alerts</span>
            <strong style={{ color: (licenseDiskAlerts.length + serviceAlerts.length) > 0 ? 'var(--error-color)' : 'inherit' }}>
              {licenseDiskAlerts.length + serviceAlerts.length}
            </strong>
          </div>
        </div>
      </div>

      {/* Vehicles Currently Out & Recent Fines */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>

        {/* Vehicles Currently Out */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icons.Clock size={20} /> Vehicles Currently Out
            </h2>
            <Link to="/vehicles" className="btn btn-sm btn-secondary">View All</Link>
          </div>
          {activeCheckouts.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem' }}>
              No vehicles currently checked out
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeCheckouts.slice(0, 8).map(c => (
                <div key={c.id} style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{c.vehicles?.make} {c.vehicles?.model}</strong>
                      <span style={{ fontFamily: 'monospace', marginLeft: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {c.vehicles?.registration_number}
                      </span>
                    </div>
                    <span className="badge badge-checked-out" style={{ fontSize: '0.7rem' }}>Out</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Driver: <strong>{c.driver_name}</strong>
                    {c.destination && <> — {c.destination}</>}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    Since {new Date(c.checkout_date).toLocaleDateString()} | Odometer: {c.start_odometer?.toLocaleString()} km
                  </div>
                </div>
              ))}
              {activeCheckouts.length > 8 && (
                <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  +{activeCheckouts.length - 8} more...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent Fines */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icons.Warning size={20} /> Vehicle Fines
            </h2>
            <Link to="/vehicles" className="btn btn-sm btn-secondary">View All</Link>
          </div>
          {fines.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem' }}>
              No fines recorded
            </div>
          ) : (
            <>
              <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1rem' }}>
                <div className="stat-card">
                  <div className="stat-icon red"><Icons.Warning size={20} /></div>
                  <div className="stat-content">
                    <h3>{unpaidFines.length}</h3>
                    <p>Unpaid</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon red" style={{ fontSize: '0.9rem', fontWeight: 700 }}>R</div>
                  <div className="stat-content">
                    <h3>R {totalUnpaid.toFixed(0)}</h3>
                    <p>Outstanding</p>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {fines.slice(0, 5).map(f => (
                  <div key={f.id} style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.83rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{f.driver_name}</strong>
                      <span className={`badge ${f.status === 'Paid' ? 'badge-available' : 'badge-overdue'}`} style={{ fontSize: '0.7rem' }}>
                        {f.status}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {f.vehicles?.registration_number} — {f.fine_type || 'Fine'} — R {parseFloat(f.fine_amount || 0).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">Quick Actions</h2>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/laptop-assignments" className="btn btn-secondary">Manage Laptops</Link>
          <Link to="/cellphone-assignments" className="btn btn-secondary">Manage Cellphones</Link>
          <Link to="/vehicles" className="btn btn-secondary">Manage Vehicles</Link>
          <Link to="/vehicles" className="btn btn-primary">Vehicle Checkout</Link>
        </div>
      </div>
    </div>
  );
}

export default AssetsDashboard;
