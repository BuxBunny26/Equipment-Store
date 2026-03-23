import React, { useState, useEffect, useMemo } from 'react';
import { reportsApi, personnelApi, vehicleFinesApi, vehicleServicesApi } from '../services/api';
import { exportData, EXPORT_COLUMNS } from '../services/exportUtils';
import { Icons } from '../components/Icons';
import { buildDivisionLookup, lookupDivision } from '../utils/divisionUtils';

function Reports() {
  const [activeTab, setActiveTab] = useState('overdue');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [extraData, setExtraData] = useState({ personnel: [], fines: [], services: [] });

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
          const [vRes, fRes, sRes, pResV] = await Promise.all([
            reportsApi.getVehicleReport(),
            vehicleFinesApi.getAll(),
            vehicleServicesApi.getAll(),
            personnelApi.getAll(false),
          ]);
          setData(Array.isArray(vRes?.data) ? vRes.data : []);
          setExtraData(prev => ({
            ...prev,
            fines: Array.isArray(fRes?.data) ? fRes.data : [],
            services: Array.isArray(sRes?.data) ? sRes.data : [],
            personnel: Array.isArray(pResV?.data) ? pResV.data : prev.personnel,
          }));
          break;
        case 'cellphones':
          const [cRes, pResC] = await Promise.all([
            reportsApi.getCellphoneReport(),
            personnelApi.getAll(false),
          ]);
          setData(Array.isArray(cRes?.data) ? cRes.data : []);
          setExtraData(prev => ({
            ...prev,
            personnel: Array.isArray(pResC?.data) ? pResC.data : prev.personnel,
          }));
          break;
        case 'laptops':
          const [lRes, pResL] = await Promise.all([
            reportsApi.getLaptopReport(),
            personnelApi.getAll(false),
          ]);
          setData(Array.isArray(lRes?.data) ? lRes.data : []);
          setExtraData(prev => ({
            ...prev,
            personnel: Array.isArray(pResL?.data) ? pResL.data : prev.personnel,
          }));
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
        return <VehicleReport data={data} personnel={extraData.personnel} fines={extraData.fines} services={extraData.services} />;
      case 'cellphones':
        return <CellphoneReport data={data} personnel={extraData.personnel} />;
      case 'laptops':
        return <LaptopReport data={data} personnel={extraData.personnel} />;
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
function VehicleReport({ data, personnel, fines, services }) {
  const [showMakeChart, setShowMakeChart] = useState(false);
  const [showDivisionBreakdown, setShowDivisionBreakdown] = useState(false);
  const [showCostSummary, setShowCostSummary] = useState(false);

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Vehicles</h3>
        <p>No vehicle records found</p>
      </div>
    );
  }

  const divLookup = buildDivisionLookup(personnel);
  const getDivision = (v) => {
    // Vehicles use assigned_to for driver name, no employee_id on vehicle record
    const item = { assigned_to: v.assigned_to || v.assigned_driver || '', notes: v.notes };
    return lookupDivision(divLookup, item, 'assigned_to');
  };

  const active = data.filter(v => v.is_active);
  const statusCounts = data.reduce((acc, v) => {
    acc[v.vehicle_status || 'Unknown'] = (acc[v.vehicle_status || 'Unknown'] || 0) + 1;
    return acc;
  }, {});

  // Make distribution
  const makeDistribution = (() => {
    const counts = {};
    data.forEach(v => { counts[v.make || 'Unknown'] = (counts[v.make || 'Unknown'] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })();
  const makeColors = { Toyota: '#EB0A1E', Ford: '#003478', Volkswagen: '#001E50', Nissan: '#C3002F', Isuzu: '#DA291C', Mercedes: '#333', BMW: '#0066B1', Hyundai: '#002C5F' };

  // Fuel type distribution
  const fuelDistribution = (() => {
    const counts = {};
    data.forEach(v => { counts[v.fuel_type || 'Unknown'] = (counts[v.fuel_type || 'Unknown'] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })();

  // Division breakdown
  const divisionBreakdown = (() => {
    const counts = {};
    data.filter(v => v.is_active).forEach(v => {
      const div = getDivision(v) || 'Unassigned';
      counts[div] = (counts[div] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })();

  // Cost aggregations
  const totalFines = (fines || []).reduce((s, f) => s + (Number(f.fine_amount) || 0), 0);
  const unpaidFines = (fines || []).filter(f => f.status === 'Unpaid').reduce((s, f) => s + (Number(f.fine_amount) || 0), 0);
  const totalServiceCost = (services || []).reduce((s, sv) => s + (Number(sv.cost) || 0), 0);

  // Cost per division (fines + services grouped by vehicle -> driver -> division)
  const costPerDivision = (() => {
    const vehicleMap = {};
    data.forEach(v => { vehicleMap[v.id] = v; });
    const summary = {};
    (fines || []).forEach(f => {
      const v = vehicleMap[f.vehicle_id];
      const div = v ? (getDivision(v) || 'Unassigned') : 'Unassigned';
      if (!summary[div]) summary[div] = { count: 0, fines: 0, services: 0 };
      summary[div].fines += Number(f.fine_amount) || 0;
    });
    (services || []).forEach(sv => {
      const v = vehicleMap[sv.vehicle_id];
      const div = v ? (getDivision(v) || 'Unassigned') : 'Unassigned';
      if (!summary[div]) summary[div] = { count: 0, fines: 0, services: 0 };
      summary[div].services += Number(sv.cost) || 0;
    });
    data.filter(v => v.is_active).forEach(v => {
      const div = getDivision(v) || 'Unassigned';
      if (!summary[div]) summary[div] = { count: 0, fines: 0, services: 0 };
      summary[div].count++;
    });
    return Object.entries(summary).sort((a, b) => (b[1].fines + b[1].services) - (a[1].fines + a[1].services));
  })();

  const fmt = (n) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--primary-color)' }}>{data.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Vehicles</div>
        </div>
        <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#27ae60' }}>{active.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Active</div>
        </div>
        {totalFines > 0 && (
          <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#e74c3c' }}>{fmt(totalFines)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Fines ({(fines || []).length})</div>
          </div>
        )}
        {unpaidFines > 0 && (
          <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f39c12' }}>{fmt(unpaidFines)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Unpaid Fines</div>
          </div>
        )}
        {totalServiceCost > 0 && (
          <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#2980b9' }}>{fmt(totalServiceCost)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Service Costs ({(services || []).length})</div>
          </div>
        )}
      </div>

      {/* Status Badges */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {Object.entries(statusCounts).map(([status, count]) => (
          <span key={status} className={`badge ${status === 'Active' ? 'badge-available' : status === 'In Service' ? 'badge-checked-out' : ''}`} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
            {status}: {count}
          </span>
        ))}
        {fuelDistribution.map(([fuel, count]) => (
          <span key={fuel} className="badge" style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'var(--bg-secondary)' }}>
            {fuel}: {count}
          </span>
        ))}
      </div>

      {/* Make Distribution */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowMakeChart(!showMakeChart)}>
          <Icons.BarChart size={16} />
          <strong style={{ fontSize: '0.9rem' }}>Make Distribution</strong>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({makeDistribution.length} makes)</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{showMakeChart ? '\u25BC' : '\u25B6'}</span>
        </div>
        {showMakeChart && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {makeDistribution.map(([make, count]) => {
                const total = makeDistribution.reduce((s, [, c]) => s + c, 0);
                const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                const color = makeColors[make] || '#666';
                return (
                  <div key={make} style={{ textAlign: 'center', minWidth: '80px' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{count}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{make}</div>
                    <div style={{ fontSize: '0.7rem', color }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden' }}>
              {makeDistribution.map(([make, count]) => {
                const total = makeDistribution.reduce((s, [, c]) => s + c, 0);
                const pct = total > 0 ? (count / total) * 100 : 0;
                const color = makeColors[make] || '#666';
                return (
                  <div key={make} title={`${make}: ${count} (${pct.toFixed(1)}%)`}
                    style={{ width: `${pct}%`, background: color, minWidth: pct > 0 ? '2px' : '0', transition: 'width 0.3s ease' }} />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Division Breakdown */}
      {divisionBreakdown.length > 0 && (
        <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowDivisionBreakdown(!showDivisionBreakdown)}>
            <Icons.Building size={16} />
            <strong style={{ fontSize: '0.9rem' }}>Division Breakdown</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({divisionBreakdown.length} divisions)</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{showDivisionBreakdown ? '\u25BC' : '\u25B6'}</span>
          </div>
          {showDivisionBreakdown && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {divisionBreakdown.map(([div, count]) => {
                const maxCount = divisionBreakdown[0]?.[1] || 1;
                return (
                  <div key={div} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', minWidth: '120px', textAlign: 'right' }}>{div}</span>
                    <div style={{ flex: 1, background: 'var(--bg-secondary, #f0f0f0)', borderRadius: '4px', height: '20px', overflow: 'hidden' }}>
                      <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', background: 'var(--primary-color)', borderRadius: '4px', transition: 'width 0.3s ease', minWidth: '2px' }} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '30px' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cost Per Division */}
      {costPerDivision.some(([, s]) => s.fines > 0 || s.services > 0) && (
        <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowCostSummary(!showCostSummary)}>
            <Icons.FileText size={16} />
            <strong style={{ fontSize: '0.9rem' }}>Cost Per Division</strong>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{showCostSummary ? '\u25BC' : '\u25B6'}</span>
          </div>
          {showCostSummary && (
            <div style={{ marginTop: '12px', overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Division</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Vehicles</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Fines (R)</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Services (R)</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Total (R)</th>
                  </tr>
                </thead>
                <tbody>
                  {costPerDivision.map(([div, s]) => (
                    <tr key={div} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 8px' }}>{div}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.count}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.fines > 0 ? fmt(s.fines) : '-'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.services > 0 ? fmt(s.services) : '-'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{(s.fines + s.services) > 0 ? fmt(s.fines + s.services) : '-'}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 8px' }}>Total</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{costPerDivision.reduce((s, [, d]) => s + d.count, 0)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(costPerDivision.reduce((s, [, d]) => s + d.fines, 0))}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(costPerDivision.reduce((s, [, d]) => s + d.services, 0))}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(costPerDivision.reduce((s, [, d]) => s + d.fines + d.services, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Data Table */}
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
              <th>Fuel</th>
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
                <td>{v.assigned_to || v.assigned_driver || '-'}</td>
                <td>{getDivision(v) || '-'}</td>
                <td>{v.fuel_type || '-'}</td>
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
function CellphoneReport({ data, personnel }) {
  const [showBrandChart, setShowBrandChart] = useState(false);
  const [showDivisionBreakdown, setShowDivisionBreakdown] = useState(false);
  const [showCostSummary, setShowCostSummary] = useState(false);

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Cellphones</h3>
        <p>No cellphone assignment records found</p>
      </div>
    );
  }

  const divLookup = buildDivisionLookup(personnel);
  const getDivision = (c) => lookupDivision(divLookup, c, 'employee_name');

  const active = data.filter(c => c.is_active);
  const statusCounts = data.reduce((acc, c) => {
    acc[c.phone_status || 'Unknown'] = (acc[c.phone_status || 'Unknown'] || 0) + 1;
    return acc;
  }, {});

  // Brand distribution
  const brandDistribution = (() => {
    const counts = {};
    data.forEach(c => { counts[c.phone_brand || 'Unknown'] = (counts[c.phone_brand || 'Unknown'] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })();
  const brandColors = { Samsung: '#1428A0', Huawei: '#CF0A2C', 'Rugged SA': '#2d8659', Apple: '#555', Nokia: '#005EB8', Xiaomi: '#FF6900' };

  // Division breakdown
  const divisionBreakdown = (() => {
    const counts = {};
    data.filter(c => c.phone_status === 'Active').forEach(c => {
      const div = getDivision(c) || 'Unassigned';
      counts[div] = (counts[div] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })();

  // Cost summaries
  const totalDeviceCost = data.filter(c => c.is_active).reduce((s, c) => s + (Number(c.device_cost) || 0), 0);
  const totalMonthlyCost = data.filter(c => c.is_active).reduce((s, c) => s + (Number(c.monthly_cost) || 0), 0);

  // Cost per division
  const costPerDivision = (() => {
    const summary = {};
    data.filter(c => c.phone_status === 'Active').forEach(c => {
      const div = getDivision(c) || 'Unassigned';
      if (!summary[div]) summary[div] = { count: 0, totalDevice: 0, totalMonthly: 0 };
      summary[div].count++;
      if (c.device_cost) summary[div].totalDevice += Number(c.device_cost);
      if (c.monthly_cost) summary[div].totalMonthly += Number(c.monthly_cost);
    });
    return Object.entries(summary).sort((a, b) => b[1].totalMonthly - a[1].totalMonthly);
  })();

  const fmt = (n) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--primary-color)' }}>{data.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Devices</div>
        </div>
        <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#27ae60' }}>{active.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Active</div>
        </div>
        {totalDeviceCost > 0 && (
          <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#2980b9' }}>{fmt(totalDeviceCost)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Device Cost</div>
          </div>
        )}
        {totalMonthlyCost > 0 && (
          <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#8e44ad' }}>{fmt(totalMonthlyCost)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Monthly Cost</div>
          </div>
        )}
        {totalMonthlyCost > 0 && (
          <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#e67e22' }}>{fmt(totalMonthlyCost * 12)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Annual Cost</div>
          </div>
        )}
      </div>

      {/* Status Badges */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {Object.entries(statusCounts).map(([status, count]) => (
          <span key={status} className={`badge ${status === 'Active' ? 'badge-available' : 'badge-checked-out'}`} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
            {status}: {count}
          </span>
        ))}
      </div>

      {/* Brand Distribution */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowBrandChart(!showBrandChart)}>
          <Icons.Phone size={16} />
          <strong style={{ fontSize: '0.9rem' }}>Brand Distribution</strong>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({brandDistribution.length} brands)</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{showBrandChart ? '\u25BC' : '\u25B6'}</span>
        </div>
        {showBrandChart && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {brandDistribution.map(([brand, count]) => {
                const total = brandDistribution.reduce((s, [, c]) => s + c, 0);
                const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                const color = brandColors[brand] || '#666';
                return (
                  <div key={brand} style={{ textAlign: 'center', minWidth: '80px' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{count}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{brand}</div>
                    <div style={{ fontSize: '0.7rem', color }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden' }}>
              {brandDistribution.map(([brand, count]) => {
                const total = brandDistribution.reduce((s, [, c]) => s + c, 0);
                const pct = total > 0 ? (count / total) * 100 : 0;
                const color = brandColors[brand] || '#666';
                return (
                  <div key={brand} title={`${brand}: ${count} (${pct.toFixed(1)}%)`}
                    style={{ width: `${pct}%`, background: color, minWidth: pct > 0 ? '2px' : '0', transition: 'width 0.3s ease' }} />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Division Breakdown */}
      {divisionBreakdown.length > 0 && (
        <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowDivisionBreakdown(!showDivisionBreakdown)}>
            <Icons.Building size={16} />
            <strong style={{ fontSize: '0.9rem' }}>Division Breakdown</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({divisionBreakdown.length} divisions)</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{showDivisionBreakdown ? '\u25BC' : '\u25B6'}</span>
          </div>
          {showDivisionBreakdown && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {divisionBreakdown.map(([div, count]) => {
                const maxCount = divisionBreakdown[0]?.[1] || 1;
                return (
                  <div key={div} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', minWidth: '120px', textAlign: 'right' }}>{div}</span>
                    <div style={{ flex: 1, background: 'var(--bg-secondary, #f0f0f0)', borderRadius: '4px', height: '20px', overflow: 'hidden' }}>
                      <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', background: 'var(--primary-color)', borderRadius: '4px', transition: 'width 0.3s ease', minWidth: '2px' }} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '30px' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cost Per Division */}
      {costPerDivision.some(([, s]) => s.totalMonthly > 0 || s.totalDevice > 0) && (
        <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowCostSummary(!showCostSummary)}>
            <Icons.FileText size={16} />
            <strong style={{ fontSize: '0.9rem' }}>Cost Per Division</strong>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{showCostSummary ? '\u25BC' : '\u25B6'}</span>
          </div>
          {showCostSummary && (
            <div style={{ marginTop: '12px', overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Division</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Phones</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Device Cost (R)</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Monthly (R)</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Annual (R)</th>
                  </tr>
                </thead>
                <tbody>
                  {costPerDivision.map(([div, s]) => (
                    <tr key={div} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 8px' }}>{div}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.count}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.totalDevice > 0 ? fmt(s.totalDevice) : '-'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.totalMonthly > 0 ? fmt(s.totalMonthly) : '-'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{s.totalMonthly > 0 ? fmt(s.totalMonthly * 12) : '-'}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 8px' }}>Total</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{costPerDivision.reduce((s, [, d]) => s + d.count, 0)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(costPerDivision.reduce((s, [, d]) => s + d.totalDevice, 0))}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(costPerDivision.reduce((s, [, d]) => s + d.totalMonthly, 0))}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(costPerDivision.reduce((s, [, d]) => s + d.totalMonthly, 0) * 12)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Data Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Brand</th>
              <th>Model</th>
              <th>IMEI</th>
              <th>Phone Number</th>
              <th>Division</th>
              <th>Device Cost</th>
              <th>Monthly</th>
              <th>Date Assigned</th>
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
                <td>{getDivision(c) || '-'}</td>
                <td>{c.device_cost ? `R ${Number(c.device_cost).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}</td>
                <td>{c.monthly_cost ? `R ${Number(c.monthly_cost).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}</td>
                <td style={{ fontSize: '0.8rem' }}>{c.date_assigned ? new Date(c.date_assigned).toLocaleDateString() : '-'}</td>
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
function LaptopReport({ data, personnel }) {
  const [showBrandChart, setShowBrandChart] = useState(false);
  const [showDivisionBreakdown, setShowDivisionBreakdown] = useState(false);
  const [showCostSummary, setShowCostSummary] = useState(false);

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Laptops</h3>
        <p>No laptop assignment records found</p>
      </div>
    );
  }

  const divLookup = buildDivisionLookup(personnel);
  const getDivision = (l) => lookupDivision(divLookup, l, 'employee_name');

  const active = data.filter(l => l.is_active);
  const statusCounts = data.reduce((acc, l) => {
    acc[l.laptop_status || 'Unknown'] = (acc[l.laptop_status || 'Unknown'] || 0) + 1;
    return acc;
  }, {});

  // Brand distribution
  const brandDistribution = (() => {
    const counts = {};
    data.forEach(l => { counts[l.laptop_brand || 'Unknown'] = (counts[l.laptop_brand || 'Unknown'] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })();
  const brandColors = { Dell: '#007DB8', HP: '#0096D6', Lenovo: '#E2231A', Apple: '#555', Asus: '#00539F', Acer: '#83B81A', Microsoft: '#737373' };

  // Division breakdown
  const divisionBreakdown = (() => {
    const counts = {};
    data.filter(l => l.laptop_status === 'Active').forEach(l => {
      const div = getDivision(l) || 'Unassigned';
      counts[div] = (counts[div] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })();

  // Cost summaries
  const totalDeviceCost = data.filter(l => l.is_active).reduce((s, l) => s + (Number(l.device_cost) || 0), 0);
  const totalMonthlyCost = data.filter(l => l.is_active).reduce((s, l) => s + (Number(l.monthly_cost) || 0), 0);

  // Cost per division
  const costPerDivision = (() => {
    const summary = {};
    data.filter(l => l.laptop_status === 'Active').forEach(l => {
      const div = getDivision(l) || 'Unassigned';
      if (!summary[div]) summary[div] = { count: 0, totalDevice: 0, totalMonthly: 0 };
      summary[div].count++;
      if (l.device_cost) summary[div].totalDevice += Number(l.device_cost);
      if (l.monthly_cost) summary[div].totalMonthly += Number(l.monthly_cost);
    });
    return Object.entries(summary).sort((a, b) => b[1].totalMonthly - a[1].totalMonthly);
  })();

  const fmt = (n) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--primary-color)' }}>{data.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Laptops</div>
        </div>
        <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#27ae60' }}>{active.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Active</div>
        </div>
        {totalDeviceCost > 0 && (
          <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#2980b9' }}>{fmt(totalDeviceCost)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Device Cost</div>
          </div>
        )}
        {totalMonthlyCost > 0 && (
          <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#8e44ad' }}>{fmt(totalMonthlyCost)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Monthly Cost</div>
          </div>
        )}
        {totalMonthlyCost > 0 && (
          <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#e67e22' }}>{fmt(totalMonthlyCost * 12)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Annual Cost</div>
          </div>
        )}
      </div>

      {/* Status Badges */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {Object.entries(statusCounts).map(([status, count]) => (
          <span key={status} className={`badge ${status === 'Active' ? 'badge-available' : 'badge-checked-out'}`} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
            {status}: {count}
          </span>
        ))}
      </div>

      {/* Brand Distribution */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowBrandChart(!showBrandChart)}>
          <Icons.BarChart size={16} />
          <strong style={{ fontSize: '0.9rem' }}>Brand Distribution</strong>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({brandDistribution.length} brands)</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{showBrandChart ? '\u25BC' : '\u25B6'}</span>
        </div>
        {showBrandChart && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {brandDistribution.map(([brand, count]) => {
                const total = brandDistribution.reduce((s, [, c]) => s + c, 0);
                const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                const color = brandColors[brand] || '#666';
                return (
                  <div key={brand} style={{ textAlign: 'center', minWidth: '80px' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{count}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{brand}</div>
                    <div style={{ fontSize: '0.7rem', color }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden' }}>
              {brandDistribution.map(([brand, count]) => {
                const total = brandDistribution.reduce((s, [, c]) => s + c, 0);
                const pct = total > 0 ? (count / total) * 100 : 0;
                const color = brandColors[brand] || '#666';
                return (
                  <div key={brand} title={`${brand}: ${count} (${pct.toFixed(1)}%)`}
                    style={{ width: `${pct}%`, background: color, minWidth: pct > 0 ? '2px' : '0', transition: 'width 0.3s ease' }} />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Division Breakdown */}
      {divisionBreakdown.length > 0 && (
        <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowDivisionBreakdown(!showDivisionBreakdown)}>
            <Icons.Building size={16} />
            <strong style={{ fontSize: '0.9rem' }}>Division Breakdown</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({divisionBreakdown.length} divisions)</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{showDivisionBreakdown ? '\u25BC' : '\u25B6'}</span>
          </div>
          {showDivisionBreakdown && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {divisionBreakdown.map(([div, count]) => {
                const maxCount = divisionBreakdown[0]?.[1] || 1;
                return (
                  <div key={div} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', minWidth: '120px', textAlign: 'right' }}>{div}</span>
                    <div style={{ flex: 1, background: 'var(--bg-secondary, #f0f0f0)', borderRadius: '4px', height: '20px', overflow: 'hidden' }}>
                      <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', background: 'var(--primary-color)', borderRadius: '4px', transition: 'width 0.3s ease', minWidth: '2px' }} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '30px' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cost Per Division */}
      {costPerDivision.some(([, s]) => s.totalMonthly > 0 || s.totalDevice > 0) && (
        <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowCostSummary(!showCostSummary)}>
            <Icons.FileText size={16} />
            <strong style={{ fontSize: '0.9rem' }}>Cost Per Division</strong>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{showCostSummary ? '\u25BC' : '\u25B6'}</span>
          </div>
          {showCostSummary && (
            <div style={{ marginTop: '12px', overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Division</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Laptops</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Device Cost (R)</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Monthly (R)</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Annual (R)</th>
                  </tr>
                </thead>
                <tbody>
                  {costPerDivision.map(([div, s]) => (
                    <tr key={div} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 8px' }}>{div}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.count}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.totalDevice > 0 ? fmt(s.totalDevice) : '-'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.totalMonthly > 0 ? fmt(s.totalMonthly) : '-'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{s.totalMonthly > 0 ? fmt(s.totalMonthly * 12) : '-'}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 8px' }}>Total</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{costPerDivision.reduce((s, [, d]) => s + d.count, 0)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(costPerDivision.reduce((s, [, d]) => s + d.totalDevice, 0))}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(costPerDivision.reduce((s, [, d]) => s + d.totalMonthly, 0))}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(costPerDivision.reduce((s, [, d]) => s + d.totalMonthly, 0) * 12)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Data Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Brand</th>
              <th>Model</th>
              <th>Serial Number</th>
              <th>Asset Tag</th>
              <th>Division</th>
              <th>Device Cost</th>
              <th>Monthly</th>
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
                <td>{getDivision(l) || '-'}</td>
                <td>{l.device_cost ? `R ${Number(l.device_cost).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}</td>
                <td>{l.monthly_cost ? `R ${Number(l.monthly_cost).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}</td>
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
