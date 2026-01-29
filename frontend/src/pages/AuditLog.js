import React, { useState, useEffect, useCallback } from 'react';
import { auditApi, exportsApi } from '../services/api';
import { Icons } from '../components/Icons';

function AuditLog() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({
    by_action: [],
    by_table: [],
    by_user: [],
    daily_activity: []
  });
  
  const [filters, setFilters] = useState({
    table_name: '',
    action: '',
    from_date: '',
    to_date: '',
    limit: 50,
    offset: 0,
  });
  
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await auditApi.getAll(filters);
      setLogs(response.data.items || []);
      setTotal(response.data.total || 0);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchSummary = async () => {
    try {
      const response = await auditApi.getSummary(30);
      setSummary(response.data);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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

  const getActionBadge = (action) => {
    const badges = {
      INSERT: 'badge-available',
      UPDATE: 'badge-consumable',
      DELETE: 'badge-danger',
    };
    return badges[action] || 'badge';
  };

  const handleExport = () => {
    const params = {};
    if (filters.from_date) params.from_date = filters.from_date;
    if (filters.to_date) params.to_date = filters.to_date;
    if (filters.table_name) params.table_name = filters.table_name;
    
    window.open(exportsApi.getAuditUrl(params), '_blank');
  };

  const handleNextPage = () => {
    setFilters(prev => ({ ...prev, offset: prev.offset + prev.limit }));
  };

  const handlePrevPage = () => {
    setFilters(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }));
  };

  const formatChanges = (oldValues, newValues, changedFields) => {
    if (!changedFields || !changedFields.length) return null;
    
    return changedFields.map(field => {
      const oldVal = oldValues?.[field];
      const newVal = newValues?.[field];
      return (
        <div key={field} style={{ marginBottom: '0.5rem' }}>
          <strong>{field}:</strong>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--danger)', textDecoration: 'line-through' }}>
              {oldVal !== undefined ? JSON.stringify(oldVal) : '(empty)'}
            </span>
            <span>→</span>
            <span style={{ color: 'var(--success)' }}>
              {newVal !== undefined ? JSON.stringify(newVal) : '(empty)'}
            </span>
          </div>
        </div>
      );
    });
  };

  if (loading && logs.length === 0) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading audit log...
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Audit Log</h1>
          <p className="subtitle">Track all changes made to the system</p>
        </div>
        <button className="btn btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Icons.Download size={16} /> Export to Excel
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
        {summary.by_action.map(item => (
          <div className="stat-card" key={item.action}>
            <div className="stat-value">{item.count}</div>
            <div className="stat-label">{item.action} (30 days)</div>
          </div>
        ))}
      </div>

      {/* Activity Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Top Tables (30 days)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {summary.by_table.slice(0, 5).map(item => (
              <div key={item.table_name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.table_name}</span>
                <span className="badge">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Top Users (30 days)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {summary.by_user.slice(0, 5).map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.user_name}</span>
                <span className="badge">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
            <label className="form-label">Table</label>
            <select 
              className="form-input"
              value={filters.table_name}
              onChange={(e) => setFilters(prev => ({ ...prev, table_name: e.target.value, offset: 0 }))}
            >
              <option value="">All Tables</option>
              <option value="equipment">Equipment</option>
              <option value="equipment_movements">Movements</option>
              <option value="calibration_records">Calibration</option>
              <option value="reservations">Reservations</option>
              <option value="maintenance_log">Maintenance</option>
              <option value="personnel">Personnel</option>
              <option value="customers">Customers</option>
              <option value="users">Users</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '120px' }}>
            <label className="form-label">Action</label>
            <select 
              className="form-input"
              value={filters.action}
              onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value, offset: 0 }))}
            >
              <option value="">All</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
            <label className="form-label">From Date</label>
            <input
              type="date"
              className="form-input"
              value={filters.from_date}
              onChange={(e) => setFilters(prev => ({ ...prev, from_date: e.target.value, offset: 0 }))}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
            <label className="form-label">To Date</label>
            <input
              type="date"
              className="form-input"
              value={filters.to_date}
              onChange={(e) => setFilters(prev => ({ ...prev, to_date: e.target.value, offset: 0 }))}
            />
          </div>
          <button 
            className="btn btn-secondary"
            onClick={() => setFilters({ table_name: '', action: '', from_date: '', to_date: '', limit: 50, offset: 0 })}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            Showing {filters.offset + 1} - {Math.min(filters.offset + filters.limit, total)} of {total} records
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="btn btn-sm btn-secondary" 
              onClick={handlePrevPage}
              disabled={filters.offset === 0}
            >
              ← Previous
            </button>
            <button 
              className="btn btn-sm btn-secondary" 
              onClick={handleNextPage}
              disabled={filters.offset + filters.limit >= total}
            >
              Next →
            </button>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Date/Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Table</th>
              <th>Record ID</th>
              <th>Changed Fields</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                  No audit records found
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</td>
                  <td>{log.user_full_name || log.user_name || 'System'}</td>
                  <td>
                    <span className={`badge ${getActionBadge(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td>{log.table_name}</td>
                  <td>{log.record_id}</td>
                  <td>
                    {log.changed_fields && log.changed_fields.length > 0 ? (
                      <div style={{ fontSize: '0.85rem' }}>
                        {log.changed_fields.slice(0, 3).join(', ')}
                        {log.changed_fields.length > 3 && ` +${log.changed_fields.length - 3} more`}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>-</span>
                    )}
                  </td>
                  <td>
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => setSelectedLog(log)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>Audit Detail</h3>
              <button className="modal-close" onClick={() => setSelectedLog(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <strong>Date/Time:</strong>
                  <div>{formatDate(selectedLog.created_at)}</div>
                </div>
                <div>
                  <strong>User:</strong>
                  <div>{selectedLog.user_full_name || selectedLog.user_name || 'System'}</div>
                </div>
                <div>
                  <strong>Action:</strong>
                  <div>
                    <span className={`badge ${getActionBadge(selectedLog.action)}`}>
                      {selectedLog.action}
                    </span>
                  </div>
                </div>
                <div>
                  <strong>Table / Record:</strong>
                  <div>{selectedLog.table_name} #{selectedLog.record_id}</div>
                </div>
                {selectedLog.ip_address && (
                  <div>
                    <strong>IP Address:</strong>
                    <div>{selectedLog.ip_address}</div>
                  </div>
                )}
              </div>

              {selectedLog.action === 'UPDATE' && selectedLog.changed_fields && (
                <div>
                  <h4 style={{ marginBottom: '0.5rem' }}>Changes:</h4>
                  <div style={{ 
                    background: 'var(--bg-tertiary)', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    fontSize: '0.9rem'
                  }}>
                    {formatChanges(selectedLog.old_values, selectedLog.new_values, selectedLog.changed_fields)}
                  </div>
                </div>
              )}

              {selectedLog.action === 'INSERT' && selectedLog.new_values && (
                <div>
                  <h4 style={{ marginBottom: '0.5rem' }}>New Record:</h4>
                  <pre style={{ 
                    background: 'var(--bg-tertiary)', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    overflow: 'auto',
                    maxHeight: '300px',
                    fontSize: '0.85rem'
                  }}>
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.action === 'DELETE' && selectedLog.old_values && (
                <div>
                  <h4 style={{ marginBottom: '0.5rem' }}>Deleted Record:</h4>
                  <pre style={{ 
                    background: 'var(--bg-tertiary)', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    overflow: 'auto',
                    maxHeight: '300px',
                    fontSize: '0.85rem'
                  }}>
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLog;
