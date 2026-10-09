import React, { useState, useEffect } from 'react';
import { categoriesApi, subcategoriesApi, locationsApi, personnelApi, customersApi } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useOperator } from '../context/OperatorContext';
import { normalizeCountry, SA_PROVINCES } from '../utils/provinces';

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
          className={`tab ${activeTab === 'assets' ? 'active' : ''}`}
          onClick={() => setActiveTab('assets')}
        >
          Assets
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
        {activeTab === 'assets' && <AssetsSettings />}
        {activeTab === 'appearance' && <AppearanceSettings />}
      </div>
    </div>
  );
}

// Categories Settings
function CategoriesSettings() {
  const { operatorRole } = useOperator();
  const isManager = !!operatorRole && ['admin', 'manager'].includes(operatorRole.toLowerCase());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    is_checkout_allowed: true,
    is_consumable: false,
  });

  // Reassign / delete flow
  const [reassign, setReassign] = useState(null); // { source, andDelete, targetId, busy, message }

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

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: '', is_checkout_allowed: true, is_consumable: false });
    setShowModal(true);
  };

  const openEditModal = (cat) => {
    setEditingId(cat.id);
    setFormData({
      name: cat.name,
      is_checkout_allowed: cat.is_checkout_allowed,
      is_consumable: cat.is_consumable,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await categoriesApi.update(editingId, formData);
      } else {
        await categoriesApi.create(formData);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', is_checkout_allowed: true, is_consumable: false });
      fetchCategories();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteClick = async (cat) => {
    setError(null);
    try {
      const count = await categoriesApi.getEquipmentCount(cat.id);
      if (count > 0) {
        setReassign({
          source: cat,
          andDelete: true,
          targetId: '',
          busy: false,
          message: `${count} equipment item(s) are assigned to "${cat.name}". Choose a category to reassign them to before it can be deleted.`,
        });
        return;
      }
      if (!window.confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;
      await categoriesApi.remove(cat.id);
      fetchCategories();
    } catch (err) {
      setError(err.message);
    }
  };

  const openReassignOnly = (cat) => {
    setError(null);
    setReassign({ source: cat, andDelete: false, targetId: '', busy: false, message: '' });
  };

  const handleReassignConfirm = async () => {
    if (!reassign?.targetId) return;
    setReassign(prev => ({ ...prev, busy: true }));
    try {
      const moved = await categoriesApi.reassignEquipment(reassign.source.id, parseInt(reassign.targetId));
      if (reassign.andDelete) {
        await categoriesApi.remove(reassign.source.id);
      }
      setReassign(null);
      setError(null);
      fetchCategories();
      // eslint-disable-next-line no-alert
      if (moved > 0 || reassign.andDelete) {
        window.alert(
          reassign.andDelete
            ? `Moved ${moved} equipment item(s) and deleted "${reassign.source.name}".`
            : `Moved ${moved} equipment item(s) to the selected category.`
        );
      }
    } catch (err) {
      setError(err.message);
      setReassign(prev => ({ ...prev, busy: false }));
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div> Loading...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3>Categories ({categories.length})</h3>
        {isManager && (
          <button className="btn btn-primary" onClick={openAddModal}>
            + Add Category
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Checkout Allowed</th>
              <th>Consumable</th>
              {isManager && <th>Actions</th>}
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
                {isManager && (
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(cat)}>Edit</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => openReassignOnly(cat)}>Reassign</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteClick(cat)}>Delete</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Category' : 'Add Category'}</h2>
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
                <button type="submit" className="btn btn-primary">{editingId ? 'Save' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reassign && (
        <div className="modal-overlay" onClick={() => !reassign.busy && setReassign(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Reassign "{reassign.source.name}"</h2>
              <button className="modal-close" onClick={() => setReassign(null)} disabled={reassign.busy}>×</button>
            </div>
            <div className="modal-body">
              {reassign.message && <div className="alert alert-warning" style={{ marginBottom: '12px' }}>{reassign.message}</div>}
              <div className="form-group">
                <label className="form-label">Move equipment to *</label>
                <select
                  className="form-select"
                  value={reassign.targetId}
                  onChange={(e) => setReassign(prev => ({ ...prev, targetId: e.target.value }))}
                  required
                >
                  <option value="">Select category...</option>
                  {categories.filter(c => c.id !== reassign.source.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setReassign(null)} disabled={reassign.busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleReassignConfirm}
                disabled={!reassign.targetId || reassign.busy}
              >
                {reassign.busy ? 'Working...' : reassign.andDelete ? 'Reassign & Delete' : 'Reassign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// Subcategories Settings
function SubcategoriesSettings() {
  const { operatorRole } = useOperator();
  const isManager = !!operatorRole && ['admin', 'manager'].includes(operatorRole.toLowerCase());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subcategories, setSubcategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', category_id: '' });

  // Reassign / delete flow
  const [reassign, setReassign] = useState(null); // { source, andDelete, targetId, busy, message }

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

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: '', category_id: '' });
    setShowModal(true);
  };

  const openEditModal = (sub) => {
    setEditingId(sub.id);
    setFormData({ name: sub.name, category_id: sub.category_id?.toString() || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await subcategoriesApi.update(editingId, { name: formData.name, category_id: parseInt(formData.category_id) });
      } else {
        await subcategoriesApi.create(formData);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', category_id: '' });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteClick = async (sub) => {
    setError(null);
    try {
      const count = await subcategoriesApi.getEquipmentCount(sub.id);
      if (count > 0) {
        setReassign({
          source: sub,
          andDelete: true,
          targetId: '',
          busy: false,
          message: `${count} equipment item(s) are assigned to "${sub.name}". Choose a subcategory to reassign them to before it can be deleted.`,
        });
        return;
      }
      if (!window.confirm(`Delete subcategory "${sub.name}"? This cannot be undone.`)) return;
      await subcategoriesApi.remove(sub.id);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const openReassignOnly = (sub) => {
    setError(null);
    setReassign({ source: sub, andDelete: false, targetId: '', busy: false, message: '' });
  };

  const handleReassignConfirm = async () => {
    if (!reassign?.targetId) return;
    setReassign(prev => ({ ...prev, busy: true }));
    try {
      const moved = await subcategoriesApi.reassignEquipment(reassign.source.id, parseInt(reassign.targetId));
      if (reassign.andDelete) {
        await subcategoriesApi.remove(reassign.source.id);
      }
      setReassign(null);
      setError(null);
      fetchData();
      // eslint-disable-next-line no-alert
      if (moved > 0 || reassign.andDelete) {
        window.alert(
          reassign.andDelete
            ? `Moved ${moved} equipment item(s) and deleted "${reassign.source.name}".`
            : `Moved ${moved} equipment item(s) to the selected subcategory.`
        );
      }
    } catch (err) {
      setError(err.message);
      setReassign(prev => ({ ...prev, busy: false }));
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div> Loading...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3>Subcategories ({subcategories.length})</h3>
        {isManager && (
          <button className="btn btn-primary" onClick={openAddModal}>
            + Add Subcategory
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              {isManager && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {subcategories.map((sub) => (
              <tr key={sub.id}>
                <td><strong>{sub.name}</strong></td>
                <td>{sub.category_name}</td>
                {isManager && (
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(sub)}>Edit</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => openReassignOnly(sub)}>Reassign</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteClick(sub)}>Delete</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Subcategory' : 'Add Subcategory'}</h2>
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
                <button type="submit" className="btn btn-primary">{editingId ? 'Save' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reassign && (
        <div className="modal-overlay" onClick={() => !reassign.busy && setReassign(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Reassign "{reassign.source.name}"</h2>
              <button className="modal-close" onClick={() => setReassign(null)} disabled={reassign.busy}>×</button>
            </div>
            <div className="modal-body">
              {reassign.message && <div className="alert alert-warning" style={{ marginBottom: '12px' }}>{reassign.message}</div>}
              <div className="form-group">
                <label className="form-label">Move equipment to *</label>
                <select
                  className="form-select"
                  value={reassign.targetId}
                  onChange={(e) => setReassign(prev => ({ ...prev, targetId: e.target.value }))}
                  required
                >
                  <option value="">Select subcategory...</option>
                  {subcategories.filter(s => s.id !== reassign.source.id).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.category_name})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setReassign(null)} disabled={reassign.busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleReassignConfirm}
                disabled={!reassign.targetId || reassign.busy}
              >
                {reassign.busy ? 'Working...' : reassign.andDelete ? 'Reassign & Delete' : 'Reassign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Locations Settings -- unified management of both WearCheck's own internal
// branches (stored in `locations`, powering the "Internal Location (Branch)"
// destination in Check Out) and customer/third-party destinations (stored in
// `customers`, e.g. "Weir Minerals", powering the "Customer Site"
// destination in Check Out). Viewing is open to everyone; adding an Internal
// Branch remains open to everyone (matching prior behaviour), but adding a
// Customer Site is admin-only (matching the prior Customer Sites tab).
function LocationsSettings() {
  const { operatorRole } = useOperator();
  const isAdmin = !!operatorRole && operatorRole.toLowerCase() === 'admin';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locations, setLocations] = useState([]);
  const [sites, setSites] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    type: 'internal', name: '', description: '', region: '', country: 'South Africa',
  });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [togglingKey, setTogglingKey] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [locationsRes, sitesRes] = await Promise.all([
        locationsApi.getAll(false),
        customersApi.getAll({ active_only: 'false' }),
      ]);
      setLocations(locationsRes.data || []);
      setSites(sitesRes.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setFormError(null);
    setFormData({ type: 'internal', name: '', description: '', region: '', country: 'South Africa' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const name = formData.name.trim();
    if (!name) {
      setFormError('Name is required');
      return;
    }
    if (formData.type === 'customer' && !isAdmin) {
      setFormError('Only admins can add customer sites');
      return;
    }
    const country = formData.country.trim();
    if (formData.type === 'customer' && !country) {
      setFormError('Country is required');
      return;
    }

    setSaving(true);
    try {
      if (formData.type === 'customer') {
        // Admins add a site by name only -- derive a unique customer_number
        // from it (the table's required identifier) so nobody has to think
        // about internal numbering. Mirrors the convention already used for
        // the existing SBM vessel site entries (e.g. "SBM-MONDO").
        const base = name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'SITE';
        const existingNumbers = new Set(sites.map(s => s.customer_number));
        let customerNumber = base;
        let suffix = 2;
        while (existingNumbers.has(customerNumber)) {
          customerNumber = `${base}-${suffix++}`;
        }
        const province = formData.region.trim() || null;
        await customersApi.create({
          customer_number: customerNumber,
          display_name: name,
          billing_country: country,
          shipping_country: country,
          billing_state: province,
          shipping_state: province,
        });
      } else {
        await locationsApi.create({
          name,
          description: formData.description,
          region: formData.region,
          country: formData.country,
        });
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleActive = async (entry) => {
    setTogglingKey(entry.key);
    try {
      if (entry.kind === 'internal') {
        await locationsApi.update(entry.id, { is_active: !entry.is_active });
      } else {
        await customersApi.update(entry.id, { is_active: !entry.is_active });
      }
      await fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingKey(null);
    }
  };

  const term = searchTerm.trim().toLowerCase();
  const filteredLocations = locations.filter(loc => !term || loc.name.toLowerCase().includes(term));
  const filteredSites = sites.filter(s => !term || s.display_name?.toLowerCase().includes(term));

  // Internal branches, grouped by country then region (as before).
  const internalByCountry = filteredLocations.reduce((acc, loc) => {
    const country = loc.country || 'Other';
    const region = loc.region || 'Unassigned';
    if (!acc[country]) acc[country] = {};
    if (!acc[country][region]) acc[country][region] = [];
    acc[country][region].push({
      key: `internal-${loc.id}`, id: loc.id, kind: 'internal',
      name: loc.name, subtitle: loc.description, is_active: loc.is_active,
    });
    return acc;
  }, {});

  // Customer sites, grouped by (normalised) country only (as before).
  const customerByCountry = filteredSites.reduce((acc, site) => {
    const country = normalizeCountry(site.billing_country) || 'Other';
    if (!acc[country]) acc[country] = [];
    acc[country].push({
      key: `customer-${site.id}`, id: site.id, kind: 'customer',
      name: site.display_name, subtitle: site.billing_state || site.billing_city, is_active: site.is_active,
    });
    return acc;
  }, {});

  const allCountries = new Set([...Object.keys(internalByCountry), ...Object.keys(customerByCountry)]);
  const sortedCountries = Array.from(allCountries).sort((a, b) => {
    if (a === 'South Africa') return -1;
    if (b === 'South Africa') return 1;
    return a.localeCompare(b);
  });

  // Country/Province suggestions pooled from everything already in use
  // across both Internal Branches and Customer Sites, plus a small sensible
  // seed list, so the Add Location form reflects the real set of
  // countries/regions WearCheck operates in rather than a stale hardcoded
  // list that was missing most actual customer-site countries.
  const FALLBACK_COUNTRIES = ['South Africa', 'Mozambique', 'Namibia', 'Botswana', 'Zimbabwe'];
  const countryOptions = Array.from(new Set([
    ...FALLBACK_COUNTRIES,
    ...locations.map(l => l.country).filter(Boolean),
    ...sites.map(s => normalizeCountry(s.billing_country)).filter(Boolean),
  ])).sort((a, b) => {
    if (a === 'South Africa') return -1;
    if (b === 'South Africa') return 1;
    return a.localeCompare(b);
  });
  const regionOptions = Array.from(new Set([
    ...locations.map(l => l.region).filter(Boolean),
    ...sites.map(s => s.billing_state).filter(Boolean),
  ])).sort();

  const totalCount = locations.length + sites.length;

  if (loading) {
    return <div className="loading"><div className="spinner"></div> Loading...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3>Locations ({totalCount})</h3>
        <button className="btn btn-primary" onClick={openAddModal}>
          + Add Location
        </button>
      </div>

      <div className="alert alert-info" style={{ marginBottom: '16px' }}>
        <strong>Internal Branches</strong> are WearCheck's own sites (e.g. "WearCheck - Longmeadow")
        and power the "Internal Location (Branch)" destination in Check Out.{' '}
        <strong>Customer Sites</strong> are third-party destinations (e.g. "Weir Minerals") and
        power the "Customer Site" destination in Check Out. Pick the type when adding a location
        below.
      </div>

      <div className="form-group" style={{ maxWidth: '320px' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search locations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {sortedCountries.length === 0 && (
        <p style={{ color: 'var(--text-secondary)' }}>No locations found.</p>
      )}

      {sortedCountries.map(country => {
        const regions = internalByCountry[country] || {};
        const customerEntries = customerByCountry[country] || [];
        const internalCount = Object.values(regions).flat().length;
        const customerCount = customerEntries.length;
        const customerGroupKey = `customer-group-${country}`;
        const isCustomerExpanded = expandedGroups[customerGroupKey] !== false;

        return (
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
                ({internalCount + customerCount} locations)
              </span>
            </h4>

            {internalCount > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem', marginLeft: '1rem' }}>
                  INTERNAL BRANCHES
                </div>
                {Object.keys(regions).sort().map(region => {
                  const regionKey = `internal-group-${country}-${region}`;
                  const isExpanded = expandedGroups[regionKey] !== false;
                  const regionLocations = regions[region];

                  return (
                    <div key={regionKey} style={{ marginBottom: '0.75rem', marginLeft: '1rem' }}>
                      <div
                        onClick={() => toggleGroup(regionKey)}
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
                          {regionLocations.map(entry => (
                            <div
                              key={entry.key}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.5rem 0.75rem',
                                borderBottom: '1px solid var(--border-color)'
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 500 }}>{entry.name}</span>
                                {entry.subtitle && (
                                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    - {entry.subtitle}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className={`badge ${entry.is_active ? 'badge-available' : ''}`}>
                                  {entry.is_active ? 'Active' : 'Inactive'}
                                </span>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    disabled={togglingKey === entry.key}
                                    onClick={() => handleToggleActive(entry)}
                                  >
                                    {togglingKey === entry.key ? '...' : entry.is_active ? 'Deactivate' : 'Activate'}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {customerCount > 0 && (
              <div style={{ marginLeft: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  CUSTOMER SITES
                </div>
                <div
                  onClick={() => toggleGroup(customerGroupKey)}
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
                    {isCustomerExpanded ? '▼' : '▶'} Customer Sites
                  </span>
                  <span className="badge">{customerCount}</span>
                </div>

                {isCustomerExpanded && (
                  <div style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                    {customerEntries.map(entry => (
                      <div
                        key={entry.key}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          borderBottom: '1px solid var(--border-color)'
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 500 }}>{entry.name}</span>
                          {entry.subtitle && (
                            <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              - {entry.subtitle}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className={`badge ${entry.is_active ? 'badge-available' : ''}`}>
                            {entry.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {isAdmin && (
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              disabled={togglingKey === entry.key}
                              onClick={() => handleToggleActive(entry)}
                            >
                              {togglingKey === entry.key ? '...' : entry.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Location</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{formError}</div>}
                {isAdmin && (
                  <div className="form-group">
                    <label className="form-label">Type *</label>
                    <select
                      className="form-input"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                      <option value="internal">Internal Branch (WearCheck site)</option>
                      <option value="customer">Customer Site</option>
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={formData.type === 'customer' ? 'e.g., Weir Minerals' : 'e.g., WearCheck - Polokwane'}
                    required
                  />
                </div>

                {formData.type === 'customer' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Country *</label>
                      <input
                        type="text"
                        className="form-input"
                        list="location-countries"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        placeholder="e.g., South Africa"
                        required
                      />
                      <datalist id="location-countries">
                        {countryOptions.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Province (optional)</label>
                      {formData.country.trim().toLowerCase() === 'south africa' ? (
                        <select
                          className="form-input"
                          value={formData.region}
                          onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        >
                          <option value="">Select Province</option>
                          {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      ) : (
                        <>
                          <input
                            type="text"
                            className="form-input"
                            list="location-regions"
                            value={formData.region}
                            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                            placeholder="Region name"
                          />
                          <datalist id="location-regions">
                            {regionOptions.map(r => <option key={r} value={r} />)}
                          </datalist>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">Country</label>
                      <input
                        type="text"
                        className="form-input"
                        list="location-countries"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        placeholder="e.g., South Africa"
                      />
                      <datalist id="location-countries">
                        {countryOptions.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Region/Province</label>
                      {formData.country.trim().toLowerCase() === 'south africa' ? (
                        <select
                          className="form-input"
                          value={formData.region}
                          onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        >
                          <option value="">Select Province</option>
                          {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                          <option value="Remote">Remote</option>
                        </select>
                      ) : (
                        <>
                          <input
                            type="text"
                            className="form-input"
                            list="location-regions"
                            value={formData.region}
                            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                            placeholder="Region name"
                          />
                          <datalist id="location-regions">
                            {regionOptions.map(r => <option key={r} value={r} />)}
                          </datalist>
                        </>
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
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Create'}
                </button>
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
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
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

  // Get unique departments for filter dropdown
  const departments = [...new Set(personnel.map(p => p.department).filter(Boolean))].sort();

  // Filter personnel based on search and department
  const filteredPersonnel = personnel.filter(p => {
    const matchesSearch = !searchTerm || 
      p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = !departmentFilter || p.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  if (loading) {
    return <div className="loading"><div className="spinner"></div> Loading...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3>Personnel ({filteredPersonnel.length}{filteredPersonnel.length !== personnel.length ? ` of ${personnel.length}` : ''})</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Person
        </button>
      </div>

      {/* Search and Filter */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name, ID, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ minWidth: '180px' }}>
          <select
            className="form-input"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        {(searchTerm || departmentFilter) && (
          <button 
            className="btn btn-secondary"
            onClick={() => { setSearchTerm(''); setDepartmentFilter(''); }}
          >
            Clear
          </button>
        )}
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
            {filteredPersonnel.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  No personnel found matching your filters
                </td>
              </tr>
            ) : (
              filteredPersonnel.map((p) => (
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
              ))
            )}
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

// Assets Settings — manage dropdown options for asset forms
const ASSET_CONFIG_KEY = 'equipment_store_asset_config';

const DEFAULT_ASSET_CONFIG = {
  laptopBrands: ['Acer', 'Apple', 'Asus', 'Dell', 'HP', 'Huawei', 'Lenovo', 'LG', 'Microsoft', 'MSI', 'Samsung', 'Toshiba', 'Other'],
  phoneBrands: ['Apple', 'Google', 'Huawei', 'Nokia', 'OnePlus', 'Oppo', 'Samsung', 'Sony', 'Vivo', 'Xiaomi', 'Other'],
  vehicleMakes: ['Toyota', 'Ford', 'Volkswagen', 'Nissan', 'Isuzu', 'Hyundai', 'Kia', 'Mercedes-Benz', 'BMW', 'Renault', 'Mitsubishi', 'Mazda', 'Suzuki', 'Chevrolet', 'Other'],
  fuelTypes: ['Petrol', 'Diesel', 'Hybrid', 'Electric'],
};

export function getAssetConfig() {
  try {
    const stored = localStorage.getItem(ASSET_CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_ASSET_CONFIG, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_ASSET_CONFIG };
}

function saveAssetConfig(config) {
  localStorage.setItem(ASSET_CONFIG_KEY, JSON.stringify(config));
}

function EditableListSection({ title, items, onUpdate }) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    if (items.some(i => i.toLowerCase() === trimmed.toLowerCase())) {
      alert('This item already exists');
      return;
    }
    // Insert before "Other" if present, otherwise append
    const otherIdx = items.indexOf('Other');
    const updated = [...items];
    if (otherIdx >= 0) {
      updated.splice(otherIdx, 0, trimmed);
    } else {
      updated.push(trimmed);
    }
    onUpdate(updated);
    setNewItem('');
  };

  const handleRemove = (idx) => {
    if (!window.confirm(`Remove "${items[idx]}"?`)) return;
    onUpdate(items.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <h4 style={{ marginBottom: '8px' }}>{title}</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        {items.map((item, idx) => (
          <span
            key={idx}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'var(--bg-secondary)',
              borderRadius: '16px',
              fontSize: '0.825rem',
              border: '1px solid var(--border-color)',
            }}
          >
            {item}
            <button
              onClick={() => handleRemove(idx)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--error-color)',
                cursor: 'pointer',
                padding: 0,
                fontSize: '1rem',
                lineHeight: 1,
              }}
              title="Remove"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          className="form-input"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Add new ${title.toLowerCase().replace(/s$/, '')}...`}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={handleAdd} disabled={!newItem.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}

function AssetsSettings() {
  const [config, setConfig] = useState(getAssetConfig);
  const [saved, setSaved] = useState(false);

  const updateList = (key) => (newList) => {
    const updated = { ...config, [key]: newList };
    setConfig(updated);
    saveAssetConfig(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (!window.confirm('Reset all asset dropdown options to defaults? This cannot be undone.')) return;
    setConfig({ ...DEFAULT_ASSET_CONFIG });
    saveAssetConfig(DEFAULT_ASSET_CONFIG);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3>Asset Configuration</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage dropdown options used in laptop, cellphone, and vehicle forms
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {saved && <span style={{ color: 'var(--success-color)', fontSize: '0.875rem', fontWeight: 500 }}>Saved!</span>}
          <button className="btn btn-secondary" onClick={handleReset}>Reset to Defaults</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <EditableListSection title="Laptop Brands" items={config.laptopBrands} onUpdate={updateList('laptopBrands')} />
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <EditableListSection title="Phone Brands" items={config.phoneBrands} onUpdate={updateList('phoneBrands')} />
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <EditableListSection title="Vehicle Makes" items={config.vehicleMakes} onUpdate={updateList('vehicleMakes')} />
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <EditableListSection title="Fuel Types" items={config.fuelTypes} onUpdate={updateList('fuelTypes')} />
        </div>
      </div>
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
              background: darkMode ? 'var(--primary-color)' : 'var(--border-color)',
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
