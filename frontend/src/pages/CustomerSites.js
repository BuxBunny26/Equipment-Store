import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { customersApi, exportsApi } from '../services/api';
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
      // We'll get equipment from the movements/checked-out endpoint
      const response = await fetch(`/api/reports/checked-out?customer_id=${customer.id}`);
      const data = await response.json();
      setCustomerEquipment(data);
    } catch (err) {
      console.error('Error fetching customer equipment:', err);
      setCustomerEquipment([]);
    }
  };

  const handleExport = (customerId = null) => {
    window.open(exportsApi.getCustomerEquipmentUrl(customerId), '_blank');
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
           c.city?.toLowerCase().includes(term) ||
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
        <button className="btn btn-secondary" onClick={() => handleExport()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Icons.Download size={16} /> Export All
        </button>
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
                      {customer.city && <span>{customer.city}</span>}
                      {customer.customer_number && <span> • #{customer.customer_number}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span className="badge badge-checked-out">
                      {customer.equipment_count || 0} items
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
                        onClick={(e) => { e.stopPropagation(); handleExport(customer.id); }}
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
                              <td>{formatDate(eq.last_action_timestamp)}</td>
                              <td>{eq.holder_name || '-'}</td>
                              <td>
                                <span style={{ 
                                  color: eq.days_out > 30 ? 'var(--danger)' : 
                                         eq.days_out > 14 ? 'var(--warning)' : 'inherit'
                                }}>
                                  {eq.days_out || 0}
                                </span>
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
