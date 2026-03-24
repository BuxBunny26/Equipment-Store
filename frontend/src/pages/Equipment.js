import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { equipmentApi, categoriesApi, calibrationApi } from '../services/api';
import { exportData, EXPORT_COLUMNS } from '../services/exportUtils';
import { Icons } from '../components/Icons';
import AddEquipmentModal from '../components/AddEquipmentModal';

function Equipment() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    category_id: '',
    is_consumable: 'false',
    calibration_status: '',
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchEquipment();
  }, [filters.status, filters.category_id, filters.is_consumable, filters.calibration_status]);

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
      if (filters.search) params.search = filters.search;

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

      // Apply calibration filter client-side
      if (filters.calibration_status) {
        if (filters.calibration_status === 'Not Calibrated') {
          items = items.filter(e => e.calibration_status === 'N/A');
        } else if (filters.calibration_status === 'Calibrated') {
          items = items.filter(e => e.calibration_status === 'Valid');
        } else {
          items = items.filter(e => e.calibration_status === filters.calibration_status);
        }
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Equipment</h1>
          <p className="page-subtitle">Manage equipment inventory</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-secondary" onClick={() => exportData('csv', equipment, EXPORT_COLUMNS.equipment, 'equipment', 'Equipment List')} disabled={equipment.length === 0}>
            <Icons.Download size={16} /> CSV
          </button>
          <button className="btn btn-secondary" onClick={() => exportData('excel', equipment, EXPORT_COLUMNS.equipment, 'equipment', 'Equipment List')} disabled={equipment.length === 0}>
            <Icons.Download size={16} /> Excel
          </button>
          <button className="btn btn-secondary" onClick={() => exportData('pdf', equipment, EXPORT_COLUMNS.equipment, 'equipment', 'Equipment List')} disabled={equipment.length === 0}>
            <Icons.Download size={16} /> PDF
          </button>
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
            + Add Equipment
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
              placeholder="Search by ID, name, or serial number..."
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

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setFilters({ search: '', status: '', category_id: '', is_consumable: 'false', calibration_status: '' })}
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
                    <td>
                      <Link to={`/equipment/${item.id}`} style={{ fontWeight: 600 }}>
                        {item.equipment_id}
                      </Link>
                    </td>
                    <td>{item.equipment_name}</td>
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

export default Equipment;
