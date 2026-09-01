import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { equipmentApi, categoriesApi, subcategoriesApi, calibrationApi } from '../services/api';
import { exportData, EXPORT_COLUMNS } from '../services/exportUtils';
import ExportMenu from '../components/ExportMenu';
import { Icons } from '../components/Icons';
import AddEquipmentModal from '../components/AddEquipmentModal';
import { getCustomFieldRule, getCustomFieldValue } from '../utils/customFields';
import { useOperator } from '../context/OperatorContext';
import { DEFAULT_EQUIPMENT_FILTERS, filtersToSearchParams, searchParamsToFilters } from '../utils/equipmentListState';
import {
  createInitialBulkEditForm,
  hasAnyBulkEditChange,
  getBulkEditValidationError,
  buildBulkEditPayload,
  describeBulkEditChanges,
} from '../utils/bulkEditEquipment';

function Equipment() {
  const { operatorRole } = useOperator();
  const isManager = !!operatorRole && ['admin', 'manager'].includes(operatorRole.toLowerCase());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  // Search params are the source of truth for restoring the list after
  // Equipment Detail -> Back (browser Back or the Detail page's Back button
  // both just replay history, landing back on this same URL).
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => searchParamsToFilters(searchParams));
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [importData, setImportData] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Admin/Manager multi-select + bulk edit
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showBulkEditConfirm, setShowBulkEditConfirm] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState(createInitialBulkEditForm());
  const [bulkEditSubcategories, setBulkEditSubcategories] = useState([]);
  const [bulkEditSubmitting, setBulkEditSubmitting] = useState(false);
  const [bulkEditError, setBulkEditError] = useState(null);
  const [bulkEditSuccessMessage, setBulkEditSuccessMessage] = useState(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchEquipment();
  }, [filters.status, filters.category_id, filters.is_consumable, filters.calibration_status, filters.channels, filters.search]); // eslint-disable-line

  // Keep the URL in sync so the current filters are restored on
  // Detail -> Back, without spamming browser history on every keystroke.
  useEffect(() => {
    setSearchParams(filtersToSearchParams(filters), { replace: true });
  }, [filters.status, filters.category_id, filters.is_consumable, filters.calibration_status, filters.channels, filters.search]); // eslint-disable-line

  const fetchCategories = async () => {
    try {
      const response = await categoriesApi.getAll();
      setCategories(response.data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.is_consumable !== '') params.is_consumable = filters.is_consumable;
      // Note: search is applied client-side below so it can also match
      // current_location, current_holder, manufacturer and model — fields the
      // server-side .or() filter can't reach (joined columns / not indexed).

      const [eqRes, calRes] = await Promise.all([
        equipmentApi.getAll(params),
        calibrationApi.getStatus()
      ]);

      // Build a map of equipment_id -> latest calibration_status
      const calMap = {};
      (calRes.data || []).forEach(r => {
        calMap[r.equipment_id] = r.calibration_status;
      });

      let items = eqRes.data.map(e => ({
        ...e,
        calibration_status: calMap[e.id] || 'N/A',
      }));

      // Apply search filter client-side across multiple fields including location/holder
      if (filters.search) {
        const q = filters.search.trim().toLowerCase();
        items = items.filter(e => {
          const fields = [
            e.equipment_id,
            e.equipment_name,
            e.serial_number,
            e.description,
            e.manufacturer,
            e.model,
            e.current_location,
            e.current_holder,
            e.holder_employee_id,
            e.category_name,
            e.subcategory_name,
          ];
          return fields.some(f => f && f.toString().toLowerCase().includes(q));
        });
      }

      // Apply calibration filter client-side
      if (filters.calibration_status) {
        if (filters.calibration_status === 'Not Calibrated') {
          items = items.filter(e => e.calibration_status === 'Not Calibrated' || e.calibration_status === 'N/A');
        } else if (filters.calibration_status === 'Calibrated') {
          items = items.filter(e => e.calibration_status === 'Valid');
        } else {
          items = items.filter(e => e.calibration_status === filters.calibration_status);
        }
      }

      // Apply channels filter client-side
      if (filters.channels) {
        items = items.filter(e => {
          const val = e.custom_fields?.channels || null;
          return val === filters.channels;
        });
      }

      setEquipment(items);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchEquipment();
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.equipment_name}" (${item.equipment_id})? It can be restored from Recently Deleted within 30 days.`)) return;
    try {
      await equipmentApi.softDelete(item.id);
      fetchEquipment();
    } catch (err) {
      setError(err.message);
    }
  };

  // Select-all only ever targets the rows currently visible under the active
  // filters, never the full unfiltered dataset. Previously selected ids that
  // scroll out of view (e.g. after changing filters) are deliberately kept,
  // not silently dropped or expanded.
  const visibleEquipmentIds = equipment.map(e => e.id);
  const allVisibleSelected = visibleEquipmentIds.length > 0 &&
    visibleEquipmentIds.every(id => selectedEquipmentIds.includes(id));

  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedEquipmentIds(prev => prev.filter(id => !visibleEquipmentIds.includes(id)));
    } else {
      setSelectedEquipmentIds(prev => Array.from(new Set([...prev, ...visibleEquipmentIds])));
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedEquipmentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleClearSelection = () => setSelectedEquipmentIds([]);

  const openBulkEditModal = () => {
    setBulkEditForm(createInitialBulkEditForm());
    setBulkEditSubcategories([]);
    setBulkEditError(null);
    setShowBulkEditConfirm(false);
    setBulkEditSuccessMessage(null);
    setShowBulkEditModal(true);
  };

  const handleCloseBulkEditModal = () => {
    setShowBulkEditModal(false);
    setShowBulkEditConfirm(false);
    setBulkEditForm(createInitialBulkEditForm());
    setBulkEditSubcategories([]);
    setBulkEditError(null);
  };

  const handleBulkEditCategoryChange = async (categoryId) => {
    try {
      const { data } = await subcategoriesApi.getAll(categoryId);
      setBulkEditSubcategories(data || []);
    } catch (err) {
      setBulkEditSubcategories([]);
    }
  };

  const handleRequestBulkEditSave = () => {
    const validationError = getBulkEditValidationError(bulkEditForm);
    if (validationError) {
      setBulkEditError(validationError);
      return;
    }
    setBulkEditError(null);
    setShowBulkEditConfirm(true);
  };

  const handleCancelBulkEditConfirm = () => {
    setShowBulkEditConfirm(false);
  };

  const handleConfirmBulkEdit = async () => {
    const payload = buildBulkEditPayload(bulkEditForm);
    setBulkEditSubmitting(true);
    setBulkEditError(null);
    try {
      const updated = await equipmentApi.bulkUpdate(selectedEquipmentIds, payload);
      setShowBulkEditModal(false);
      setShowBulkEditConfirm(false);
      setBulkEditForm(createInitialBulkEditForm());
      setBulkEditSubcategories([]);
      setSelectedEquipmentIds([]);
      setBulkEditSuccessMessage(`${updated.length} equipment record${updated.length !== 1 ? 's' : ''} updated successfully.`);
      fetchEquipment();
    } catch (err) {
      setBulkEditError('Error updating equipment: ' + err.message);
      setShowBulkEditConfirm(false);
    } finally {
      setBulkEditSubmitting(false);
    }
  };

  const getStatusBadge = (item) => {
    if (item.is_consumable) {
      if (item.available_quantity <= item.reorder_level) {
        return <span className="badge badge-low-stock">Low Stock</span>;
      }
      return <span className="badge badge-consumable">Consumable</span>;
    }

    if (item.status === 'Available') {
      return <span className="badge badge-available">Available</span>;
    }
    return <span className="badge badge-checked-out">Checked Out</span>;
  };

  const getCalibrationBadge = (item) => {
    if (!item.calibration_status || item.calibration_status === 'N/A') {
      return <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>N/A</span>;
    }
    if (item.calibration_status === 'Not Calibrated') {
      return <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Not Calibrated</span>;
    }
    if (item.calibration_status === 'Expired') {
      return <span className="badge" style={{ background: 'var(--error-color)' }}>Expired</span>;
    }
    if (item.calibration_status === 'Due Soon') {
      return <span className="badge" style={{ background: 'var(--warning-color)' }}>Due Soon</span>;
    }
    return <span className="badge" style={{ background: 'var(--success-color)' }}>Calibrated</span>;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const wsName = wb.SheetNames.find(n => n.toLowerCase().includes('import')) || wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });

        // Normalize header keys to snake_case
        const normalized = jsonData.map(row => {
          const out = {};
          Object.entries(row).forEach(([key, val]) => {
            const k = key.replace(/\s*\*\s*/g, '').trim().toLowerCase().replace(/\s+/g, '_');
            out[k] = typeof val === 'string' ? val.trim() : val;
          });
          return out;
        }).filter(row => row.equipment_id && !row.equipment_id.toString().includes('EXAMPLE'));

        setImportData(normalized);
        setImportResults(null);
        setShowImportModal(true);
      } catch (err) {
        setError('Failed to read file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!importData || importData.length === 0) return;
    setImporting(true);
    try {
      const results = await equipmentApi.bulkImport(importData);
      setImportResults(results);
      if (results.success.length > 0) {
        fetchEquipment();
      }
    } catch (err) {
      setError('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = ['Equipment ID *', 'Equipment Name *', 'Category *', 'Subcategory *', 'Manufacturer', 'Model', 'Serial Number', 'Location *', 'Description', 'Notes'];
    const example1 = ['EQ-EXAMPLE-001', 'SKF CMXA 80 Analyzer', 'Vibration Analysis', 'Analyzers', 'SKF', 'CMXA 80', 'SN-12345', 'WearCheck - Springs', 'Portable vibration analyzer', ''];
    const example2 = ['EQ-EXAMPLE-002', 'Fluke Ti480 Thermal Camera', 'Thermal Camera', 'Handheld Cameras', 'Fluke', 'Ti480', 'SN-67890', 'WearCheck - Springs', 'Infrared thermal imaging camera', 'Delete example rows before importing'];
    const ws = XLSX.utils.aoa_to_sheet([headers, example1, example2]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 20) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipment Import');
    XLSX.writeFile(wb, 'equipment_import_template.xlsx');
  };

  return (
    <div>
      {bulkEditSuccessMessage && (
        <div className="alert alert-success" style={{ marginBottom: '12px' }}>
          {bulkEditSuccessMessage}
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setBulkEditSuccessMessage(null)}
            style={{ marginLeft: 'auto' }}
          >
            ×
          </button>
        </div>
      )}

      {isManager && selectedEquipmentIds.length > 0 && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', marginBottom: '12px' }}>
          <strong>{selectedEquipmentIds.length} selected</strong>
          <button className="btn btn-sm btn-primary" onClick={openBulkEditModal}>Bulk Edit</button>
          <button className="btn btn-sm btn-secondary" onClick={handleClearSelection}>Clear Selection</button>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Equipment</h1>
          <p className="page-subtitle">Manage equipment inventory</p>
        </div>
        <div className="btn-group-wrap">
          <ExportMenu
            onExport={(fmt) => exportData(fmt, equipment, EXPORT_COLUMNS.equipment, 'equipment', 'Equipment List')}
            disabled={equipment.length === 0}
          />
          {isManager && (
            <button className="btn btn-secondary" onClick={() => setShowDeletedModal(true)}>
              Recently Deleted
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => { setShowImportModal(true); setImportData(null); setImportResults(null); }}>
            <Icons.Upload size={16} /> Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Icons.Plus size={16} /> Add Equipment
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <form onSubmit={handleSearch}>
          <div className="search-bar">
            <input
              type="text"
              className="form-input search-input"
              placeholder="Search by ID, name, serial, location, holder..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </div>

          <div className="filter-group">
            <select
              className="form-select"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Checked Out">Checked Out</option>
            </select>

            <select
              className="form-select"
              value={filters.category_id}
              onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
            >
              <option value="">All Categories</option>
              {categories.filter(c => !c.is_consumable).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <select
              className="form-select"
              value={filters.calibration_status}
              onChange={(e) => setFilters({ ...filters, calibration_status: e.target.value })}
            >
              <option value="">All Calibration</option>
              <option value="Calibrated">Calibrated (Valid)</option>
              <option value="Due Soon">Due Soon</option>
              <option value="Expired">Expired</option>
              <option value="Not Calibrated">Not Calibrated</option>
            </select>

            <select
              className="form-select"
              value={filters.channels}
              onChange={(e) => setFilters({ ...filters, channels: e.target.value })}
            >
              <option value="">All Channels</option>
              <option value="1 Channel">1 Channel</option>
              <option value="2 Channel">2 Channel</option>
              <option value="4 Channel">4 Channel</option>
            </select>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setFilters(DEFAULT_EQUIPMENT_FILTERS)}
            >
              Clear Filters
            </button>

            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{equipment.length} item{equipment.length !== 1 ? 's' : ''}</span>
          </div>
        </form>
      </div>

      {/* Equipment Table */}
      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            Loading equipment...
          </div>
        ) : error ? (
          <div className="alert alert-error">
            {error}
            <button className="btn btn-sm btn-secondary" onClick={fetchEquipment} style={{ marginLeft: 'auto' }}>
              Retry
            </button>
          </div>
        ) : equipment.length === 0 ? (
          <div className="empty-state">
            <h3>No equipment found</h3>
            <p>Try adjusting your filters or add new equipment</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="equipment-table">
              <thead>
                <tr>
                  {isManager && (
                    <th style={{ width: '32px' }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={handleToggleSelectAll}
                        aria-label="Select all visible equipment"
                      />
                    </th>
                  )}
                  <th>Equipment ID</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Serial Number</th>
                  <th>Status</th>
                  <th>Calibration</th>
                  <th>Location</th>
                  <th>Holder</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((item) => (
                  <tr key={item.id}>
                    {isManager && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedEquipmentIds.includes(item.id)}
                          onChange={() => handleToggleSelectRow(item.id)}
                          aria-label={`Select ${item.equipment_id}`}
                        />
                      </td>
                    )}
                    <td>
                      <Link to={`/equipment/${item.id}`} style={{ fontWeight: 600 }}>
                        {item.equipment_id}
                      </Link>
                    </td>
                    <td>
                      {item.equipment_name}
                      {(() => {
                        const rule = getCustomFieldRule(item.equipment_name, item.model);
                        if (!rule) return null;
                        const val = getCustomFieldValue(item.custom_fields, rule.field);
                        if (!val) return null;
                        // e.g. "2 Channel" -> "2 Ch"
                        const short = val.replace('Channel', 'Ch').replace('channel', 'Ch');
                        return (
                          <span style={{
                            marginLeft: 7, fontSize: '0.72rem', fontWeight: 600,
                            padding: '1px 6px', borderRadius: 10,
                            background: 'rgba(37,99,235,0.1)', color: '#2563eb',
                            verticalAlign: 'middle', whiteSpace: 'nowrap',
                          }}>
                            {short}
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem' }}>
                        {item.category_name}
                        <br />
                        <span style={{ color: 'var(--text-secondary)' }}>{item.subcategory_name}</span>
                      </span>
                    </td>
                    <td>{item.serial_number || '-'}</td>
                    <td>
                      {getStatusBadge(item)}
                      {item.is_quantity_tracked && (
                        <span style={{ marginLeft: '8px', fontSize: '0.8rem' }}>
                          ({item.available_quantity}/{item.total_quantity})
                        </span>
                      )}
                    </td>
                    <td>{getCalibrationBadge(item)}</td>
                    <td>{item.current_location || '-'}</td>
                    <td>{item.current_holder || '-'}</td>
                    <td>
                      <div className="actions-cell">
                        <Link to={`/equipment/${item.id}`} className="btn btn-sm btn-secondary">
                          View
                        </Link>
                        {item.status === 'Available' && item.is_checkout_allowed && !item.is_consumable && (
                          <Link to={`/check-out?equipment=${item.id}`} className="btn btn-sm btn-primary">
                            Check Out
                          </Link>
                        )}
                        {item.status === 'Checked Out' && !item.is_consumable && (
                          <Link to={`/check-in?equipment=${item.id}`} className="btn btn-sm btn-success">
                            Check In
                          </Link>
                        )}
                        {isManager && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Equipment Modal */}
      {showAddModal && (
        <AddEquipmentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchEquipment();
          }}
        />
      )}

      {/* Recently Deleted Modal */}
      {showDeletedModal && (
        <RecentlyDeletedModal
          onClose={() => setShowDeletedModal(false)}
          onRestored={fetchEquipment}
        />
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <BulkEditModal
          selectedCount={selectedEquipmentIds.length}
          form={bulkEditForm}
          setForm={setBulkEditForm}
          categories={categories}
          subcategories={bulkEditSubcategories}
          onCategoryChange={handleBulkEditCategoryChange}
          submitting={bulkEditSubmitting}
          error={bulkEditError}
          confirming={showBulkEditConfirm}
          onRequestSave={handleRequestBulkEditSave}
          onConfirm={handleConfirmBulkEdit}
          onCancelConfirm={handleCancelBulkEditConfirm}
          onClose={handleCloseBulkEditModal}
        />
      )}

      {/* Import Equipment Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => { setShowImportModal(false); setImportData(null); setImportResults(null); }}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Import Equipment</h2>
              <button className="modal-close" onClick={() => { setShowImportModal(false); setImportData(null); setImportResults(null); }}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflow: 'auto' }}>
              {!importResults && !importData ? (
                <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                  <p style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>
                    Import equipment from an Excel spreadsheet. Download the template first, fill in your data, then select the file to upload.
                  </p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
                      <Icons.Download size={16} /> Download Template
                    </button>
                    <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
                      <Icons.Upload size={16} /> Select File
                    </button>
                  </div>
                </div>
              ) : !importResults ? (
                <>
                  <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: 0 }}>
                      <strong>{importData?.length || 0}</strong> equipment items found in file.
                      Review the preview below, then click Import.
                    </p>
                    <button className="btn btn-sm btn-secondary" onClick={() => { setImportData(null); fileInputRef.current?.click(); }}>
                      <Icons.Upload size={14} /> Choose Different File
                    </button>
                  </div>
                  {importData && importData.length > 0 ? (
                    <div className="table-container">
                      <table className="equipment-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Equipment ID</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Subcategory</th>
                            <th>Manufacturer</th>
                            <th>Serial Number</th>
                            <th>Location</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importData.map((row, i) => (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td>{row.equipment_id}</td>
                              <td>{row.equipment_name}</td>
                              <td>{row.category}</td>
                              <td>{row.subcategory}</td>
                              <td>{row.manufacturer || '-'}</td>
                              <td>{row.serial_number || '-'}</td>
                              <td>{row.location}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="alert alert-warning">
                      No valid rows found. Make sure the file follows the template format and example rows are removed.
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <h3 style={{ marginBottom: '12px' }}>Import Results</h3>
                  {importResults.success.length > 0 && (
                    <div className="alert alert-success" style={{ marginBottom: '12px' }}>
                      <strong>{importResults.success.length}</strong> equipment items imported successfully.
                    </div>
                  )}
                  {importResults.errors.length > 0 && (
                    <div>
                      <div className="alert alert-error" style={{ marginBottom: '8px' }}>
                        <strong>{importResults.errors.length}</strong> items failed to import:
                      </div>
                      <div className="table-container" style={{ maxHeight: '300px', overflow: 'auto' }}>
                        <table className="equipment-table">
                          <thead>
                            <tr>
                              <th>Row</th>
                              <th>Equipment ID</th>
                              <th>Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importResults.errors.map((err, i) => (
                              <tr key={i}>
                                <td>{err.row}</td>
                                <td>{err.equipment_id}</td>
                                <td style={{ color: 'var(--error-color)' }}>{err.error}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              {!importResults && importData ? (
                <>
                  <button className="btn btn-secondary" onClick={() => { setImportData(null); }}>
                    Back
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleImport}
                    disabled={importing || importData.length === 0}
                  >
                    {importing ? 'Importing...' : `Import ${importData.length} Items`}
                  </button>
                </>
              ) : !importResults ? (
                <button className="btn btn-secondary" onClick={() => { setShowImportModal(false); }}>
                  Cancel
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => { setShowImportModal(false); setImportData(null); setImportResults(null); }}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Recently Deleted - lets managers/admins restore equipment deleted within
// the last 30 days.
function RecentlyDeletedModal({ onClose, onRestored }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [restoringId, setRestoringId] = useState(null);

  useEffect(() => {
    fetchDeleted();
    // eslint-disable-next-line
  }, []);

  const fetchDeleted = async () => {
    try {
      setLoading(true);
      const data = await equipmentApi.getDeleted();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (item) => {
    setRestoringId(item.id);
    try {
      await equipmentApi.restore(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      onRestored();
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Recently Deleted Equipment</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflow: 'auto' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Deleted equipment can be restored for 30 days, after which it is no longer recoverable here.
          </p>
          {error && <div className="alert alert-error">{error}</div>}
          {loading ? (
            <div className="loading"><div className="spinner"></div> Loading...</div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <h3>Nothing here</h3>
              <p>No equipment has been deleted in the last 30 days.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Equipment ID</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Deleted By</th>
                    <th>Deleted</th>
                    <th>Days Left</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.equipment_id}</strong></td>
                      <td>{item.equipment_name}</td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {item.category_name}
                        <br />
                        <span style={{ color: 'var(--text-secondary)' }}>{item.subcategory_name}</span>
                      </td>
                      <td>{item.deleted_by || '-'}</td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {new Date(item.deleted_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <span className={`badge ${item.days_remaining <= 5 ? 'badge-overdue' : ''}`}>
                          {item.days_remaining} day{item.days_remaining !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleRestore(item)}
                          disabled={restoringId === item.id}
                        >
                          {restoringId === item.id ? 'Restoring...' : 'Restore'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// Admin/Manager bulk edit for the multi-select equipment feature. Every field
// defaults to "do not change" so selecting many records with differing
// values never risks accidentally overwriting them. Category/Subcategory are
// linked: changing Category always forces an explicit Subcategory choice
// (either a valid subcategory or an explicit clear), matching the existing
// single-record "Classification" edit rule in EquipmentDetail.js.
function BulkEditModal({
  selectedCount,
  form,
  setForm,
  categories,
  subcategories,
  onCategoryChange,
  submitting,
  error,
  confirming,
  onRequestSave,
  onConfirm,
  onCancelConfirm,
  onClose,
}) {
  const setField = (field, updates) => {
    setForm(prev => ({ ...prev, [field]: { ...prev[field], ...updates } }));
  };

  const handleCategorySelect = (value) => {
    if (!value) {
      setForm(prev => ({
        ...prev,
        category_id: { action: 'unchanged', value: '' },
        subcategory_id: { action: 'unchanged', value: '' },
      }));
    } else {
      setForm(prev => ({
        ...prev,
        category_id: { action: 'set', value },
        subcategory_id: { action: 'unchanged', value: '' },
      }));
      onCategoryChange(value);
    }
  };

  const handleSubcategorySelect = (value) => {
    if (value === '__clear__') {
      setField('subcategory_id', { action: 'clear', value: '' });
    } else if (!value) {
      setField('subcategory_id', { action: 'unchanged', value: '' });
    } else {
      setField('subcategory_id', { action: 'set', value });
    }
  };

  if (confirming) {
    const changes = describeBulkEditChanges(form, categories, subcategories);
    return (
      <div className="modal-overlay" onClick={onCancelConfirm}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">Confirm Bulk Update</h2>
            <button className="modal-close" onClick={onCancelConfirm}>×</button>
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            <p>
              You are about to update <strong>{selectedCount}</strong> equipment record{selectedCount !== 1 ? 's' : ''}.
            </p>
            <p style={{ marginTop: '8px', marginBottom: '4px' }}><strong>Fields being changed:</strong></p>
            <ul>
              {changes.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onCancelConfirm} disabled={submitting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={onConfirm} disabled={submitting}>
              {submitting ? 'Updating...' : `Update ${selectedCount} Record${selectedCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Bulk Edit Equipment</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p>{selectedCount} equipment record{selectedCount !== 1 ? 's' : ''} selected</p>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">
              <input
                type="checkbox"
                checked={form.equipment_name.enabled}
                onChange={(e) => setField('equipment_name', { enabled: e.target.checked })}
              />
              {' '}Update Equipment Name
            </label>
            {form.equipment_name.enabled && (
              <input
                className="form-input"
                value={form.equipment_name.value}
                onChange={(e) => setField('equipment_name', { value: e.target.value })}
                placeholder="Equipment Name"
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <select
              className="form-select"
              value={form.description.action}
              onChange={(e) => setField('description', { action: e.target.value })}
            >
              <option value="unchanged">Do not change</option>
              <option value="set">Set value</option>
              <option value="clear">Clear description</option>
            </select>
            {form.description.action === 'set' && (
              <textarea
                className="form-input"
                rows={3}
                value={form.description.value}
                onChange={(e) => setField('description', { value: e.target.value })}
                placeholder="Description"
                style={{ marginTop: '6px' }}
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={form.category_id.action === 'set' ? form.category_id.value : ''}
              onChange={(e) => handleCategorySelect(e.target.value)}
            >
              <option value="">Do not change</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {form.category_id.action === 'set' && (
            <div className="form-group">
              <label className="form-label">Subcategory</label>
              <select
                className="form-select"
                value={
                  form.subcategory_id.action === 'set' ? form.subcategory_id.value
                    : form.subcategory_id.action === 'clear' ? '__clear__' : ''
                }
                onChange={(e) => handleSubcategorySelect(e.target.value)}
              >
                <option value="">Select a subcategory...</option>
                {subcategories.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
                <option value="__clear__">Clear Subcategory</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              <input
                type="checkbox"
                checked={form.manufacturer.enabled}
                onChange={(e) => setField('manufacturer', { enabled: e.target.checked })}
              />
              {' '}Update Manufacturer
            </label>
            {form.manufacturer.enabled && (
              <input
                className="form-input"
                value={form.manufacturer.value}
                onChange={(e) => setField('manufacturer', { value: e.target.value })}
                placeholder="Manufacturer"
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">
              <input
                type="checkbox"
                checked={form.model.enabled}
                onChange={(e) => setField('model', { enabled: e.target.checked })}
              />
              {' '}Update Model
            </label>
            {form.model.enabled && (
              <input
                className="form-input"
                value={form.model.value}
                onChange={(e) => setField('model', { value: e.target.value })}
                placeholder="Model"
              />
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onRequestSave} disabled={!hasAnyBulkEditChange(form)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default Equipment;
