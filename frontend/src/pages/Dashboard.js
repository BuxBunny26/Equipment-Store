import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi, calibrationApi, maintenanceApi, reservationsApi, notificationsApi } from '../services/api';
import { Icons } from '../components/Icons';

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCalibrationInfo, setShowCalibrationInfo] = useState(false);
  const [showMaintenanceInfo, setShowMaintenanceInfo] = useState(false);
  const [showReservationsInfo, setShowReservationsInfo] = useState(false);
  const [data, setData] = useState({
    summary: {
      total_equipment: 0,
      available_equipment: 0,
      checked_out_equipment: 0,
      overdue_equipment: 0,
      total_consumables: 0,
      low_stock_consumables: 0,
      overdue_threshold_days: 14,
    },
    recent_movements: [],
  });
  const [calibrationSummary, setCalibrationSummary] = useState({
    valid: 0,
    due_soon: 0,
    expired: 0,
    not_calibrated: 0,
    total: 0,
  });
  const [maintenanceStats, setMaintenanceStats] = useState({
    due_count: 0,
    overdue_count: 0,
    upcoming: [],
  });
  const [reservationStats, setReservationStats] = useState({
    pending: 0,
    approved: 0,
    today: [],
  });
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchDashboard();
    fetchCalibrationSummary();
    fetchMaintenanceStats();
    fetchReservationStats();
    fetchNotifications();
  }, []);

  const fetchMaintenanceStats = async () => {
    try {
      const [dueRes, overdueRes] = await Promise.all([
        maintenanceApi.getDue(),
        maintenanceApi.getOverdue(),
      ]);
      const dueData = Array.isArray(dueRes?.data) ? dueRes.data : [];
      const overdueData = Array.isArray(overdueRes?.data) ? overdueRes.data : [];
      setMaintenanceStats({
        due_count: dueData.length,
        overdue_count: overdueData.length,
        upcoming: dueData.slice(0, 5),
      });
    } catch (err) {
      console.error('Error fetching maintenance stats:', err);
    }
  };

  const fetchReservationStats = async () => {
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        reservationsApi.getAll({ status: 'pending' }),
        reservationsApi.getAll({ status: 'approved' }),
      ]);
      
      const pendingData = Array.isArray(pendingRes?.data) ? pendingRes.data : [];
      const approvedData = Array.isArray(approvedRes?.data) ? approvedRes.data : [];
      
      const today = new Date().toISOString().split('T')[0];
      const todayReservations = approvedData.filter(r => 
        r.start_date <= today && r.end_date >= today
      );
      
      setReservationStats({
        pending: pendingData.length,
        approved: approvedData.length,
        today: todayReservations.slice(0, 5),
      });
    } catch (err) {
      console.error('Error fetching reservation stats:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await notificationsApi.getAlerts();
      const notifData = Array.isArray(response?.data) ? response.data : [];
      setNotifications(notifData.slice(0, 5));
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const fetchCalibrationSummary = async () => {
    try {
      const response = await calibrationApi.getSummary();
      const summaryData = response?.data?.summary;
      const total = response?.data?.total || 0;
      
      // Convert array to object for easier access
      const counts = {
        valid: 0,
        due_soon: 0,
        expired: 0,
        not_calibrated: 0,
        total: total,
      };
      
      if (Array.isArray(summaryData)) {
        summaryData.forEach(item => {
          if (item.calibration_status === 'Valid') counts.valid = parseInt(item.count);
          else if (item.calibration_status === 'Due Soon') counts.due_soon = parseInt(item.count);
          else if (item.calibration_status === 'Expired') counts.expired = parseInt(item.count);
          else if (item.calibration_status === 'Not Calibrated') counts.not_calibrated = parseInt(item.count);
        });
      }
      
      setCalibrationSummary(counts);
    } catch (err) {
      console.error('Error fetching calibration summary:', err);
    }
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await reportsApi.getDashboard();
      const responseData = response?.data || {};
      setData({
        summary: responseData.summary || {
          total_equipment: 0,
          available_equipment: 0,
          checked_out_equipment: 0,
          overdue_equipment: 0,
          total_consumables: 0,
          low_stock_consumables: 0,
          overdue_threshold_days: 14,
        },
        recent_movements: Array.isArray(responseData.recent_movements) ? responseData.recent_movements : [],
      });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        Error loading dashboard: {error}
        <button className="btn btn-sm btn-secondary" onClick={fetchDashboard} style={{ marginLeft: 'auto' }}>
          Retry
        </button>
      </div>
    );
  }

  const { summary, recent_movements } = data;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Equipment inventory overview</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/check-out" className="btn btn-primary">
            Check Out Equipment
          </Link>
          <Link to="/check-in" className="btn btn-success">
            Check In Equipment
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Icons.Package size={24} /></div>
          <div className="stat-content">
            <h3>{summary.total_equipment}</h3>
            <p>Total Equipment</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><Icons.Check size={24} /></div>
          <div className="stat-content">
            <h3>{summary.available_equipment}</h3>
            <p>Available</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">↗</div>
          <div className="stat-content">
            <h3>{summary.checked_out_equipment}</h3>
            <p>Checked Out</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red"><Icons.Warning size={24} /></div>
          <div className="stat-content">
            <h3>{summary.overdue_equipment}</h3>
            <p>Overdue ({summary.overdue_threshold_days}+ days)</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple"><Icons.Bottle size={24} /></div>
          <div className="stat-content">
            <h3>{summary.total_consumables}</h3>
            <p>Consumable Items</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red"><Icons.TrendingDown size={24} /></div>
          <div className="stat-content">
            <h3>{summary.low_stock_consumables}</h3>
            <p>Low Stock Alerts</p>
          </div>
        </div>
      </div>

      {/* Calibration Status */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Calibration Status
            <button
              onClick={() => setShowCalibrationInfo(!showCalibrationInfo)}
              style={{
                background: showCalibrationInfo ? '#dc3545' : '#0d6efd',
                border: '2px solid',
                borderColor: showCalibrationInfo ? '#dc3545' : '#0d6efd',
                borderRadius: '50%',
                width: '22px',
                height: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#ffffff',
                padding: 0,
                fontWeight: 'bold',
                fontSize: '13px',
                fontFamily: 'Georgia, serif',
                fontStyle: showCalibrationInfo ? 'normal' : 'italic',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                lineHeight: 1,
              }}
              title={showCalibrationInfo ? 'Close info' : 'What is Calibration?'}
            >
              {showCalibrationInfo ? <Icons.Close size={12} /> : 'i'}
            </button>
          </h2>
          <Link to="/calibration" className="btn btn-sm btn-secondary">
            View All
          </Link>
        </div>
        {showCalibrationInfo && (
          <div style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--primary)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            fontSize: '0.9rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Icons.Check size={18} style={{ color: 'var(--primary)' }} />
              <strong style={{ color: 'var(--text-primary)' }}>What is Calibration?</strong>
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Calibration is the process of verifying and adjusting equipment accuracy against certified standards. 
              It ensures measuring instruments provide reliable, traceable results and is typically performed by 
              accredited laboratories. Each calibration generates a <strong style={{ color: 'var(--text-primary)' }}>certificate</strong> with an expiry date 
              (usually 12 months). Equipment must be recalibrated before expiry to maintain compliance.
            </p>
          </div>
        )}
        <div className="stats-grid" style={{ marginTop: '16px' }}>
          <Link to="/calibration?status=Valid" style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
              <div className="stat-icon green"><Icons.Check size={24} /></div>
              <div className="stat-content">
                <h3>{calibrationSummary.valid}</h3>
                <p>Valid</p>
              </div>
            </div>
          </Link>

          <Link to="/calibration?status=Due Soon" style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
              <div className="stat-icon orange"><Icons.Clock size={24} /></div>
              <div className="stat-content">
                <h3>{calibrationSummary.due_soon}</h3>
                <p>Due Soon (30 days)</p>
              </div>
            </div>
          </Link>

          <Link to="/calibration?status=Expired" style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
              <div className="stat-icon red"><Icons.Warning size={24} /></div>
              <div className="stat-content">
                <h3>{calibrationSummary.expired}</h3>
                <p>Expired</p>
              </div>
            </div>
          </Link>

          <Link to="/calibration?status=Not Calibrated" style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
              <div className="stat-icon gray"><Icons.Minus size={24} /></div>
              <div className="stat-content">
                <h3>{calibrationSummary.not_calibrated}</h3>
                <p>Not Calibrated</p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Quick Actions</h2>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/check-out" className="btn btn-primary">
            Check Out Equipment
          </Link>
          <Link to="/check-in" className="btn btn-success">
            Return Equipment
          </Link>
          <Link to="/reservations" className="btn btn-secondary">
            Reservations
          </Link>
          <Link to="/equipment?status=Available" className="btn btn-secondary">
            View Available Equipment
          </Link>
          <Link to="/reports" className="btn btn-secondary">
            View Overdue Items
          </Link>
          <Link to="/consumables" className="btn btn-secondary">
            Manage Consumables
          </Link>
        </div>
      </div>

      {/* Alerts & Notifications */}
      {notifications.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icons.Warning size={20} /> Alerts & Notifications
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {notifications.map((alert, idx) => (
              <div 
                key={idx}
                style={{
                  padding: '0.75rem',
                  backgroundColor: alert.priority === 'high' ? 'var(--danger-light)' : 'var(--warning-light)',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong>{alert.title}</strong>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {alert.message}
                  </div>
                </div>
                <span className={`badge ${alert.priority === 'high' ? 'badge-danger' : 'badge-consumable'}`}>
                  {alert.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout for Maintenance & Reservations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {/* Maintenance Overview */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icons.Wrench size={20} /> Maintenance
              <button
                onClick={() => setShowMaintenanceInfo(!showMaintenanceInfo)}
                style={{
                  background: showMaintenanceInfo ? '#dc3545' : '#0d6efd',
                  border: '2px solid',
                  borderColor: showMaintenanceInfo ? '#dc3545' : '#0d6efd',
                  borderRadius: '50%',
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#ffffff',
                  padding: 0,
                  fontWeight: 'bold',
                  fontSize: '13px',
                  fontFamily: 'Georgia, serif',
                  fontStyle: showMaintenanceInfo ? 'normal' : 'italic',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  lineHeight: 1,
                }}
                title={showMaintenanceInfo ? 'Close info' : 'What is Maintenance?'}
              >
                {showMaintenanceInfo ? <Icons.Close size={12} /> : 'i'}
              </button>
            </h2>
            <Link to="/maintenance" className="btn btn-sm btn-secondary">View All</Link>
          </div>
          {showMaintenanceInfo && (
            <div style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--primary)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '0.9rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Icons.Wrench size={18} style={{ color: 'var(--primary)' }} />
                <strong style={{ color: 'var(--text-primary)' }}>What is Maintenance?</strong>
              </div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Maintenance covers routine servicing, repairs, and preventive care to keep equipment in good working 
                condition. This includes battery replacements, sensor cleaning, firmware updates, and fixing faults. 
                Unlike calibration, maintenance doesn't require certified laboratories - it can be done in-house or 
                by service technicians. Regular maintenance extends equipment lifespan and prevents breakdowns.
              </p>
            </div>
          )}
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1rem' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
              <div className="stat-icon orange"><Icons.Clock size={24} /></div>
              <div className="stat-content">
                <h3>{maintenanceStats.due_count}</h3>
                <p>Due Soon</p>
              </div>
            </div>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
              <div className="stat-icon red"><Icons.Warning size={24} /></div>
              <div className="stat-content">
                <h3>{maintenanceStats.overdue_count}</h3>
                <p>Overdue</p>
              </div>
            </div>
          </div>
          {maintenanceStats.upcoming.length > 0 && (
            <div>
              <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Upcoming Maintenance
              </h4>
              {maintenanceStats.upcoming.map((item, idx) => (
                <div key={idx} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 500 }}>{item.equipment_id || item.serial_number}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Due: {new Date(item.next_maintenance_date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reservations Overview */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icons.Calendar size={20} /> Reservations
              <button
                onClick={() => setShowReservationsInfo(!showReservationsInfo)}
                style={{
                  background: showReservationsInfo ? '#dc3545' : '#0d6efd',
                  border: '2px solid',
                  borderColor: showReservationsInfo ? '#dc3545' : '#0d6efd',
                  borderRadius: '50%',
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#ffffff',
                  padding: 0,
                  fontWeight: 'bold',
                  fontSize: '13px',
                  fontFamily: 'Georgia, serif',
                  fontStyle: showReservationsInfo ? 'normal' : 'italic',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  lineHeight: 1,
                }}
                title={showReservationsInfo ? 'Close info' : 'What are Reservations?'}
              >
                {showReservationsInfo ? <Icons.Close size={12} /> : 'i'}
              </button>
            </h2>
            <Link to="/reservations" className="btn btn-sm btn-secondary">View All</Link>
          </div>
          {showReservationsInfo && (
            <div style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--primary)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '0.9rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Icons.Calendar size={18} style={{ color: 'var(--primary)' }} />
                <strong style={{ color: 'var(--text-primary)' }}>What are Reservations?</strong>
              </div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Reservations allow you to book equipment in advance for planned jobs or projects. 
                When you know you'll need specific equipment on a future date, create a reservation to ensure 
                it's available when you need it. Pending reservations require approval before they're confirmed. 
                This helps prevent scheduling conflicts and ensures equipment is ready for fieldwork.
              </p>
            </div>
          )}
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1rem' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
              <div className="stat-icon orange"><Icons.Hourglass size={24} /></div>
              <div className="stat-content">
                <h3>{reservationStats.pending}</h3>
                <p>Pending Approval</p>
              </div>
            </div>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
              <div className="stat-icon green"><Icons.Check size={24} /></div>
              <div className="stat-content">
                <h3>{reservationStats.approved}</h3>
                <p>Active Reservations</p>
              </div>
            </div>
          </div>
          {reservationStats.today.length > 0 && (
            <div>
              <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Active Today
              </h4>
              {reservationStats.today.map((res, idx) => (
                <div key={idx} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 500 }}>{res.equipment_name || res.equipment_id}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Reserved by: {res.reserved_by_name}
                  </div>
                </div>
              ))}
            </div>
          )}
          {reservationStats.today.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
              No active reservations today
            </div>
          )}
        </div>
      </div>

      {/* Recent Movements */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Movements</h2>
          <Link to="/reports" className="btn btn-sm btn-secondary">
            View All
          </Link>
        </div>

        {recent_movements.length === 0 ? (
          <div className="empty-state">
            <p>No recent movements recorded</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Action</th>
                  <th>Location</th>
                  <th>Personnel</th>
                  <th>Date/Time</th>
                </tr>
              </thead>
              <tbody>
                {recent_movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>
                      <strong>{movement.equipment_id}</strong>
                      <br />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {movement.equipment_name}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getActionBadge(movement.action)}`}>
                        {movement.action}
                      </span>
                      {movement.quantity > 1 && (
                        <span style={{ marginLeft: '8px', fontSize: '0.8rem' }}>
                          ×{movement.quantity}
                        </span>
                      )}
                    </td>
                    <td>{movement.location || '-'}</td>
                    <td>{movement.personnel || '-'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{formatDate(movement.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
