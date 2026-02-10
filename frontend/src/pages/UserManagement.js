import React, { useState, useEffect, useCallback } from 'react';
import { usersApi, personnelApi } from '../services/api';
import { Icons } from '../components/Icons';

function UserManagement() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  
  const [filters, setFilters] = useState({
    role_id: '',
    is_active: '',
    search: '',
  });
  
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState([]);
  const [bulkRoleId, setBulkRoleId] = useState(3);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    role_id: 3,
    personnel_id: '',
    is_active: true,
    phone: '',
    department: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.role_id) params.role_id = filters.role_id;
      if (filters.is_active !== '') params.is_active = filters.is_active;
      if (filters.search) params.search = filters.search;
      
      const response = await usersApi.getAll(params);
      setUsers(Array.isArray(response?.data) ? response.data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchData = async () => {
    try {
      const [rolesRes, personnelRes] = await Promise.all([
        usersApi.getRoles(),
        personnelApi.getAll(true),
      ]);
      setRoles(Array.isArray(rolesRes?.data) ? rolesRes.data : []);
      setPersonnel(Array.isArray(personnelRes?.data) ? personnelRes.data : []);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role_id: user.role_id,
        personnel_id: user.personnel_id || '',
        is_active: user.is_active,
        phone: user.phone || '',
        department: user.department || '',
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        full_name: '',
        role_id: 3,
        personnel_id: '',
        is_active: true,
        phone: '',
        department: '',
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, formData);
      } else {
        await usersApi.create(formData);
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      await usersApi.updateStatus(id, !currentStatus);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await usersApi.delete(id);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBulkImport = async () => {
    if (selectedPersonnel.length === 0) {
      setError('Please select at least one person to import');
      return;
    }
    
    setSubmitting(true);
    try {
      const response = await usersApi.bulkImport(selectedPersonnel, bulkRoleId);
      setShowBulkModal(false);
      setSelectedPersonnel([]);
      fetchUsers();
      alert(response.data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const togglePersonnelSelection = (id) => {
    setSelectedPersonnel(prev => 
      prev.includes(id) 
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  const selectAllPersonnel = () => {
    if (!Array.isArray(personnel) || !Array.isArray(users)) return;
    const unlinkedPersonnel = personnel.filter(p => 
      !users.some(u => u.personnel_id === p.id)
    );
    setSelectedPersonnel(unlinkedPersonnel.map(p => p.id));
  };

  const getRoleBadge = (roleName) => {
    const badges = {
      admin: 'badge-danger',
      manager: 'badge-consumable',
      technician: 'badge-available',
      viewer: 'badge',
    };
    return badges[roleName] || 'badge';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && users.length === 0) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading users...
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>User Management</h1>
          <p className="subtitle">Manage system users and their roles</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowBulkModal(true)}>
            <Icons.Users size={16} /> Import from Personnel
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            + Add User
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
          <button className="btn btn-sm" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Role Summary */}
      <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
        {Array.isArray(roles) && roles.map(role => {
          const count = Array.isArray(users) ? users.filter(u => u.role_id === role.id).length : 0;
          return (
            <div className="stat-card" key={role.id}>
              <div className="stat-value">{count}</div>
              <div className="stat-label" style={{ textTransform: 'capitalize' }}>{role.name}s</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
            <label className="form-label">Search</label>
            <input
              type="text"
              className="form-input"
              placeholder="Name, username, or email..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
            <label className="form-label">Role</label>
            <select 
              className="form-input"
              value={filters.role_id}
              onChange={(e) => setFilters(prev => ({ ...prev, role_id: e.target.value }))}
            >
              <option value="">All Roles</option>
              {roles.map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '120px' }}>
            <label className="form-label">Status</label>
            <select 
              className="form-input"
              value={filters.is_active}
              onChange={(e) => setFilters(prev => ({ ...prev, is_active: e.target.value }))}
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <button 
            className="btn btn-secondary"
            onClick={() => setFilters({ role_id: '', is_active: '', search: '' })}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Department</th>
              <th>Personnel Link</th>
              <th>Last Login</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                  No users found
                </td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{user.full_name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      @{user.username} • {user.email}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${getRoleBadge(user.role_name)}`}>
                      {user.role_name}
                    </span>
                  </td>
                  <td>{user.department || '-'}</td>
                  <td>
                    {user.employee_id ? (
                      <span className="badge badge-available">{user.employee_id}</span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>Not linked</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{formatDate(user.last_login)}</td>
                  <td>
                    <span className={`badge ${user.is_active ? 'badge-available' : 'badge'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleOpenModal(user)}
                        title="Edit"
                      >
                        <Icons.Edit size={14} />
                      </button>
                      <button 
                        className={`btn btn-sm ${user.is_active ? '' : 'btn-success'}`}
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        title={user.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {user.is_active ? <Icons.Pause size={14} /> : <Icons.Play size={14} />}
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(user.id)}
                        title="Delete"
                      >
                        <Icons.Trash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{editingUser ? 'Edit User' : 'Add User'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Username *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select
                      className="form-input"
                      value={formData.role_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, role_id: parseInt(e.target.value) }))}
                      required
                    >
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>
                          {role.name} - {role.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Link to Personnel</label>
                    <select
                      className="form-input"
                      value={formData.personnel_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, personnel_id: e.target.value }))}
                    >
                      <option value="">No link</option>
                      {personnel.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} ({p.employee_id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    />
                    User is active
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : (editingUser ? 'Update' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3>Import Users from Personnel</h3>
              <button className="modal-close" onClick={() => setShowBulkModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ flex: 1, overflow: 'auto' }}>
              <div className="form-group">
                <label className="form-label">Assign Role to All Selected</label>
                <select
                  className="form-input"
                  value={bulkRoleId}
                  onChange={(e) => setBulkRoleId(parseInt(e.target.value))}
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name} - {role.description}
                    </option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 500 }}>
                  {selectedPersonnel.length} of {Array.isArray(personnel) && Array.isArray(users) ? personnel.filter(p => !users.some(u => u.personnel_id === p.id)).length : 0} personnel selected
                </span>
                <button className="btn btn-sm btn-secondary" onClick={selectAllPersonnel}>
                  Select All Unlinked
                </button>
              </div>
              
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '300px', overflow: 'auto' }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      <th>Name</th>
                      <th>Employee ID</th>
                      <th>Email</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personnel.map(person => {
                      const isLinked = users.some(u => u.personnel_id === person.id);
                      const isSelected = selectedPersonnel.includes(person.id);
                      return (
                        <tr 
                          key={person.id} 
                          style={{ 
                            opacity: isLinked ? 0.5 : 1,
                            cursor: isLinked ? 'not-allowed' : 'pointer',
                            background: isSelected ? 'var(--primary-light)' : undefined
                          }}
                          onClick={() => !isLinked && togglePersonnelSelection(person.id)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isLinked}
                              onChange={() => togglePersonnelSelection(person.id)}
                              onClick={e => e.stopPropagation()}
                            />
                          </td>
                          <td style={{ fontWeight: 500 }}>{person.full_name}</td>
                          <td>{person.employee_id}</td>
                          <td style={{ fontSize: '0.85rem' }}>{person.email}</td>
                          <td>
                            {isLinked ? (
                              <span className="badge">Already Linked</span>
                            ) : (
                              <span className="badge badge-available">Available</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => { setShowBulkModal(false); setSelectedPersonnel([]); }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleBulkImport}
                disabled={submitting || selectedPersonnel.length === 0}
              >
                {submitting ? 'Importing...' : `Import ${selectedPersonnel.length} Users`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
