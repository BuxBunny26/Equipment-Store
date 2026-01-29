import React, { useState, useEffect } from 'react';
import { categoriesApi, subcategoriesApi, locationsApi, personnelApi } from '../services/api';
import { useTheme } from '../context/ThemeContext';

function Settings() {
  const [activeTab, setActiveTab] = useState('categories');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage system configuration</p>
        </div>
      </div>

      {/* Settings Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Categories
        </button>
        <button
          className={`tab ${activeTab === 'subcategories' ? 'active' : ''}`}
          onClick={() => setActiveTab('subcategories')}
        >
          Subcategories
        </button>
        <button
          className={`tab ${activeTab === 'locations' ? 'active' : ''}`}
          onClick={() => setActiveTab('locations')}
        >
          Locations
        </button>
        <button
          className={`tab ${activeTab === 'personnel' ? 'active' : ''}`}
          onClick={() => setActiveTab('personnel')}
        >
          Personnel
        </button>
        <button
          className={`tab ${activeTab === 'appearance' ? 'active' : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          Appearance
        </button>
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'categories' && <CategoriesSettings />}
        {activeTab === 'subcategories' && <SubcategoriesSettings />}
        {activeTab === 'locations' && <LocationsSettings />}
        {activeTab === 'personnel' && <PersonnelSettings />}
        {activeTab === 'appearance' && <AppearanceSettings />}
      </div>
    </div>
  );
}

// Categories Settings
function CategoriesSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    is_checkout_allowed: true,
    is_consumable: false,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await categoriesApi.getAll();
      setCategories(response.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await categoriesApi.create(formData);
      setShowModal(false);
      setFormData({ name: '', is_checkout_allowed: true, is_consumable: false });
      fetchCategories();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div> Loading...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3>Categories ({categories.length})</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Category
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Checkout Allowed</th>
              <th>Consumable</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td><strong>{cat.name}</strong></td>
                <td>
                  {cat.is_checkout_allowed ? (
                    <span className="badge badge-available">Yes</span>
                  ) : (
                    <span className="badge badge-checked-out">No</span>
                  )}
                </td>
                <td>
                  {cat.is_consumable ? (
                    <span className="badge badge-consumable">Yes</span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }}>No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Category</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_checkout_allowed}
                      onChange={(e) => setFormData({ ...formData, is_checkout_allowed: e.target.checked })}
                    />
                    Checkout Allowed
                  </label>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_consumable}
                      onChange={(e) => setFormData({ ...formData, is_consumable: e.target.checked })}
                    />
                    Consumable Category
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcategories Settings
function SubcategoriesSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subcategories, setSubcategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', category_id: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [subRes, catRes] = await Promise.all([
        subcategoriesApi.getAll(),
        categoriesApi.getAll(),
      ]);
      setSubcategories(subRes.data);
      setCategories(catRes.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await subcategoriesApi.create(formData);
      setShowModal(false);
      setFormData({ name: '', category_id: '' });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div> Loading...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3>Subcategories ({subcategories.length})</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Subcategory
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {subcategories.map((sub) => (
              <tr key={sub.id}>
                <td><strong>{sub.name}</strong></td>
                <td>{sub.category_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Subcategory</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    className="form-select"
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    required
                  >
                    <option value="">Select category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Locations Settings
function LocationsSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locations, setLocations] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', region: '', country: 'South Africa' });
  const [expandedRegions, setExpandedRegions] = useState({});

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const response = await locationsApi.getAll(false);
      setLocations(response.data);
      // Expand all regions by default
      const regions = {};
      response.data.forEach(loc => {
        const key = `${loc.country || 'Other'}-${loc.region || 'Unassigned'}`;
        regions[key] = true;
      });
      setExpandedRegions(regions);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await locationsApi.create(formData);
      setShowModal(false);
      setFormData({ name: '', description: '', region: '', country: 'South Africa' });
      fetchLocations();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleRegion = (key) => {
    setExpandedRegions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Group locations by country then region
  const groupedLocations = locations.reduce((acc, loc) => {
    const country = loc.country || 'Other';
    const region = loc.region || 'Unassigned';
    if (!acc[country]) acc[country] = {};
    if (!acc[country][region]) acc[country][region] = [];
    acc[country][region].push(loc);
    return acc;
  }, {});

  // Sort countries with South Africa first, then alphabetical
  const sortedCountries = Object.keys(groupedLocations).sort((a, b) => {
    if (a === 'South Africa') return -1;
    if (b === 'South Africa') return 1;
    return a.localeCompare(b);
  });

  if (loading) {
    return <div className="loading"><div className="spinner"></div> Loading...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3>Locations ({locations.length})</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Location
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {sortedCountries.map(country => (
        <div key={country} style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ 
            borderBottom: '2px solid var(--primary-color)', 
            paddingBottom: '0.5rem', 
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {country === 'South Africa' ? '🇿🇦' : '🌍'} {country}
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
              ({Object.values(groupedLocations[country]).flat().length} locations)
            </span>
          </h4>
          
          {Object.keys(groupedLocations[country]).sort().map(region => {
            const regionKey = `${country}-${region}`;
            const isExpanded = expandedRegions[regionKey] !== false;
            const regionLocations = groupedLocations[country][region];
            
            return (
              <div key={regionKey} style={{ marginBottom: '0.75rem', marginLeft: '1rem' }}>
                <div 
                  onClick={() => toggleRegion(regionKey)}
                  style={{ 
                    cursor: 'pointer', 
                    padding: '0.5rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontWeight: 500 }}>
                    {isExpanded ? '▼' : '▶'} {region}
                  </span>
                  <span className="badge">{regionLocations.length}</span>
                </div>
                
                {isExpanded && (
                  <div style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                    {regionLocations.map(loc => (
                      <div 
                        key={loc.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          borderBottom: '1px solid var(--border-color)'
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 500 }}>{loc.name}</span>
                          {loc.description && (
                            <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              - {loc.description}
                            </span>
                          )}
                        </div>
                        <span className={`badge ${loc.is_active ? 'badge-available' : ''}`}>
                          {loc.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Location</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <select
                    className="form-input"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  >
                    <option value="South Africa">South Africa</option>
                    <option value="Mozambique">Mozambique</option>
                    <option value="Namibia">Namibia</option>
                    <option value="Botswana">Botswana</option>
                    <option value="Zimbabwe">Zimbabwe</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Region/Province</label>
                  {formData.country === 'South Africa' ? (
                    <select
                      className="form-input"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    >
                      <option value="">Select Province</option>
                      <option value="Gauteng">Gauteng</option>
                      <option value="KwaZulu Natal">KwaZulu Natal</option>
                      <option value="Limpopo">Limpopo</option>
                      <option value="Mpumalanga">Mpumalanga</option>
                      <option value="North West">North West</option>
                      <option value="Northern Cape">Northern Cape</option>
                      <option value="Western Cape">Western Cape</option>
                      <option value="Eastern Cape">Eastern Cape</option>
                      <option value="Free State">Free State</option>
                      <option value="Remote">Remote</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="form-input"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      placeholder="Region name"
                    />
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Personnel Settings
function PersonnelSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [personnel, setPersonnel] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    email: '',
    department: '',
  });

  useEffect(() => {
    fetchPersonnel();
  }, []);

  const fetchPersonnel = async () => {
    try {
      setLoading(true);
      const response = await personnelApi.getAll(false);
      setPersonnel(response.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await personnelApi.create(formData);
      setShowModal(false);
      setFormData({ employee_id: '', full_name: '', email: '', department: '' });
      fetchPersonnel();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div> Loading...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3>Personnel ({personnel.length})</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Person
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {personnel.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.employee_id}</strong></td>
                <td>{p.full_name}</td>
                <td>{p.email || '-'}</td>
                <td>{p.department || '-'}</td>
                <td>
                  {p.is_active ? (
                    <span className="badge badge-available">Active</span>
                  ) : (
                    <span className="badge badge-checked-out">Inactive</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Person</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Employee ID *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.employee_id}
                      onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Theme icon components
const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

// Appearance Settings
function AppearanceSettings() {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h3>Appearance</h3>
      </div>
      
      <div className="settings-section">
        <div className="settings-item" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '16px',
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '12px'
        }}>
          <div>
            <h4 style={{ marginBottom: '4px', fontWeight: 500 }}>Dark Mode</h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Switch between light and dark themes
            </p>
          </div>
          <label className="toggle-switch" style={{
            position: 'relative',
            display: 'inline-block',
            width: '50px',
            height: '28px'
          }}>
            <input
              type="checkbox"
              checked={darkMode}
              onChange={toggleDarkMode}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute',
              cursor: 'pointer',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: darkMode ? 'var(--primary-color)' : '#ccc',
              transition: '0.3s',
              borderRadius: '28px'
            }}>
              <span style={{
                position: 'absolute',
                content: '',
                height: '20px',
                width: '20px',
                left: darkMode ? '26px' : '4px',
                bottom: '4px',
                background: 'white',
                transition: '0.3s',
                borderRadius: '50%'
              }}></span>
            </span>
          </label>
        </div>

        <div className="settings-item" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '16px',
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-md)'
        }}>
          <div>
            <h4 style={{ marginBottom: '4px', fontWeight: 500 }}>Current Theme</h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Your current theme preference
            </p>
          </div>
          <span style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            background: darkMode ? 'rgba(66, 165, 245, 0.1)' : 'rgba(25, 118, 210, 0.1)',
            color: 'var(--primary-color)',
            fontWeight: 500,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {darkMode ? <><MoonIcon /> Dark</> : <><SunIcon /> Light</>}
          </span>
        </div>
      </div>
    </div>
  );
}

export default Settings;
