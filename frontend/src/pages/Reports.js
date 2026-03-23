import React, { useState, useEffect } from 'react';
import { reportsApi } from '../services/api';
import { exportData, EXPORT_COLUMNS } from '../services/exportUtils';
import { Icons } from '../components/Icons';

function Reports() {
  const [activeTab, setActiveTab] = useState('overdue');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      switch (activeTab) {
        case 'overdue':
          response = await reportsApi.getOverdue();
          setData(response?.data?.items || []);
          break;
        case 'checked-out':
          response = await reportsApi.getCheckedOut();
          setData(Array.isArray(response?.data) ? response.data : []);
          break;
        case 'available':
          response = await reportsApi.getAvailable();
          setData(Array.isArray(response?.data) ? response.data : []);
          break;
        case 'low-stock':
          response = await reportsApi.getLowStock();
          setData(Array.isArray(response?.data) ? response.data : []);
          break;
        case 'by-category':
          response = await reportsApi.getByCategory();
          setData(Array.isArray(response?.data) ? response.data : []);
          break;
        case 'by-location':
          response = await reportsApi.getByLocation();
          setData(Array.isArray(response?.data) ? response.data : []);
          break;
        case 'usage':
          response = await reportsApi.getUsageStats({});
          setStats(response?.data || null);
          setData([]);
          break;
        case 'vehicles':
          response = await reportsApi.getVehicleReport();
          setData(Array.isArray(response?.data) ? response.data : []);
          break;
        case 'cellphones':
          response = await reportsApi.getCellphoneReport();
          setData(Array.isArray(response?.data) ? response.data : []);
          break;
        case 'laptops':
          response = await reportsApi.getLaptopReport();
          setData(Array.isArray(response?.data) ? response.data : []);
          break;
        case 'calibration-due':
          response = await reportsApi.getCalibrationDueReport();
          setData(Array.isArray(response?.data) ? response.data : []);
          break;
        default:
          setData([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading">
          <div className="spinner"></div>
          Loading report...
        </div>
      );
    }

    if (error) {
      return (
        <div className="alert alert-error">
          {error}
          <button className="btn btn-sm btn-secondary" onClick={fetchData} style={{ marginLeft: 'auto' }}>
            Retry
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'overdue':
        return <OverdueReport data={data} formatDate={formatDate} />;
      case 'checked-out':
        return <CheckedOutReport data={data} formatDate={formatDate} />;
      case 'available':
        return <AvailableReport data={data} />;
      case 'low-stock':
        return <LowStockReport data={data} />;
      case 'by-category':
        return <ByCategoryReport data={data} />;
      case 'by-location':
        return <ByLocationReport data={data} />;
      case 'usage':
        return <UsageReport stats={stats} />;
      case 'vehicles':
        return <VehicleReport data={data} />;
      case 'cellphones':
        return <CellphoneReport data={data} />;
      case 'laptops':
        return <LaptopReport data={data} />;
      case 'calibration-due':
        return <CalibrationDueReport data={data} />;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Equipment &amp; asset reports and analytics</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-secondary" onClick={fetchData}>
            Refresh
          </button>
          <button className="btn btn-secondary" onClick={() => {
            const colMap = { overdue: 'overdue', 'checked-out': 'checkedOut', available: 'available', 'low-stock': 'lowStock', 'by-category': 'byCategory', 'by-location': 'byLocation', vehicles: 'vehicleReport', cellphones: 'cellphoneReport', laptops: 'laptopReport', 'calibration-due': 'calibrationDue' };
            const cols = EXPORT_COLUMNS[colMap[activeTab]];
            if (cols && data.length > 0) exportData('csv', data, cols, `report_${activeTab}`, `Report: ${activeTab}`);
          }} disabled={data.length === 0 || activeTab === 'usage'}>
            CSV
          </button>
          <button className="btn btn-secondary" onClick={() => {
            const colMap = { overdue: 'overdue', 'checked-out': 'checkedOut', available: 'available', 'low-stock': 'lowStock', 'by-category': 'byCategory', 'by-location': 'byLocation', vehicles: 'vehicleReport', cellphones: 'cellphoneReport', laptops: 'laptopReport', 'calibration-due': 'calibrationDue' };
            const cols = EXPORT_COLUMNS[colMap[activeTab]];
            if (cols && data.length > 0) exportData('excel', data, cols, `report_${activeTab}`, `Report: ${activeTab}`);
          }} disabled={data.length === 0 || activeTab === 'usage'}>
            Excel
          </button>
          <button className="btn btn-secondary" onClick={() => {
            const colMap = { overdue: 'overdue', 'checked-out': 'checkedOut', available: 'available', 'low-stock': 'lowStock', 'by-category': 'byCategory', 'by-location': 'byLocation', vehicles: 'vehicleReport', cellphones: 'cellphoneReport', laptops: 'laptopReport', 'calibration-due': 'calibrationDue' };
            const cols = EXPORT_COLUMNS[colMap[activeTab]];
            if (cols && data.length > 0) exportData('pdf', data, cols, `report_${activeTab}`, `Report: ${activeTab}`);
          }} disabled={data.length === 0 || activeTab === 'usage'}>
            PDF
          </button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overdue' ? 'active' : ''}`}
          onClick={() => setActiveTab('overdue')}
        >
          Overdue
        </button>
        <button
          className={`tab ${activeTab === 'checked-out' ? 'active' : ''}`}
          onClick={() => setActiveTab('checked-out')}
        >
          Checked Out
        </button>
        <button
          className={`tab ${activeTab === 'available' ? 'active' : ''}`}
          onClick={() => setActiveTab('available')}
        >
          Available
        </button>
        <button
          className={`tab ${activeTab === 'low-stock' ? 'active' : ''}`}
          onClick={() => setActiveTab('low-stock')}
        >
          Low Stock
        </button>
        <button
          className={`tab ${activeTab === 'by-category' ? 'active' : ''}`}
          onClick={() => setActiveTab('by-category')}
        >
          By Category
        </button>
        <button
          className={`tab ${activeTab === 'by-location' ? 'active' : ''}`}
          onClick={() => setActiveTab('by-location')}
        >
          By Location
        </button>
        <button
          className={`tab ${activeTab === 'usage' ? 'active' : ''}`}
          onClick={() => setActiveTab('usage')}
        >
          Usage Stats
        </button>
        <span style={{ borderLeft: '2px solid var(--border-color)', margin: '4px 4px', alignSelf: 'stretch' }} />
        <button
          className={`tab ${activeTab === 'vehicles' ? 'active' : ''}`}
          onClick={() => setActiveTab('vehicles')}
        >
          Vehicles
        </button>
        <button
          className={`tab ${activeTab === 'cellphones' ? 'active' : ''}`}
          onClick={() => setActiveTab('cellphones')}
        >
          Cellphones
        </button>
        <button
          className={`tab ${activeTab === 'laptops' ? 'active' : ''}`}
          onClick={() => setActiveTab('laptops')}
        >
          Laptops
        </button>
        <button
          className={`tab ${activeTab === 'calibration-due' ? 'active' : ''}`}
          onClick={() => setActiveTab('calibration-due')}
        >
          Calibration Due
        </button>
      </div>

      {/* Report Content */}
      <div className="card">{renderContent()}</div>
    </div>
  );
}

// Overdue Report Component
function OverdueReport({ data, formatDate }) {
  if (data.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Overdue Equipment</h3>
        <p>All checked out equipment is within the expected return period</p>
      </div>
    );
  }

  return (
    <div>
      <div className="alert alert-warning" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Icons.Warning size={18} />
        <span><strong>{data.length} items overdue</strong> - These items have been checked out for more than 14 days</span>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Equipment ID</th>
              <th>Name</th>
              <th>Category</th>
              <th>Serial Number</th>
              <th>Checked Out To</th>
              <th>Location</th>
              <th>Checked Out</th>
              <th>Expected Return</th>
              <th>Days Overdue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.equipment_id}</strong></td>
                <td>{item.equipment_name}</td>
                <td>
                  <span style={{ fontSize: '0.8rem' }}>
                    {item.category}
                    <br />
                    <span style={{ color: 'var(--text-secondary)' }}>{item.subcategory}</span>
                  </span>
                </td>
                <td>{item.serial_number || '-'}</td>
                <td>
                  {item.checked_out_to}
                  <br />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {item.holder_email}
                  </span>
                </td>
                <td>{item.current_location}</td>
                <td style={{ fontSize: '0.8rem' }}>{formatDate(item.checked_out_at)}</td>
                <td style={{ fontSize: '0.8rem' }}>
                  {item.expected_return_date
                    ? new Date(item.expected_return_date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '-'}
                </td>
                <td>
                  <span className="badge badge-overdue">{item.days_overdue} days</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Checked Out Report Component
function CheckedOutReport({ data, formatDate }) {
  if (data.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Equipment Checked Out</h3>
        <p>All equipment is currently available in store</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Equipment ID</th>
            <th>Name</th>
            <th>Category</th>
            <th>Serial Number</th>
            <th>Checked Out To</th>
            <th>Location</th>
            <th>Checked Out</th>
            <th>Expected Return</th>
            <th>Days Out</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.equipment_id}</strong></td>
              <td>{item.equipment_name}</td>
              <td style={{ fontSize: '0.8rem' }}>{item.category}</td>
              <td>{item.serial_number || '-'}</td>
              <td>{item.checked_out_to}</td>
              <td>{item.current_location}</td>
              <td style={{ fontSize: '0.8rem' }}>{formatDate(item.checked_out_at)}</td>
              <td style={{ fontSize: '0.8rem' }}>
                {item.expected_return_date
                  ? new Date(item.expected_return_date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '-'}
              </td>
              <td>{item.days_out}</td>
              <td>
                {item.is_overdue ? (
                  <span className="badge badge-overdue">Overdue</span>
                ) : (
                  <span className="badge badge-checked-out">Out</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Available Report Component
function AvailableReport({ data }) {
  if (data.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Available Equipment</h3>
        <p>All equipment is currently checked out</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Equipment ID</th>
            <th>Name</th>
            <th>Category</th>
            <th>Serial Number</th>
            <th>Location</th>
            <th>Checkout Allowed</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.equipment_id}</strong></td>
              <td>{item.equipment_name}</td>
              <td style={{ fontSize: '0.8rem' }}>{item.category}</td>
              <td>{item.serial_number || '-'}</td>
              <td>{item.current_location || '-'}</td>
              <td>
                {item.is_checkout_allowed ? (
                  <span className="badge badge-available">Yes</span>
                ) : (
                  <span className="badge badge-checked-out">No</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Low Stock Report Component
function LowStockReport({ data }) {
  if (data.length === 0) {
    return (
      <div className="empty-state">
        <h3>All Stock Levels OK</h3>
        <p>No consumables are below their reorder level</p>
      </div>
    );
  }

  return (
    <div>
      <div className="alert alert-warning" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Icons.Warning size={18} />
        <span><strong>{data.length} items need restocking</strong></span>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Item ID</th>
              <th>Name</th>
              <th>Category</th>
              <th>Available</th>
              <th>Total</th>
              <th>Reorder Level</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.equipment_id}</strong></td>
                <td>{item.equipment_name}</td>
                <td style={{ fontSize: '0.8rem' }}>{item.category}</td>
                <td>
                  <span style={{ color: 'var(--error-color)', fontWeight: 600 }}>
                    {item.available_quantity} {item.unit}
                  </span>
                </td>
                <td>{item.total_quantity} {item.unit}</td>
                <td>{item.reorder_level} {item.unit}</td>
                <td>{item.current_location || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// By Category Report Component
function ByCategoryReport({ data }) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Total Items</th>
            <th>Available</th>
            <th>Checked Out</th>
            <th>Checkout Allowed</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.category_id}>
              <td><strong>{item.category}</strong></td>
              <td>{item.total_items}</td>
              <td style={{ color: 'var(--success-color)' }}>{item.available}</td>
              <td style={{ color: item.checked_out > 0 ? 'var(--warning-color)' : 'inherit' }}>
                {item.checked_out}
              </td>
              <td>
                {item.is_checkout_allowed ? (
                  <span className="badge badge-available">Yes</span>
                ) : (
                  <span className="badge badge-checked-out">No</span>
                )}
              </td>
              <td>
                {item.is_consumable ? (
                  <span className="badge badge-consumable">Consumable</span>
                ) : (
                  <span style={{ fontSize: '0.8rem' }}>Equipment</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// By Location Report Component
function ByLocationReport({ data }) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Location</th>
            <th>Total Items</th>
            <th>Available</th>
            <th>Checked Out</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.location_id}>
              <td><strong>{item.location}</strong></td>
              <td>{item.total_items}</td>
              <td style={{ color: 'var(--success-color)' }}>{item.available}</td>
              <td style={{ color: item.checked_out > 0 ? 'var(--warning-color)' : 'inherit' }}>
                {item.checked_out}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Usage Stats Report Component
function UsageReport({ stats }) {
  if (!stats) {
    return <div className="loading">Loading usage statistics...</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
      {/* Most Checked Out */}
      <div>
        <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Most Checked Out Equipment</h3>
        {stats.most_checked_out.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No checkout data available</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Checkouts</th>
              </tr>
            </thead>
            <tbody>
              {stats.most_checked_out.map((item, index) => (
                <tr key={index}>
                  <td>
                    <strong>{item.equipment_id}</strong>
                    <br />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {item.equipment_name}
                    </span>
                  </td>
                  <td>{item.checkout_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Most Active Personnel */}
      <div>
        <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Most Active Personnel</h3>
        {stats.most_active_personnel.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No activity data available</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Checkouts</th>
                <th>Returns</th>
              </tr>
            </thead>
            <tbody>
              {stats.most_active_personnel.map((item, index) => (
                <tr key={index}>
                  <td>
                    <strong>{item.full_name}</strong>
                    <br />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {item.employee_id}
                    </span>
                  </td>
                  <td>{item.checkouts}</td>
                  <td>{item.checkins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Movements by Action */}
      <div>
        <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Movements by Action</h3>
        {stats.movements_by_action.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No movement data available</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {stats.movements_by_action.map((item, index) => (
                <tr key={index}>
                  <td>
                    <span className={`badge ${
                      item.action === 'OUT' ? 'badge-checked-out' :
                      item.action === 'IN' ? 'badge-available' :
                      item.action === 'ISSUE' ? 'badge-consumable' :
                      'badge-available'
                    }`}>
                      {item.action}
                    </span>
                  </td>
                  <td>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Vehicle Report Component
function VehicleReport({ data }) {
  if (data.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Vehicles</h3>
        <p>No vehicle records found</p>
      </div>
    );
  }

  const active = data.filter(v => v.is_active);
  const statusCounts = data.reduce((acc, v) => {
    acc[v.vehicle_status] = (acc[v.vehicle_status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div className="badge badge-available" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
          {active.length} Active
        </div>
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className="badge" style={{ padding: '6px 12px', fontSize: '0.85rem', background: 'var(--bg-secondary)' }}>
            {status}: {count}
          </div>
        ))}
        <div style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: '0.85rem', alignSelf: 'center' }}>
          {data.length} total vehicle{data.length !== 1 ? 's' : ''}
        </div>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Make / Model</th>
              <th>Year</th>
              <th>Registration</th>
              <th>VIN</th>
              <th>Assigned Driver</th>
              <th>Division</th>
              <th>Odometer</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((v) => (
              <tr key={v.id}>
                <td><strong>{v.make}</strong> {v.model}</td>
                <td>{v.year || '-'}</td>
                <td>{v.registration_number || '-'}</td>
                <td style={{ fontSize: '0.8rem' }}>{v.vin_number || '-'}</td>
                <td>{v.assigned_driver || '-'}</td>
                <td>{v.division || '-'}</td>
                <td>{v.current_odometer ? v.current_odometer.toLocaleString() + ' km' : '-'}</td>
                <td>
                  <span className={`badge ${v.vehicle_status === 'Active' ? 'badge-available' : v.vehicle_status === 'In Service' ? 'badge-checked-out' : ''}`}>
                    {v.vehicle_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Cellphone Report Component
function CellphoneReport({ data }) {
  if (data.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Cellphones</h3>
        <p>No cellphone assignment records found</p>
      </div>
    );
  }

  const active = data.filter(c => c.is_active);
  const brandCounts = data.reduce((acc, c) => {
    acc[c.phone_brand] = (acc[c.phone_brand] || 0) + 1;
    return acc;
  }, {});
  const statusCounts = data.reduce((acc, c) => {
    acc[c.phone_status] = (acc[c.phone_status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div className="badge badge-available" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
          {active.length} Active
        </div>
        {Object.entries(brandCounts).map(([brand, count]) => (
          <div key={brand} className="badge" style={{ padding: '6px 12px', fontSize: '0.85rem', background: 'var(--bg-secondary)' }}>
            {brand}: {count}
          </div>
        ))}
        {Object.entries(statusCounts).filter(([s]) => s !== 'Active').map(([status, count]) => (
          <div key={status} className="badge badge-checked-out" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
            {status}: {count}
          </div>
        ))}
        <div style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: '0.85rem', alignSelf: 'center' }}>
          {data.length} total device{data.length !== 1 ? 's' : ''}
        </div>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Brand</th>
              <th>Model</th>
              <th>IMEI</th>
              <th>Phone Number</th>
              <th>Date Assigned</th>
              <th>Division</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.employee_name}</strong></td>
                <td>{c.phone_brand}</td>
                <td>{c.phone_model}</td>
                <td style={{ fontSize: '0.8rem' }}>{c.imei_number || '-'}</td>
                <td>{c.phone_number || '-'}</td>
                <td style={{ fontSize: '0.8rem' }}>{c.date_assigned ? new Date(c.date_assigned).toLocaleDateString() : '-'}</td>
                <td>{c.notes || '-'}</td>
                <td>
                  <span className={`badge ${c.phone_status === 'Active' ? 'badge-available' : 'badge-checked-out'}`}>
                    {c.phone_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Laptop Report Component
function LaptopReport({ data }) {
  if (data.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Laptops</h3>
        <p>No laptop assignment records found</p>
      </div>
    );
  }

  const active = data.filter(l => l.is_active);
  const brandCounts = data.reduce((acc, l) => {
    acc[l.laptop_brand] = (acc[l.laptop_brand] || 0) + 1;
    return acc;
  }, {});
  const statusCounts = data.reduce((acc, l) => {
    acc[l.laptop_status] = (acc[l.laptop_status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div className="badge badge-available" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
          {active.length} Active
        </div>
        {Object.entries(brandCounts).map(([brand, count]) => (
          <div key={brand} className="badge" style={{ padding: '6px 12px', fontSize: '0.85rem', background: 'var(--bg-secondary)' }}>
            {brand}: {count}
          </div>
        ))}
        {Object.entries(statusCounts).filter(([s]) => s !== 'Active').map(([status, count]) => (
          <div key={status} className="badge badge-checked-out" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
            {status}: {count}
          </div>
        ))}
        <div style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: '0.85rem', alignSelf: 'center' }}>
          {data.length} total laptop{data.length !== 1 ? 's' : ''}
        </div>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Brand</th>
              <th>Model</th>
              <th>Serial Number</th>
              <th>Asset Tag</th>
              <th>Date Assigned</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((l) => (
              <tr key={l.id}>
                <td><strong>{l.employee_name}</strong></td>
                <td>{l.laptop_brand}</td>
                <td>{l.laptop_model}</td>
                <td style={{ fontSize: '0.8rem' }}>{l.serial_number || '-'}</td>
                <td>{l.asset_tag || '-'}</td>
                <td style={{ fontSize: '0.8rem' }}>{l.date_assigned ? new Date(l.date_assigned).toLocaleDateString() : '-'}</td>
                <td>
                  <span className={`badge ${l.laptop_status === 'Active' ? 'badge-available' : 'badge-checked-out'}`}>
                    {l.laptop_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Calibration Due Report Component
function CalibrationDueReport({ data }) {
  if (data.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Calibrations Due</h3>
        <p>All calibrations are currently valid</p>
      </div>
    );
  }

  const expired = data.filter(r => r.calibration_status === 'Expired');
  const dueSoon = data.filter(r => r.calibration_status === 'Due Soon');

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {expired.length > 0 && (
          <div className="alert alert-error" style={{ margin: 0, padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Icons.Warning size={16} />
            <strong>{expired.length} Expired</strong>
          </div>
        )}
        {dueSoon.length > 0 && (
          <div className="alert alert-warning" style={{ margin: 0, padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Icons.Warning size={16} />
            <strong>{dueSoon.length} Due Soon</strong>
          </div>
        )}
        <div style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: '0.85rem', alignSelf: 'center' }}>
          {data.length} item{data.length !== 1 ? 's' : ''} requiring attention
        </div>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Equipment ID</th>
              <th>Name</th>
              <th>Category</th>
              <th>Serial Number</th>
              <th>Certificate #</th>
              <th>Provider</th>
              <th>Calibration Date</th>
              <th>Expiry Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.equipment_code || '-'}</strong></td>
                <td>{r.equipment_name || '-'}</td>
                <td style={{ fontSize: '0.8rem' }}>{r.category || '-'}</td>
                <td style={{ fontSize: '0.8rem' }}>{r.serial_number || '-'}</td>
                <td>{r.certificate_number || '-'}</td>
                <td>{r.calibration_provider || '-'}</td>
                <td style={{ fontSize: '0.8rem' }}>{r.calibration_date ? new Date(r.calibration_date).toLocaleDateString() : '-'}</td>
                <td style={{ fontSize: '0.8rem' }}>{r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : '-'}</td>
                <td>
                  <span className={`badge ${r.calibration_status === 'Expired' ? 'badge-overdue' : 'badge-checked-out'}`}>
                    {r.calibration_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Reports;
