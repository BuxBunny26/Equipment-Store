import React, { useState, useEffect } from 'react';
import { reportsApi } from '../services/api';
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
    return new Date(dateString).toLocaleString('en-AU', {
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
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Equipment inventory reports and analytics</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchData}>
          Refresh
        </button>
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

export default Reports;
