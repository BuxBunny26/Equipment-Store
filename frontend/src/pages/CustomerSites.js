import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { customersApi } from '../services/api';
import { exportData, EXPORT_COLUMNS } from '../services/exportUtils';
import { Icons } from '../components/Icons';

function CustomerSites() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerEquipment, setCustomerEquipment] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    total_customers: 0,
    customers_with_equipment: 0,
    total_equipment_out: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [customersRes, statsRes] = await Promise.all([
        customersApi.getAll({ has_equipment: true }),
        customersApi.getStats()
      ]);
      setCustomers(customersRes.data);
      setStats(statsRes.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerClick = async (customer) => {
    if (selectedCustomer?.id === customer.id) {
      setSelectedCustomer(null);
      setCustomerEquipment([]);
      return;
    }
    
    setSelectedCustomer(customer);
    try {
      const { data } = await customersApi.getEquipment(customer.id);
      setCustomerEquipment(data);
    } catch (err) {
      console.error('Error fetching customer equipment:', err);
      setCustomerEquipment([]);
    }
  };

  const handleExport = async (customerId = null, format = 'excel') => {
    if (customerId) {
      // Export equipment for a specific customer
      try {
        const res = await customersApi.getEquipment(customerId);
        const customer = customers.find(c => c.id === customerId);
        exportData(format, res.data || [], EXPORT_COLUMNS.customerEquipment, `customer_equipment_${customer?.display_name || customerId}`, `Equipment at ${customer?.display_name || 'Customer'}`);
      } catch (err) {
        console.error('Export error:', err);
      }
    } else {
      // Export all customers
      exportData(format, customers, EXPORT_COLUMNS.customers, 'all_customers', 'All Customers');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const filteredCustomers = customers.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return c.display_name?.toLowerCase().includes(term) ||
           c.billing_city?.toLowerCase().includes(term) ||
           c.customer_number?.toLowerCase().includes(term);
  });

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading customer sites...
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Customer Sites</h1>
          <p className="subtitle">Track equipment deployed at customer locations</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-secondary" onClick={() => handleExport(null, 'csv')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icons.Download size={16} /> CSV
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport(null, 'excel')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icons.Download size={16} /> Excel
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport(null, 'pdf')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icons.Download size={16} /> PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
          <button className="btn btn-sm" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-value">{stats.total_customers || customers.length}</div>
          <div className="stat-label">Total Customers</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-value">{stats.customers_with_equipment || filteredCustomers.length}</div>
          <div className="stat-label">With Equipment</div>
        </div>
        <div className="stat-card stat-primary">
          <div className="stat-value">{stats.total_equipment_out || 0}</div>
          <div className="stat-label">Equipment Deployed</div>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search customers by name, city, or customer number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Customer List with Equipment */}
      <div className="card">
        {filteredCustomers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No customers with equipment found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredCustomers.map(customer => (
              <div key={customer.id}>
                <div 
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCustomerClick(customer); } }}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '1rem',
                    background: selectedCustomer?.id === customer.id ? 'var(--bg-tertiary)' : 'transparent',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onClick={() => handleCustomerClick(customer)}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                      {customer.display_name}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {customer.billing_city && <span>{customer.billing_city}</span>}
                      {customer.customer_number && <span> • #{customer.customer_number}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span className="badge badge-checked-out">
                      {customerEquipment.length > 0 && selectedCustomer?.id === customer.id ? customerEquipment.length : '...'} items
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {selectedCustomer?.id === customer.id ? <Icons.ChevronDown size={16} /> : <Icons.ChevronRight size={16} />}
                    </span>
                  </div>
                </div>

                {/* Expanded Equipment List */}
                {selectedCustomer?.id === customer.id && (
                  <div style={{ 
                    marginLeft: '1rem', 
                    padding: '1rem', 
                    borderLeft: '2px solid var(--border)',
                    marginTop: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <h4>Equipment at {customer.display_name}</h4>
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={(e) => { e.stopPropagation(); handleExport(customer.id, 'excel'); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Icons.Download size={14} /> Export
                      </button>
                    </div>
                    
                    {customerEquipment.length === 0 ? (
                      <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        No equipment currently at this customer site
                      </div>
                    ) : (
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Equipment</th>
                            <th>Serial Number</th>
                            <th>Category</th>
                            <th>Checked Out</th>
                            <th>By</th>
                            <th>Days</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerEquipment.map(eq => (
                            <tr key={eq.id}>
                              <td>
                                <Link to={`/equipment/${eq.id}`} style={{ fontWeight: 500 }}>
                                  {eq.equipment_id}
                                </Link>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  {eq.equipment_name}
                                </div>
                              </td>
                              <td>{eq.serial_number || '-'}</td>
                              <td>{eq.category}</td>
                              <td>{formatDate(eq.checked_out_at)}</td>
                              <td>{eq.checked_out_to || '-'}</td>
                              <td>
                                {(() => {
                                  const days = eq.checked_out_at ? Math.floor((new Date() - new Date(eq.checked_out_at)) / (1000 * 60 * 60 * 24)) : 0;
                                  return (
                                    <span style={{ 
                                      color: days > 30 ? 'var(--error-color)' : 
                                             days > 14 ? 'var(--warning-color)' : 'inherit'
                                    }}>
                                      {days}
                                    </span>
                                  );
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerSites;
