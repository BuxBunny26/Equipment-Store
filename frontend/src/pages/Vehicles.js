import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { vehiclesApi, vehicleCheckoutsApi, vehicleFinesApi, vehicleServicesApi, personnelApi } from '../services/api';
import * as XLSX from 'xlsx';
import { useOperator } from '../context/OperatorContext';
import { Icons } from '../components/Icons';
import { getAssetConfig } from './Settings';
import { exportData } from '../services/exportUtils';
import ExportMenu from '../components/ExportMenu';

const VEHICLE_STATUSES = [
  { value: 'Active', label: 'Active', badge: 'badge-available' },
  { value: 'In Use', label: 'In Use', badge: 'badge-checked-out' },
  { value: 'In Service', label: 'In Service', badge: 'badge-low-stock' },
  { value: 'Repairs', label: 'Repairs', badge: 'badge-low-stock' },
  { value: 'Decommissioned', label: 'Decommissioned', badge: 'badge-overdue' },
  { value: 'Sold', label: 'Sold', badge: 'badge-overdue' },
  { value: 'Written Off', label: 'Written Off', badge: 'badge-overdue' },
];

const CONDITION_OPTIONS = ['Excellent', 'Good', 'Average', 'Poor'];
const CHECK_OPTIONS = ['Yes', 'No', 'Good', 'Average', 'Damaged', 'Missing', 'Expired', 'N/A'];

function Vehicles() {
  const { operatorRole } = useOperator();
  const isAdminOrManager = operatorRole && ['admin', 'manager'].includes(operatorRole.toLowerCase());

  const [activeTab, setActiveTab] = useState('fleet');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fleet data
  const [vehicles, setVehicles] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Checkouts data
  const [checkouts, setCheckouts] = useState([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [editCheckout, setEditCheckout] = useState(null);
  const [showReturned, setShowReturned] = useState(false);
  const [checkoutSearch, setCheckoutSearch] = useState('');
  const [checkoutDateFrom, setCheckoutDateFrom] = useState('');
  const [checkoutDateTo, setCheckoutDateTo] = useState('');
  const [checkoutVehicleFilter, setCheckoutVehicleFilter] = useState('');

  // Fines data
  const [fines, setFines] = useState([]);
  const [showFineModal, setShowFineModal] = useState(false);
  const [editFine, setEditFine] = useState(null);
  const [fineSearch, setFineSearch] = useState('');
  const [fineStatusFilter, setFineStatusFilter] = useState('');
  const [fineVehicleFilter, setFineVehicleFilter] = useState('');

  // Services data
  const [services, setServices] = useState([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editService, setEditService] = useState(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [serviceVehicleFilter, setServiceVehicleFilter] = useState('');

  // Return modal
  const [returnCheckout, setReturnCheckout] = useState(null);

  // Detail view
  const [detailVehicle, setDetailVehicle] = useState(null);

  // Sorting
  const [sortCol, setSortCol] = useState('make');
  const [sortDir, setSortDir] = useState('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Column visibility
  const [hiddenColumns, setHiddenColumns] = useState(new Set());
  const [showColumnToggle, setShowColumnToggle] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);

  // Import
  const [showImportModal, setShowImportModal] = useState(false);

  // Analytics
  const [showFleetChart, setShowFleetChart] = useState(false);
  const [showCostSummary, setShowCostSummary] = useState(false);

  // Make filter
  const [makeFilter, setMakeFilter] = useState('');
  const [fuelFilter, setFuelFilter] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeTab, showReturned]); // eslint-disable-line

  const fetchData = async () => {
    try {
      setLoading(true);
      const [vehiclesRes, personnelRes, checkoutsRes, finesRes, servicesRes] = await Promise.all([
        vehiclesApi.getAll(false),
        personnelApi.getAll(true),
        (showReturned ? vehicleCheckoutsApi.getAllIncludingReturned() : vehicleCheckoutsApi.getAll()),
        vehicleFinesApi.getAll(),
        vehicleServicesApi.getAll(),
      ]);
      setVehicles(vehiclesRes.data || []);
      setPersonnel(personnelRes.data || []);
      setCheckouts(checkoutsRes.data || []);
      setFines(finesRes.data || []);
      setServices(servicesRes.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Fleet Handlers ----------
  const handleDeleteVehicle = async (v) => {
    if (!window.confirm(`Delete vehicle ${v.make} ${v.model} (${v.registration_number})?`)) return;
    try {
      await vehiclesApi.delete(v.id);
      fetchData();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ---------- Checkout Handlers ----------
  const handleReturnVehicle = async (returnData) => {
    if (!returnCheckout) return;
    try {
      await vehicleCheckoutsApi.returnVehicle(returnCheckout.id, returnData);
      setReturnCheckout(null);
      fetchData();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleDeleteCheckout = async (c) => {
    if (!window.confirm('Delete this checkout record?')) return;
    try {
      await vehicleCheckoutsApi.delete(c.id);
      fetchData();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ---------- Fine Handlers ----------
  const handleDeleteFine = async (f) => {
    if (!window.confirm('Delete this fine record?')) return;
    try {
      await vehicleFinesApi.delete(f.id);
      fetchData();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ---------- Service Handlers ----------
  const handleDeleteService = async (s) => {
    if (!window.confirm('Delete this service record?')) return;
    try {
      await vehicleServicesApi.delete(s.id);
      fetchData();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ---------- Filtering ----------
  const filteredVehicles = vehicles.filter(v => {
    if (statusFilter && v.vehicle_status !== statusFilter) return false;
    if (makeFilter && v.make !== makeFilter) return false;
    if (fuelFilter && v.fuel_type !== fuelFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      v.make?.toLowerCase().includes(term) ||
      v.model?.toLowerCase().includes(term) ||
      v.registration_number?.toLowerCase().includes(term) ||
      v.vin_number?.toLowerCase().includes(term) ||
      v.assigned_to?.toLowerCase().includes(term) ||
      v.fuel_type?.toLowerCase().includes(term)
    );
  });

  const filteredCheckouts = checkouts.filter(c => {
    if (checkoutVehicleFilter && String(c.vehicle_id) !== checkoutVehicleFilter) return false;
    if (checkoutDateFrom && c.checkout_date && c.checkout_date.split('T')[0] < checkoutDateFrom) return false;
    if (checkoutDateTo && c.checkout_date && c.checkout_date.split('T')[0] > checkoutDateTo) return false;
    if (!checkoutSearch) return true;
    const term = checkoutSearch.toLowerCase();
    return (
      c.driver_name?.toLowerCase().includes(term) ||
      c.vehicles?.registration_number?.toLowerCase().includes(term) ||
      c.vehicles?.make?.toLowerCase().includes(term) ||
      c.destination?.toLowerCase().includes(term)
    );
  });

  const filteredFines = fines.filter(f => {
    if (fineStatusFilter && f.status !== fineStatusFilter) return false;
    if (fineVehicleFilter && String(f.vehicle_id) !== fineVehicleFilter) return false;
    if (!fineSearch) return true;
    const term = fineSearch.toLowerCase();
    return (
      f.driver_name?.toLowerCase().includes(term) ||
      f.vehicles?.registration_number?.toLowerCase().includes(term) ||
      f.fine_type?.toLowerCase().includes(term) ||
      f.fine_reference?.toLowerCase().includes(term)
    );
  });

  const filteredServices = services.filter(s => {
    if (serviceTypeFilter && s.service_type !== serviceTypeFilter) return false;
    if (serviceVehicleFilter && String(s.vehicle_id) !== serviceVehicleFilter) return false;
    if (!serviceSearch) return true;
    const term = serviceSearch.toLowerCase();
    return (
      s.vehicles?.registration_number?.toLowerCase().includes(term) ||
      s.vehicles?.make?.toLowerCase().includes(term) ||
      s.service_provider?.toLowerCase().includes(term) ||
      s.description?.toLowerCase().includes(term)
    );
  });

  // ---------- Sorting ----------
  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedFiltered = useMemo(() => {
    const sorted = [...filteredVehicles];
    sorted.sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (av == null) av = '';
      if (bv == null) bv = '';
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return sorted;
  }, [filteredVehicles, sortCol, sortDir]);

  // ---------- Pagination ----------
  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedFiltered.slice(start, start + pageSize);
  }, [sortedFiltered, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, makeFilter, fuelFilter]);

  // ---------- Bulk Selection ----------
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === paginatedData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedData.map(r => r.id)));
    }
  }, [paginatedData, selectedIds]);

  // ---------- Column Visibility ----------
  const FLEET_COLUMNS = [
    { key: 'vehicle', label: 'Vehicle' },
    { key: 'registration', label: 'Registration' },
    { key: 'fuel', label: 'Fuel' },
    { key: 'assigned_to', label: 'Assigned To' },
    { key: 'odometer', label: 'Odometer' },
    { key: 'license_disk', label: 'License Disk' },
    { key: 'next_service', label: 'Next Service' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
  ];
  const isColVisible = (key) => !hiddenColumns.has(key);
  const toggleColumn = (key) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ---------- Analytics ----------
  const makes = useMemo(() => [...new Set(vehicles.map(v => v.make).filter(Boolean))].sort(), [vehicles]);
  const fuelTypes = useMemo(() => [...new Set(vehicles.map(v => v.fuel_type).filter(Boolean))].sort(), [vehicles]);

  const statusBreakdown = useMemo(() => {
    const counts = {};
    vehicles.forEach(v => {
      const s = v.vehicle_status || 'Unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [vehicles]);

  const makeBreakdown = useMemo(() => {
    const counts = {};
    vehicles.filter(v => v.is_active).forEach(v => {
      const m = v.make || 'Unknown';
      counts[m] = (counts[m] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [vehicles]);

  const fuelBreakdown = useMemo(() => {
    const counts = {};
    vehicles.filter(v => v.is_active).forEach(v => {
      const f = v.fuel_type || 'Unknown';
      counts[f] = (counts[f] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [vehicles]);

  const costSummaryData = useMemo(() => {
    const totalFines = fines.reduce((sum, f) => sum + (parseFloat(f.fine_amount) || 0), 0);
    const unpaidFines = fines.filter(f => f.status === 'Unpaid').reduce((sum, f) => sum + (parseFloat(f.fine_amount) || 0), 0);
    const totalServiceCost = services.reduce((sum, s) => sum + (parseFloat(s.cost) || 0), 0);
    const vehicleCosts = {};
    fines.forEach(f => {
      const key = f.vehicles?.registration_number || 'Unknown';
      if (!vehicleCosts[key]) vehicleCosts[key] = { fines: 0, services: 0, make: f.vehicles?.make, model: f.vehicles?.model };
      vehicleCosts[key].fines += (parseFloat(f.fine_amount) || 0);
    });
    services.forEach(s => {
      const key = s.vehicles?.registration_number || 'Unknown';
      if (!vehicleCosts[key]) vehicleCosts[key] = { fines: 0, services: 0, make: s.vehicles?.make, model: s.vehicles?.model };
      vehicleCosts[key].services += (parseFloat(s.cost) || 0);
    });
    return { totalFines, unpaidFines, totalServiceCost, vehicleCosts };
  }, [fines, services]);

  // ---------- Export ----------
  const handleExport = (format) => {
    const exportColumns = [
      { label: 'Make', accessor: 'make' },
      { label: 'Model', accessor: 'model' },
      { label: 'Year', accessor: 'year' },
      { label: 'Registration', accessor: 'registration_number' },
      { label: 'Color', accessor: 'color' },
      { label: 'Fuel Type', accessor: 'fuel_type' },
      { label: 'VIN', accessor: 'vin_number' },
      { label: 'QR Code', accessor: 'qr_code' },
      { label: 'Assigned To', accessor: 'assigned_to' },
      { label: 'Status', accessor: 'vehicle_status' },
      { label: 'Odometer (km)', accessor: 'current_odometer' },
      { label: 'License Disk Expiry', accessor: r => r.license_disk_expiry ? new Date(r.license_disk_expiry).toLocaleDateString() : '' },
      { label: 'Registration Expiry', accessor: r => r.registration_expiry ? new Date(r.registration_expiry).toLocaleDateString() : '' },
      { label: 'Next Service Date', accessor: r => r.next_service_date ? new Date(r.next_service_date).toLocaleDateString() : '' },
      { label: 'Next Service Odometer', accessor: 'next_service_odometer' },
      { label: 'Active', accessor: r => r.is_active ? 'Yes' : 'No' },
      { label: 'Notes', accessor: 'notes' },
    ];
    exportData(format, sortedFiltered, exportColumns, 'vehicle_fleet', 'Vehicle Fleet Report');
  };

  const handleExportCheckouts = (format) => {
    const exportColumns = [
      { label: 'Vehicle', accessor: r => `${r.vehicles?.make || ''} ${r.vehicles?.model || ''}`.trim() },
      { label: 'Registration', accessor: r => r.vehicles?.registration_number || '' },
      { label: 'Driver', accessor: 'driver_name' },
      { label: 'Supervisor', accessor: 'supervisor' },
      { label: 'Date', accessor: r => r.checkout_date ? new Date(r.checkout_date).toLocaleDateString() : '' },
      { label: 'Destination', accessor: 'destination' },
      { label: 'Reason', accessor: 'reason_for_use' },
      { label: 'Start Odometer', accessor: 'start_odometer' },
      { label: 'End Odometer', accessor: 'end_odometer' },
      { label: 'Distance (km)', accessor: r => r.end_odometer && r.start_odometer ? r.end_odometer - r.start_odometer : '' },
      { label: 'Condition', accessor: 'vehicle_condition' },
      { label: 'Status', accessor: r => r.is_returned ? (r.handed_over_to ? 'Handed Over' : 'Returned') : 'Out' },
      { label: 'Return Location', accessor: 'return_location' },
    ];
    exportData(format, filteredCheckouts, exportColumns, 'vehicle_checkouts', 'Vehicle Checkouts Report');
  };

  const handleExportFines = (format) => {
    const exportColumns = [
      { label: 'Vehicle', accessor: r => `${r.vehicles?.make || ''} ${r.vehicles?.model || ''}`.trim() },
      { label: 'Registration', accessor: r => r.vehicles?.registration_number || '' },
      { label: 'Driver', accessor: 'driver_name' },
      { label: 'Date', accessor: r => r.fine_date ? new Date(r.fine_date).toLocaleDateString() : '' },
      { label: 'Type', accessor: 'fine_type' },
      { label: 'Amount (R)', accessor: r => r.fine_amount ? parseFloat(r.fine_amount).toFixed(2) : '' },
      { label: 'Reference', accessor: 'fine_reference' },
      { label: 'Status', accessor: 'status' },
      { label: 'Description', accessor: 'description' },
    ];
    exportData(format, filteredFines, exportColumns, 'vehicle_fines', 'Vehicle Fines Report');
  };

  const handleExportServices = (format) => {
    const exportColumns = [
      { label: 'Vehicle', accessor: r => `${r.vehicles?.make || ''} ${r.vehicles?.model || ''}`.trim() },
      { label: 'Registration', accessor: r => r.vehicles?.registration_number || '' },
      { label: 'Type', accessor: 'service_type' },
      { label: 'Date', accessor: r => r.service_date ? new Date(r.service_date).toLocaleDateString() : '' },
      { label: 'Odometer', accessor: 'odometer_at_service' },
      { label: 'Provider', accessor: 'service_provider' },
      { label: 'Cost (R)', accessor: r => r.cost ? parseFloat(r.cost).toFixed(2) : '' },
      { label: 'Next Service Date', accessor: r => r.next_service_date ? new Date(r.next_service_date).toLocaleDateString() : '' },
      { label: 'Description', accessor: 'description' },
      { label: 'Status', accessor: 'status' },
    ];
    exportData(format, filteredServices, exportColumns, 'vehicle_services', 'Vehicle Services Report');
  };

  // ---------- Print ----------
  const handlePrint = () => {
    const rows = sortedFiltered.map(v => ({
      vehicle: `${v.make} ${v.model}`,
      reg: v.registration_number || '',
      year: v.year || '',
      fuel: v.fuel_type || '',
      assigned: v.assigned_to || '',
      odometer: v.current_odometer ? v.current_odometer.toLocaleString() + ' km' : '-',
      license: v.license_disk_expiry ? new Date(v.license_disk_expiry).toLocaleDateString() : '-',
      service: v.next_service_date ? new Date(v.next_service_date).toLocaleDateString() : '-',
      status: v.vehicle_status || '',
    }));
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Vehicle Fleet Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .subtitle { font-size: 12px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #333; color: white; padding: 6px 8px; text-align: left; }
        td { padding: 5px 8px; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) { background: #f9f9f9; }
        .footer { margin-top: 16px; font-size: 10px; color: #999; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Vehicle Fleet Report</h1>
      <div class="subtitle">Generated: ${new Date().toLocaleDateString()} | Records: ${rows.length}</div>
      <table>
        <thead><tr>
          <th>Vehicle</th><th>Registration</th><th>Year</th><th>Fuel</th><th>Assigned To</th><th>Odometer</th><th>License Expiry</th><th>Next Service</th><th>Status</th>
        </tr></thead>
        <tbody>${rows.map(r => `
          <tr><td>${r.vehicle}</td><td style="font-family:monospace">${r.reg}</td><td>${r.year}</td><td>${r.fuel}</td><td>${r.assigned}</td><td>${r.odometer}</td><td>${r.license}</td><td>${r.service}</td><td>${r.status}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="footer">Equipment Store - Vehicle Fleet</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const SortHeader = ({ col, label }) => (
    <th onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {label} {sortCol === col ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : <span style={{ opacity: 0.3 }}>{'\u25B2'}</span>}
    </th>
  );

  // ---------- Alerts ----------
  const licenseDiskAlerts = vehicles.filter(v => {
    if (!v.license_disk_expiry || !v.is_active) return false;
    const expiry = new Date(v.license_disk_expiry);
    const daysUntil = (expiry - new Date()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 30;
  });

  const serviceAlerts = vehicles.filter(v => {
    if (!v.next_service_date || !v.is_active) return false;
    const svcDate = new Date(v.next_service_date);
    const daysUntil = (svcDate - new Date()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 30;
  });

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading vehicles...
      </div>
    );
  }

  const tabs = [
    { key: 'fleet', label: 'Fleet', count: vehicles.filter(v => v.is_active).length },
    { key: 'checkouts', label: 'Checkouts', count: checkouts.filter(c => !c.is_returned).length },
    { key: 'fines', label: 'Fines', count: fines.length },
    { key: 'services', label: 'Services', count: services.length },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Vehicles</h1>
          <p className="page-subtitle">Manage company vehicles, checkouts, fines, and services</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {activeTab === 'fleet' && (
            <>
              <ExportMenu onExport={handleExport} onPrint={handlePrint} />
              {isAdminOrManager && (
                <button className="btn btn-secondary" onClick={() => setShowImportModal(true)} title="Bulk Import">
                  <Icons.Upload size={14} /> Import
                </button>
              )}
              {isAdminOrManager && selectedIds.size > 0 && (
                <button className="btn btn-secondary" onClick={() => setShowBulkStatusModal(true)} title="Bulk Status Update" style={{ borderColor: 'var(--primary-color)' }}>
                  <Icons.Check size={14} /> Update {selectedIds.size} selected
                </button>
              )}
            </>
          )}
          {activeTab === 'checkouts' && (
            <ExportMenu onExport={handleExportCheckouts} formats={['csv', 'excel']} />
          )}
          {activeTab === 'fines' && (
            <ExportMenu onExport={handleExportFines} formats={['csv', 'excel']} />
          )}
          {activeTab === 'services' && (
            <ExportMenu onExport={handleExportServices} formats={['csv', 'excel']} />
          )}
          {isAdminOrManager && activeTab === 'fleet' && (
            <button className="btn btn-primary" onClick={() => { setEditVehicle(null); setShowVehicleModal(true); }}>
              + Add Vehicle
            </button>
          )}
          {activeTab === 'checkouts' && (
            <button className="btn btn-primary" onClick={() => { setEditCheckout(null); setShowCheckoutModal(true); }}>
              + Vehicle Checkout
            </button>
          )}
          {isAdminOrManager && activeTab === 'fines' && (
            <button className="btn btn-primary" onClick={() => { setEditFine(null); setShowFineModal(true); }}>
              + Record Fine
            </button>
          )}
          {isAdminOrManager && activeTab === 'services' && (
            <button className="btn btn-primary" onClick={() => { setEditService(null); setShowServiceModal(true); }}>
              + Record Service
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button className="btn btn-sm btn-secondary" onClick={fetchData} style={{ marginLeft: 'auto' }}>Retry</button>
        </div>
      )}

      {/* Alerts */}
      {(licenseDiskAlerts.length > 0 || serviceAlerts.length > 0) && (
        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {licenseDiskAlerts.map(v => (
            <div key={`lic-${v.id}`} className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icons.Warning size={16} />
              <span><strong>{v.registration_number}</strong> — License disk {new Date(v.license_disk_expiry) < new Date() ? 'EXPIRED' : 'expiring soon'}: {new Date(v.license_disk_expiry).toLocaleDateString()}</span>
            </div>
          ))}
          {serviceAlerts.map(v => (
            <div key={`svc-${v.id}`} className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(243, 156, 18, 0.1)', borderColor: '#f39c12', color: '#f39c12' }}>
              <Icons.Wrench size={16} />
              <span><strong>{v.registration_number}</strong> — Service {new Date(v.next_service_date) < new Date() ? 'OVERDUE' : 'due soon'}: {new Date(v.next_service_date).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '2px solid var(--border-color)', paddingBottom: '0' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '3px solid var(--primary-color)' : '3px solid transparent',
              background: activeTab === tab.key ? 'var(--bg-secondary)' : 'transparent',
              color: activeTab === tab.key ? 'var(--primary-color)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              borderRadius: '6px 6px 0 0',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                marginLeft: '6px',
                background: activeTab === tab.key ? 'var(--primary-color)' : 'var(--text-secondary)',
                color: '#fff',
                borderRadius: '10px',
                padding: '1px 8px',
                fontSize: '0.75rem',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Fleet Tab */}
      {activeTab === 'fleet' && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--success-color)' }}>
                {vehicles.filter(v => v.vehicle_status === 'Active').length}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Available</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                {vehicles.filter(v => v.vehicle_status === 'In Use').length}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>In Use</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f39c12' }}>
                {vehicles.filter(v => ['In Service', 'Repairs'].includes(v.vehicle_status)).length}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Service / Repairs</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--error-color)' }}>
                {licenseDiskAlerts.length}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>License Alerts</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {vehicles.length}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total</div>
            </div>
          </div>

          {/* Filters */}
          <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by make, model, registration, VIN..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ flex: 1, minWidth: '200px' }}
              />
              <select
                className="form-input"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ minWidth: '150px' }}
              >
                <option value="">All Statuses</option>
                {VEHICLE_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <select
                className="form-input"
                value={makeFilter}
                onChange={e => setMakeFilter(e.target.value)}
                style={{ minWidth: '130px' }}
              >
                <option value="">All Makes</option>
                {makes.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                className="form-input"
                value={fuelFilter}
                onChange={e => setFuelFilter(e.target.value)}
                style={{ minWidth: '130px' }}
              >
                <option value="">All Fuel Types</option>
                {fuelTypes.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '10px' }}>
              <button className={`btn btn-sm ${showFleetChart ? '' : 'btn-secondary'}`}
                style={showFleetChart ? { background: 'var(--primary-color)', color: 'white' } : undefined}
                onClick={() => { setShowFleetChart(!showFleetChart); setShowCostSummary(false); }}>
                <Icons.BarChart size={14} /> Fleet Analytics
              </button>
              <button className={`btn btn-sm ${showCostSummary ? '' : 'btn-secondary'}`}
                style={showCostSummary ? { background: 'var(--primary-color)', color: 'white' } : undefined}
                onClick={() => { setShowCostSummary(!showCostSummary); setShowFleetChart(false); }}>
                Cost Summary
              </button>
              <div style={{ position: 'relative', marginLeft: 'auto' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => setShowColumnToggle(!showColumnToggle)}>
                  <Icons.Eye size={14} /> Columns
                </button>
                {showColumnToggle && (
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: 'var(--bg-primary, white)',
                    border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', zIndex: 100, minWidth: '180px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    {FLEET_COLUMNS.map(col => (
                      <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input type="checkbox" checked={isColVisible(col.key)} onChange={() => toggleColumn(col.key)} />
                        {col.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <select className="form-input" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={{ width: '80px' }}>
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{sortedFiltered.length} vehicle{sortedFiltered.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Fleet Analytics */}
          {showFleetChart && (
            <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '1rem' }}>Fleet Analytics</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                {/* Status Distribution */}
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Status Distribution</h4>
                  {statusBreakdown.map(([status, count]) => {
                    const pct = vehicles.length > 0 ? (count / vehicles.length * 100) : 0;
                    const st = VEHICLE_STATUSES.find(s => s.value === status);
                    const color = st ? (st.badge === 'badge-available' ? 'var(--success-color)' : st.badge === 'badge-checked-out' ? 'var(--primary-color)' : st.badge === 'badge-low-stock' ? '#f39c12' : 'var(--error-color)') : '#999';
                    return (
                      <div key={status} style={{ marginBottom: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '2px' }}>
                          <span>{status}</span><span style={{ fontWeight: 600 }}>{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--bg-secondary, #eee)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '4px', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Make Distribution */}
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Make Distribution (Active)</h4>
                  {makeBreakdown.map(([make, count], i) => {
                    const activeCount = vehicles.filter(v => v.is_active).length;
                    const pct = activeCount > 0 ? (count / activeCount * 100) : 0;
                    const colors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
                    return (
                      <div key={make} style={{ marginBottom: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '2px' }}>
                          <span>{make}</span><span style={{ fontWeight: 600 }}>{count}</span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--bg-secondary, #eee)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: colors[i % colors.length], borderRadius: '4px', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Fuel Type Distribution */}
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Fuel Type (Active)</h4>
                  {fuelBreakdown.map(([fuel, count], i) => {
                    const activeCount = vehicles.filter(v => v.is_active).length;
                    const pct = activeCount > 0 ? (count / activeCount * 100) : 0;
                    const colors = ['#2ecc71', '#3498db', '#e67e22', '#9b59b6', '#e74c3c'];
                    return (
                      <div key={fuel} style={{ marginBottom: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '2px' }}>
                          <span>{fuel}</span><span style={{ fontWeight: 600 }}>{count}</span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--bg-secondary, #eee)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: colors[i % colors.length], borderRadius: '4px', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Cost Summary */}
          {showCostSummary && (
            <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '1rem' }}>Cost Summary</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--error-color)' }}>R {costSummaryData.totalFines.toFixed(2)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Fines</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e67e22' }}>R {costSummaryData.unpaidFines.toFixed(2)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Unpaid Fines</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary-color)' }}>R {costSummaryData.totalServiceCost.toFixed(2)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Service Costs</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>R {(costSummaryData.totalFines + costSummaryData.totalServiceCost).toFixed(2)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Grand Total</div>
                </div>
              </div>
              {Object.keys(costSummaryData.vehicleCosts).length > 0 && (
                <>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Cost per Vehicle</h4>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Vehicle</th>
                          <th>Fines (R)</th>
                          <th>Services (R)</th>
                          <th>Total (R)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(costSummaryData.vehicleCosts)
                          .sort((a, b) => (b[1].fines + b[1].services) - (a[1].fines + a[1].services))
                          .map(([reg, data]) => (
                            <tr key={reg}>
                              <td><strong>{reg}</strong>{data.make ? <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{data.make} {data.model}</div> : null}</td>
                              <td style={{ color: data.fines > 0 ? 'var(--error-color)' : 'inherit' }}>{data.fines.toFixed(2)}</td>
                              <td>{data.services.toFixed(2)}</td>
                              <td style={{ fontWeight: 600 }}>{(data.fines + data.services).toFixed(2)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Fleet Table */}
          <div className="card">
            {sortedFiltered.length === 0 ? (
              <div className="empty-state">
                <h3>No vehicles found</h3>
                <p>{searchTerm ? 'Try a different search term' : 'Click "Add Vehicle" to register the first vehicle'}</p>
              </div>
            ) : (
              <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      {isAdminOrManager && <th style={{ width: '32px' }}><input type="checkbox" checked={selectedIds.size === paginatedData.length && paginatedData.length > 0} onChange={toggleSelectAll} /></th>}
                      {isColVisible('vehicle') && <SortHeader col="make" label="Vehicle" />}
                      {isColVisible('registration') && <SortHeader col="registration_number" label="Registration" />}
                      {isColVisible('fuel') && <SortHeader col="fuel_type" label="Fuel" />}
                      {isColVisible('assigned_to') && <SortHeader col="assigned_to" label="Assigned To" />}
                      {isColVisible('odometer') && <SortHeader col="current_odometer" label="Odometer" />}
                      {isColVisible('license_disk') && <SortHeader col="license_disk_expiry" label="License Disk Expiry" />}
                      {isColVisible('next_service') && <SortHeader col="next_service_date" label="Next Service" />}
                      {isColVisible('status') && <SortHeader col="vehicle_status" label="Status" />}
                      {isColVisible('actions') && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map(v => {
                      const licenseExpired = v.license_disk_expiry && new Date(v.license_disk_expiry) < new Date();
                      const licenseSoon = v.license_disk_expiry && !licenseExpired && (new Date(v.license_disk_expiry) - new Date()) / (1000*60*60*24) <= 30;
                      const serviceDue = v.next_service_date && (new Date(v.next_service_date) - new Date()) / (1000*60*60*24) <= 30;
                      return (
                        <tr key={v.id} style={selectedIds.has(v.id) ? { background: 'rgba(52,152,219,0.08)' } : undefined}>
                          {isAdminOrManager && <td><input type="checkbox" checked={selectedIds.has(v.id)} onChange={() => toggleSelect(v.id)} /></td>}
                          {isColVisible('vehicle') && (
                            <td>
                              <div>
                                <strong>{v.make} {v.model}</strong>
                                {v.year && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{v.year}{v.color ? ` - ${v.color}` : ''}</div>}
                                {v.vin_number && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>VIN: {v.vin_number}</div>}
                                {v.qr_code && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>QR: {v.qr_code}</div>}
                              </div>
                            </td>
                          )}
                          {isColVisible('registration') && <td><strong style={{ fontFamily: 'monospace' }}>{v.registration_number}</strong></td>}
                          {isColVisible('fuel') && <td>{v.fuel_type || '-'}</td>}
                          {isColVisible('assigned_to') && <td>{v.assigned_to || '-'}</td>}
                          {isColVisible('odometer') && <td>{v.current_odometer ? v.current_odometer.toLocaleString() + ' km' : '-'}</td>}
                          {isColVisible('license_disk') && (
                            <td>
                              {v.license_disk_expiry ? (
                                <span style={{ color: licenseExpired ? 'var(--error-color)' : licenseSoon ? '#f39c12' : 'inherit', fontWeight: licenseExpired || licenseSoon ? 600 : 400 }}>
                                  {new Date(v.license_disk_expiry).toLocaleDateString()}
                                  {licenseExpired && ' EXPIRED'}
                                  {licenseSoon && ' Soon'}
                                </span>
                              ) : '-'}
                            </td>
                          )}
                          {isColVisible('next_service') && (
                            <td>
                              {v.next_service_date ? (
                                <span style={{ color: serviceDue ? '#f39c12' : 'inherit', fontWeight: serviceDue ? 600 : 400 }}>
                                  {new Date(v.next_service_date).toLocaleDateString()}
                                </span>
                              ) : '-'}
                            </td>
                          )}
                          {isColVisible('status') && (
                            <td>
                              {(() => {
                                const st = VEHICLE_STATUSES.find(s => s.value === v.vehicle_status) || VEHICLE_STATUSES[0];
                                return <span className={`badge ${st.badge}`}>{st.label}</span>;
                              })()}
                            </td>
                          )}
                          {isColVisible('actions') && (
                            <td>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <button className="btn btn-sm btn-secondary" onClick={() => setDetailVehicle(v)} title="View Details">
                                  <Icons.Clock size={14} />
                                </button>
                                {isAdminOrManager && (
                                  <button className="btn btn-sm btn-secondary" onClick={() => { setEditVehicle(v); setShowVehicleModal(true); }} title="Edit">
                                    <Icons.Edit size={14} />
                                  </button>
                                )}
                                {isAdminOrManager && (
                                  <button className="btn btn-sm btn-danger" onClick={() => handleDeleteVehicle(v)} title="Delete">
                                    <Icons.Trash size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '8px',
                }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Showing {((currentPage - 1) * pageSize) + 1}&ndash;{Math.min(currentPage * pageSize, sortedFiltered.length)} of {sortedFiltered.length}
                  </span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button className="btn btn-sm btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(1)} title="First">&laquo;</button>
                    <button className="btn btn-sm btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} title="Previous">&lsaquo;</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                      .reduce((acc, p, idx, arr) => {
                        if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === '...' ? <span key={`dot-${i}`} style={{ padding: '0 4px', color: 'var(--text-secondary)' }}>&hellip;</span> :
                        <button key={p} className={`btn btn-sm ${p === currentPage ? '' : 'btn-secondary'}`}
                          style={p === currentPage ? { background: 'var(--primary-color)', color: 'white' } : undefined}
                          onClick={() => setCurrentPage(p)}>{p}</button>
                      )}
                    <button className="btn btn-sm btn-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} title="Next">&rsaquo;</button>
                    <button className="btn btn-sm btn-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} title="Last">&raquo;</button>
                  </div>
                </div>
              )}
              </>
            )}
          </div>
        </>
      )}

      {/* Checkouts Tab */}
      {activeTab === 'checkouts' && (
        <>
          <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by driver, vehicle, destination..."
                value={checkoutSearch}
                onChange={e => setCheckoutSearch(e.target.value)}
                style={{ flex: 1, minWidth: '200px' }}
              />
              <select
                className="form-input"
                value={checkoutVehicleFilter}
                onChange={e => setCheckoutVehicleFilter(e.target.value)}
                style={{ minWidth: '180px' }}
              >
                <option value="">All Vehicles</option>
                {vehicles.filter(v => v.is_active).sort((a, b) => (a.registration_number || '').localeCompare(b.registration_number || '')).map(v => (
                  <option key={v.id} value={v.id}>{v.registration_number} - {v.make} {v.model}</option>
                ))}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={showReturned}
                  onChange={e => setShowReturned(e.target.checked)}
                />
                Show returned trips
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>From:</label>
                <input type="date" className="form-input" value={checkoutDateFrom} onChange={e => setCheckoutDateFrom(e.target.value)} style={{ width: '150px' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>To:</label>
                <input type="date" className="form-input" value={checkoutDateTo} onChange={e => setCheckoutDateTo(e.target.value)} style={{ width: '150px' }} />
              </div>
              {(checkoutDateFrom || checkoutDateTo || checkoutVehicleFilter) && (
                <button className="btn btn-sm" style={{ fontSize: '0.8rem' }} onClick={() => { setCheckoutDateFrom(''); setCheckoutDateTo(''); setCheckoutVehicleFilter(''); }}>Clear Filters</button>
              )}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{filteredCheckouts.length} record{filteredCheckouts.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="card">
            {filteredCheckouts.length === 0 ? (
              <div className="empty-state">
                <h3>No checkout records found</h3>
                <p>Click "Vehicle Checkout" to record a new trip</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Driver</th>
                      <th>Date</th>
                      <th>Destination</th>
                      <th>Odometer</th>
                      <th>Condition</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCheckouts.map(c => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.vehicles?.make} {c.vehicles?.model}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {c.vehicles?.registration_number}
                          </div>
                        </td>
                        <td>
                          <strong>{c.driver_name}</strong>
                          {c.driver_changed && c.new_driver_name && (
                            <div style={{ fontSize: '0.75rem', color: '#f39c12' }}>→ {c.new_driver_name}</div>
                          )}
                          {c.supervisor && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Sup: {c.supervisor}</div>
                          )}
                        </td>
                        <td>{new Date(c.checkout_date).toLocaleDateString()}</td>
                        <td>
                          <div>{c.destination || '-'}</div>
                          {c.reason_for_use && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.reason_for_use}</div>
                          )}
                        </td>
                        <td>
                          <div>{c.start_odometer?.toLocaleString()}</div>
                          {c.end_odometer && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              → {c.end_odometer.toLocaleString()} ({(c.end_odometer - c.start_odometer).toLocaleString()} km)
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${c.vehicle_condition === 'Excellent' ? 'badge-available' : c.vehicle_condition === 'Good' ? 'badge-available' : c.vehicle_condition === 'Average' ? 'badge-low-stock' : 'badge-overdue'}`}>
                            {c.vehicle_condition || 'Good'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${c.is_returned ? (c.handed_over_to ? 'badge-low-stock' : 'badge-checked-out') : 'badge-available'}`}>
                            {c.is_returned ? (c.handed_over_to ? 'Handed Over' : 'Returned') : 'Out'}
                          </span>
                          {c.is_returned && c.return_location && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{c.return_location}</div>
                          )}
                          {c.is_returned && c.handed_over_to && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>→ {c.handed_over_to}</div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                            {!c.is_returned && (
                              <button className="btn btn-sm btn-primary" onClick={() => setReturnCheckout(c)} title="Return Vehicle">
                                Return
                              </button>
                            )}
                            {isAdminOrManager && (
                              <button className="btn btn-sm btn-secondary" onClick={() => { setEditCheckout(c); setShowCheckoutModal(true); }} title="Edit">
                                <Icons.Edit size={14} />
                              </button>
                            )}
                            {isAdminOrManager && (
                              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteCheckout(c)} title="Delete">
                                <Icons.Trash size={14} />
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
        </>
      )}

      {/* Fines Tab */}
      {activeTab === 'fines' && (
        <>
          <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by driver, vehicle, type, reference..."
                value={fineSearch}
                onChange={e => setFineSearch(e.target.value)}
                style={{ flex: 1, minWidth: '200px' }}
              />
              <select
                className="form-input"
                value={fineVehicleFilter}
                onChange={e => setFineVehicleFilter(e.target.value)}
                style={{ minWidth: '180px' }}
              >
                <option value="">All Vehicles</option>
                {vehicles.sort((a, b) => (a.registration_number || '').localeCompare(b.registration_number || '')).map(v => (
                  <option key={v.id} value={v.id}>{v.registration_number} - {v.make} {v.model}</option>
                ))}
              </select>
              <select
                className="form-input"
                value={fineStatusFilter}
                onChange={e => setFineStatusFilter(e.target.value)}
                style={{ minWidth: '120px' }}
              >
                <option value="">All Statuses</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
                <option value="Disputed">Disputed</option>
                <option value="Written Off">Written Off</option>
              </select>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                {filteredFines.length} fine{filteredFines.length !== 1 ? 's' : ''}
                {filteredFines.length > 0 && ` | Total: R ${filteredFines.reduce((sum, f) => sum + (parseFloat(f.fine_amount) || 0), 0).toFixed(2)}`}
              </span>
            </div>
          </div>
          <div className="card">
            {filteredFines.length === 0 ? (
              <div className="empty-state">
                <h3>No fines recorded</h3>
                <p>Click "Record Fine" to add a fine</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Driver</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Reference</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFines.map(f => (
                      <tr key={f.id}>
                        <td>
                          <strong>{f.vehicles?.make} {f.vehicles?.model}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {f.vehicles?.registration_number}
                          </div>
                        </td>
                        <td><strong>{f.driver_name}</strong></td>
                        <td>{new Date(f.fine_date).toLocaleDateString()}</td>
                        <td>{f.fine_type || '-'}</td>
                        <td style={{ fontWeight: 600 }}>{f.fine_amount ? `R ${parseFloat(f.fine_amount).toFixed(2)}` : '-'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{f.fine_reference || '-'}</td>
                        <td>
                          <span className={`badge ${f.status === 'Paid' ? 'badge-available' : 'badge-overdue'}`}>{f.status}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {isAdminOrManager && (
                              <button className="btn btn-sm btn-secondary" onClick={() => { setEditFine(f); setShowFineModal(true); }}>
                                <Icons.Edit size={14} />
                              </button>
                            )}
                            {isAdminOrManager && (
                              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteFine(f)}>
                                <Icons.Trash size={14} />
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
        </>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <>
          <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by vehicle, provider, description..."
                value={serviceSearch}
                onChange={e => setServiceSearch(e.target.value)}
                style={{ flex: 1, minWidth: '200px' }}
              />
              <select
                className="form-input"
                value={serviceVehicleFilter}
                onChange={e => setServiceVehicleFilter(e.target.value)}
                style={{ minWidth: '180px' }}
              >
                <option value="">All Vehicles</option>
                {vehicles.sort((a, b) => (a.registration_number || '').localeCompare(b.registration_number || '')).map(v => (
                  <option key={v.id} value={v.id}>{v.registration_number} - {v.make} {v.model}</option>
                ))}
              </select>
              <select
                className="form-input"
                value={serviceTypeFilter}
                onChange={e => setServiceTypeFilter(e.target.value)}
                style={{ minWidth: '120px' }}
              >
                <option value="">All Types</option>
                {['Service', 'Repair', 'Tyres', 'Body Work', 'Electrical', 'Inspection', 'Other'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                {filteredServices.length} record{filteredServices.length !== 1 ? 's' : ''}
                {filteredServices.length > 0 && ` | Total: R ${filteredServices.reduce((sum, s) => sum + (parseFloat(s.cost) || 0), 0).toFixed(2)}`}
              </span>
            </div>
          </div>
          <div className="card">
            {filteredServices.length === 0 ? (
              <div className="empty-state">
                <h3>No service records</h3>
                <p>Click "Record Service" to log a service or repair</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Odometer</th>
                      <th>Provider</th>
                      <th>Cost</th>
                      <th>Next Service</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.map(s => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.vehicles?.make} {s.vehicles?.model}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {s.vehicles?.registration_number}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${s.service_type === 'Service' ? 'badge-available' : 'badge-low-stock'}`}>
                            {s.service_type}
                          </span>
                        </td>
                        <td>{new Date(s.service_date).toLocaleDateString()}</td>
                        <td>{s.odometer_at_service ? s.odometer_at_service.toLocaleString() + ' km' : '-'}</td>
                        <td>{s.service_provider || '-'}</td>
                        <td style={{ fontWeight: 600 }}>{s.cost ? `R ${parseFloat(s.cost).toFixed(2)}` : '-'}</td>
                        <td>{s.next_service_date ? new Date(s.next_service_date).toLocaleDateString() : '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {isAdminOrManager && (
                              <button className="btn btn-sm btn-secondary" onClick={() => { setEditService(s); setShowServiceModal(true); }}>
                                <Icons.Edit size={14} />
                              </button>
                            )}
                            {isAdminOrManager && (
                              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteService(s)}>
                                <Icons.Trash size={14} />
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
        </>
      )}

      {/* ===== MODALS ===== */}

      {showVehicleModal && (
        <VehicleModal
          item={editVehicle}
          onClose={() => { setShowVehicleModal(false); setEditVehicle(null); }}
          onSuccess={() => { setShowVehicleModal(false); setEditVehicle(null); fetchData(); }}
        />
      )}

      {showCheckoutModal && (
        <CheckoutModal
          item={editCheckout}
          vehicles={vehicles.filter(v => v.is_active)}
          personnel={personnel}
          onClose={() => { setShowCheckoutModal(false); setEditCheckout(null); }}
          onSuccess={() => { setShowCheckoutModal(false); setEditCheckout(null); fetchData(); }}
        />
      )}

      {returnCheckout && (
        <ReturnModal
          checkout={returnCheckout}
          personnel={personnel}
          onClose={() => setReturnCheckout(null)}
          onReturn={handleReturnVehicle}
        />
      )}

      {showFineModal && (
        <FineModal
          item={editFine}
          vehicles={vehicles}
          personnel={personnel}
          onClose={() => { setShowFineModal(false); setEditFine(null); }}
          onSuccess={() => { setShowFineModal(false); setEditFine(null); fetchData(); }}
        />
      )}

      {showServiceModal && (
        <ServiceModal
          item={editService}
          vehicles={vehicles}
          onClose={() => { setShowServiceModal(false); setEditService(null); }}
          onSuccess={() => { setShowServiceModal(false); setEditService(null); fetchData(); }}
        />
      )}

      {detailVehicle && (
        <VehicleDetailModal
          vehicle={detailVehicle}
          onClose={() => setDetailVehicle(null)}
        />
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => { setShowImportModal(false); fetchData(); }}
        />
      )}

      {showBulkStatusModal && (
        <BulkStatusModal
          selectedIds={selectedIds}
          vehicles={vehicles}
          onClose={() => setShowBulkStatusModal(false)}
          onSuccess={() => { setShowBulkStatusModal(false); setSelectedIds(new Set()); fetchData(); }}
        />
      )}
    </div>
  );
}


// ============================================
// Vehicle Add/Edit Modal
// ============================================
function VehicleModal({ item, onClose, onSuccess }) {
  const [form, setForm] = useState({
    qr_code: item?.qr_code || '',
    make: item?.make || '',
    model: item?.model || '',
    registration_number: item?.registration_number || '',
    year: item?.year || '',
    color: item?.color || '',
    fuel_type: item?.fuel_type || '',
    vin_number: item?.vin_number || '',
    assigned_to: item?.assigned_to || '',
    vehicle_status: item?.vehicle_status || 'Active',
    license_disk_expiry: item?.license_disk_expiry?.split('T')[0] || '',
    registration_expiry: item?.registration_expiry?.split('T')[0] || '',
    next_service_date: item?.next_service_date?.split('T')[0] || '',
    next_service_odometer: item?.next_service_odometer || '',
    current_odometer: item?.current_odometer || '',
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.make || !form.model || !form.registration_number) {
      alert('Please fill in make, model, and registration number');
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form };
      // Clean empty fields
      Object.keys(payload).forEach(k => {
        if (payload[k] === '') payload[k] = null;
      });
      if (payload.year) payload.year = parseInt(payload.year, 10);
      if (payload.current_odometer) payload.current_odometer = parseInt(payload.current_odometer, 10);
      if (payload.next_service_odometer) payload.next_service_odometer = parseInt(payload.next_service_odometer, 10);
      payload.is_active = !['Decommissioned', 'Sold', 'Written Off'].includes(payload.vehicle_status);

      if (item) {
        await vehiclesApi.update(item.id, payload);
      } else {
        await vehiclesApi.create(payload);
      }
      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>{item ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Make *</label>
                <select name="make" value={form.make} onChange={handleChange} className="form-input" required>
                  <option value="">-- Select Make --</option>
                  {(getAssetConfig().vehicleMakes || []).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Model *</label>
                <input type="text" name="model" value={form.model} onChange={handleChange} className="form-input" placeholder="e.g. Hilux (D/C)" required />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Registration Number *</label>
                <input type="text" name="registration_number" value={form.registration_number} onChange={handleChange} className="form-input" placeholder="e.g. BR 02 GL ZN" required />
              </div>
              <div className="form-group">
                <label className="form-label">Year</label>
                <input type="number" name="year" value={form.year} onChange={handleChange} className="form-input" placeholder="e.g. 2023" min="1990" max="2030" />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Color</label>
                <input type="text" name="color" value={form.color} onChange={handleChange} className="form-input" placeholder="e.g. White" />
              </div>
              <div className="form-group">
                <label className="form-label">Fuel Type</label>
                <select name="fuel_type" value={form.fuel_type} onChange={handleChange} className="form-input">
                  <option value="">-- Select --</option>
                  {(getAssetConfig().fuelTypes || []).map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">VIN Number</label>
                <input type="text" name="vin_number" value={form.vin_number} onChange={handleChange} className="form-input" placeholder="Vehicle Identification Number" />
              </div>
              <div className="form-group">
                <label className="form-label">Assigned To</label>
                <input type="text" name="assigned_to" value={form.assigned_to} onChange={handleChange} className="form-input" placeholder="e.g. Pool Vehicle, RS Pool Vehicle" />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">QR Code</label>
                <input type="text" name="qr_code" value={form.qr_code} onChange={handleChange} className="form-input" placeholder="QR code identifier" />
              </div>
              <div className="form-group">
                <label className="form-label">Current Odometer (km)</label>
                <input type="number" name="current_odometer" value={form.current_odometer} onChange={handleChange} className="form-input" placeholder="e.g. 45000" />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">License Disk Expiry</label>
                <input type="date" name="license_disk_expiry" value={form.license_disk_expiry} onChange={handleChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Registration Expiry</label>
                <input type="date" name="registration_expiry" value={form.registration_expiry} onChange={handleChange} className="form-input" />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Next Service Date</label>
                <input type="date" name="next_service_date" value={form.next_service_date} onChange={handleChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Next Service Odometer (km)</label>
                <input type="number" name="next_service_odometer" value={form.next_service_odometer} onChange={handleChange} className="form-input" placeholder="e.g. 55000" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select name="vehicle_status" value={form.vehicle_status} onChange={handleChange} className="form-input">
                {VEHICLE_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} className="form-input" rows="2" placeholder="Any additional notes" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (item ? 'Update Vehicle' : 'Add Vehicle')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ============================================
// Vehicle Checkout / Pre-Trip Inspection Modal
// ============================================
function CheckoutModal({ item, vehicles, personnel, onClose, onSuccess }) {
  const [form, setForm] = useState({
    vehicle_id: item?.vehicle_id || '',
    driver_name: item?.driver_name || '',
    driver_license_number: item?.driver_license_number || '',
    driver_license_expiry: item?.driver_license_expiry || '',
    supervisor: item?.supervisor || '',
    checkout_date: item?.checkout_date ? item.checkout_date.split('T')[0] : new Date().toISOString().split('T')[0],
    destination: item?.destination || '',
    reason_for_use: item?.reason_for_use || '',
    start_odometer: item?.start_odometer || '',
    vehicle_condition: item?.vehicle_condition || 'Good',

    // Pre-trip inspection
    check_sanitized: item?.check_sanitized || 'N/A',
    check_bodywork: item?.check_bodywork || 'Good',
    check_tyres: item?.check_tyres || 'Good',
    check_oil_water: item?.check_oil_water || 'Yes',
    check_fuel: item?.check_fuel || 'Yes',
    check_first_auto_aa_cards: item?.check_first_auto_aa_cards || 'Yes',
    check_windscreen_wipers_mirrors: item?.check_windscreen_wipers_mirrors || 'Good',
    check_lights: item?.check_lights || 'Yes',
    check_spare_tyre_jack: item?.check_spare_tyre_jack || 'Yes',
    check_brakes: item?.check_brakes || 'Yes',
    check_hooter: item?.check_hooter || 'Yes',
    check_warning_triangle: item?.check_warning_triangle || 'Yes',
    check_license_disk: item?.check_license_disk || 'Yes',
    check_fire_extinguisher: item?.check_fire_extinguisher || 'Yes',
    check_first_aid_kit: item?.check_first_aid_kit || 'Yes',
    check_warning_lights: item?.check_warning_lights || 'Yes',
    check_wheel_chocks: item?.check_wheel_chocks || 'N/A',

    first_aid_kit_contents: item?.first_aid_kit_contents || '',
    condition_notes: item?.condition_notes || '',
    checks_not_performed_reason: item?.checks_not_performed_reason || '',

    driver_changed: item?.driver_changed || false,
    new_driver_name: item?.new_driver_name || '',

    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [licenseWarning, setLicenseWarning] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleDriverSelect = (e) => {
    const personId = e.target.value;
    const person = personnel.find(p => String(p.id) === personId);
    if (person) {
      const updates = { driver_name: person.full_name };
      if (person.drivers_license_number) updates.driver_license_number = person.drivers_license_number;
      if (person.drivers_license_expiry) {
        const expiry = person.drivers_license_expiry.split('T')[0];
        updates.driver_license_expiry = expiry;
        if (new Date(expiry) < new Date()) {
          setLicenseWarning('WARNING: Driver license has expired!');
        } else {
          setLicenseWarning('');
        }
      }
      if (person.supervisor) {
        const supWords = person.supervisor.toLowerCase().split(/\s+/);
        const supMatch = personnel.find(p => {
          if (!p.full_name) return false;
          const fn = p.full_name.toLowerCase();
          return fn === person.supervisor.toLowerCase() || supWords.every(w => fn.includes(w));
        });
        updates.supervisor = supMatch ? supMatch.full_name : person.supervisor;
      }
      setForm(prev => ({ ...prev, ...updates }));
    }
  };

  const handleLicenseExpiryChange = (e) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, driver_license_expiry: val }));
    if (val && new Date(val) < new Date()) {
      setLicenseWarning('WARNING: Driver license has expired!');
    } else {
      setLicenseWarning('');
    }
  };

  const handleVehicleSelect = (e) => {
    const vId = e.target.value;
    const vehicle = vehicles.find(v => String(v.id) === vId);
    setForm(prev => ({
      ...prev,
      vehicle_id: vId,
      start_odometer: vehicle?.current_odometer || prev.start_odometer,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id || !form.driver_name || !form.start_odometer) {
      alert('Please select a vehicle, driver, and enter the start odometer');
      return;
    }
    if (form.driver_license_expiry && new Date(form.driver_license_expiry) < new Date()) {
      if (!window.confirm('WARNING: The driver\'s license has expired. Do you still want to proceed?')) return;
    }
    try {
      setSaving(true);
      const payload = { ...form };
      payload.vehicle_id = parseInt(payload.vehicle_id, 10) || null;
      payload.start_odometer = parseInt(payload.start_odometer, 10) || 0;
      // Clean empty fields
      Object.keys(payload).forEach(k => {
        if (payload[k] === '') payload[k] = null;
      });
      payload.driver_changed = form.driver_changed;

      if (item) {
        await vehicleCheckoutsApi.update(item.id, payload);
      } else {
        await vehicleCheckoutsApi.create(payload);
      }
      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const inspectionChecks = [
    { key: 'check_sanitized', label: 'Sanitizing of vehicle' },
    { key: 'check_bodywork', label: 'Vehicle bodywork' },
    { key: 'check_tyres', label: 'Tyres & tyre pressure' },
    { key: 'check_oil_water', label: 'Oil & water' },
    { key: 'check_fuel', label: 'Fuel' },
    { key: 'check_first_auto_aa_cards', label: 'First Auto & AA cards in vehicle' },
    { key: 'check_windscreen_wipers_mirrors', label: 'Windscreen, windows, wiper blades & mirrors' },
    { key: 'check_lights', label: 'Lights (front/rear & indicators)' },
    { key: 'check_spare_tyre_jack', label: 'Spare tyre, jack & wheel spanner' },
    { key: 'check_brakes', label: 'Brakes' },
    { key: 'check_hooter', label: 'Hooter' },
    { key: 'check_warning_triangle', label: 'Warning triangle' },
    { key: 'check_license_disk', label: 'License disk' },
    { key: 'check_fire_extinguisher', label: 'Fire extinguisher' },
    { key: 'check_first_aid_kit', label: 'First aid kit' },
    { key: 'check_warning_lights', label: 'Vehicle warning lights' },
    { key: 'check_wheel_chocks', label: 'Wheel chocks (where issued)' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h2>{item ? 'Edit Vehicle Checkout' : 'Vehicle Checkout — Pre-Trip Inspection'}</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Vehicle Selection */}
            <div className="form-group">
              <label className="form-label">Vehicle *</label>
              <select name="vehicle_id" value={form.vehicle_id} onChange={handleVehicleSelect} className="form-input" required>
                <option value="">-- Select Vehicle --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.make} {v.model} — {v.registration_number}</option>
                ))}
              </select>
            </div>

            {/* Driver Info */}
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Driver *</label>
                <select onChange={handleDriverSelect} className="form-input" value={personnel.find(p => p.full_name === form.driver_name)?.id || ''}>
                  <option value="">-- Select Driver --</option>
                  {personnel.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Supervisor</label>
                <select name="supervisor" value={form.supervisor} onChange={handleChange} className="form-input">
                  <option value="">-- Select Supervisor --</option>
                  {personnel.map(p => (
                    <option key={p.id} value={p.full_name}>{p.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Driver License Number</label>
                <input type="text" name="driver_license_number" value={form.driver_license_number} onChange={handleChange} className="form-input" placeholder="License number" />
              </div>
              <div className="form-group">
                <label className="form-label">License Expiry Date</label>
                <input type="date" name="driver_license_expiry" value={form.driver_license_expiry} onChange={handleLicenseExpiryChange} className="form-input" />
              </div>
            </div>
            {licenseWarning && (
              <div style={{ padding: '8px 12px', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid var(--error-color)', borderRadius: '6px', color: 'var(--error-color)', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icons.Warning size={14} /> {licenseWarning}
              </div>
            )}

            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" name="checkout_date" value={form.checkout_date} onChange={handleChange} className="form-input" required />
              </div>
              <div className="form-group">
                <label className="form-label">Start Odometer *</label>
                <input type="number" name="start_odometer" value={form.start_odometer} onChange={handleChange} className="form-input" placeholder="e.g. 45000" required />
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle Condition</label>
                <select name="vehicle_condition" value={form.vehicle_condition} onChange={handleChange} className="form-input">
                  {CONDITION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Destination</label>
                <input type="text" name="destination" value={form.destination} onChange={handleChange} className="form-input" placeholder="e.g. Two Rivers" />
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Vehicle Usage</label>
                <input type="text" name="reason_for_use" value={form.reason_for_use} onChange={handleChange} className="form-input" placeholder="e.g. Work, Client Visit" />
              </div>
            </div>

            {/* Pre-Trip Inspection Checklist */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem' }}>Pre-Trip Inspection Checklist</h3>
              <div className="form-grid-2">
                {inspectionChecks.map(check => (
                  <div key={check.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                    <label style={{ fontSize: '0.85rem', flex: 1 }}>{check.label}</label>
                    <select
                      name={check.key}
                      value={form[check.key]}
                      onChange={handleChange}
                      className="form-input"
                      style={{ width: '110px', padding: '4px 6px', fontSize: '0.8rem' }}
                    >
                      {CHECK_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">First Aid Kit Contents</label>
              <select name="first_aid_kit_contents" value={form.first_aid_kit_contents} onChange={handleChange} className="form-input">
                <option value="">-- Select --</option>
                <option value="All items present / Nothing missing">All items present / Nothing missing</option>
                <option value="Some items missing">Some items missing</option>
                <option value="Kit not present">Kit not present</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Reason for vehicle condition (if not Excellent)</label>
              <textarea name="condition_notes" value={form.condition_notes} onChange={handleChange} className="form-input" rows="2" placeholder="Describe any issues..." />
            </div>

            <div className="form-group">
              <label className="form-label">Reason for any checks not performed</label>
              <textarea name="checks_not_performed_reason" value={form.checks_not_performed_reason} onChange={handleChange} className="form-input" rows="2" />
            </div>

            {/* Driver Change */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                <input type="checkbox" name="driver_changed" checked={form.driver_changed} onChange={handleChange} />
                <strong>Driver Changed During Trip</strong>
              </label>
              {form.driver_changed && (
                <div className="form-group" style={{ marginTop: '8px' }}>
                  <label className="form-label">New Driver Name</label>
                  <select onChange={(e) => { const p = personnel.find(pp => String(pp.id) === e.target.value); if (p) setForm(prev => ({ ...prev, new_driver_name: p.full_name })); }} className="form-input">
                    <option value="">-- Select New Driver --</option>
                    {personnel.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Additional Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} className="form-input" rows="2" placeholder="Any additional notes..." />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (item ? 'Update' : 'Submit Checkout')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ============================================
// Return Vehicle Modal
// ============================================
function ReturnModal({ checkout, personnel, onClose, onReturn }) {
  const [endOdometer, setEndOdometer] = useState('');
  const [returnType, setReturnType] = useState('depot');
  const [returnLocation, setReturnLocation] = useState('');
  const [handedOverTo, setHandedOverTo] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const DEPOTS = [
    'WearCheck - Longmeadow',
    'WearCheck - Springs',
    'WearCheck - Westville',
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!endOdometer) { alert('Please enter the end odometer reading'); return; }
    if (parseInt(endOdometer, 10) < checkout.start_odometer) {
      alert('End odometer cannot be less than start odometer');
      return;
    }
    if (returnType === 'depot' && !returnLocation) {
      alert('Please select a depot'); return;
    }
    if (returnType === 'handover' && !handedOverTo) {
      alert('Please select the driver to hand over to'); return;
    }
    setSaving(true);
    await onReturn({
      endOdometer: parseInt(endOdometer, 10),
      returnLocation: returnType === 'depot' ? returnLocation : null,
      handedOverTo: returnType === 'handover' ? handedOverTo : null,
      returnNotes: returnNotes || null,
    });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2>Return Vehicle</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '10px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px' }}>
              <strong>{checkout.driver_name}</strong>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {checkout.vehicles?.make} {checkout.vehicles?.model} — {checkout.vehicles?.registration_number}
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                Start odometer: <strong>{checkout.start_odometer?.toLocaleString()} km</strong>
              </div>
            </div>

            {/* Return Type Selection */}
            <div className="form-group">
              <label className="form-label">Return Type *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className={`btn ${returnType === 'depot' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }} onClick={() => setReturnType('depot')}>
                  Return to Depot
                </button>
                <button type="button" className={`btn ${returnType === 'handover' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }} onClick={() => setReturnType('handover')}>
                  Hand Over to Driver
                </button>
              </div>
            </div>

            {/* Depot Selection */}
            {returnType === 'depot' && (
              <div className="form-group">
                <label className="form-label">Return to Depot *</label>
                <select value={returnLocation} onChange={e => setReturnLocation(e.target.value)} className="form-input" required>
                  <option value="">-- Select Depot --</option>
                  {DEPOTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            {/* Driver Handover */}
            {returnType === 'handover' && (
              <div className="form-group">
                <label className="form-label">Hand Over to Driver *</label>
                <select value={handedOverTo} onChange={e => setHandedOverTo(e.target.value)} className="form-input" required>
                  <option value="">-- Select Driver --</option>
                  {(personnel || []).filter(p => p.full_name !== checkout.driver_name).map(p => (
                    <option key={p.id} value={p.full_name}>{p.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">End Odometer (km) *</label>
              <input
                type="number"
                value={endOdometer}
                onChange={e => setEndOdometer(e.target.value)}
                className="form-input"
                placeholder="e.g. 45250"
                required
                min={checkout.start_odometer}
              />
            </div>
            {endOdometer && parseInt(endOdometer, 10) > checkout.start_odometer && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Distance travelled: <strong>{(parseInt(endOdometer, 10) - checkout.start_odometer).toLocaleString()} km</strong>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Return Notes</label>
              <textarea
                value={returnNotes}
                onChange={e => setReturnNotes(e.target.value)}
                className="form-input"
                rows={2}
                placeholder="Any notes about the return..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Processing...' : returnType === 'handover' ? 'Hand Over Vehicle' : 'Return Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ============================================
// Fine Modal
// ============================================
function FineModal({ item, vehicles, personnel, onClose, onSuccess }) {
  const [form, setForm] = useState({
    vehicle_id: item?.vehicle_id || '',
    driver_name: item?.driver_name || '',
    fine_date: item?.fine_date || new Date().toISOString().split('T')[0],
    fine_amount: item?.fine_amount || '',
    fine_type: item?.fine_type || '',
    fine_reference: item?.fine_reference || '',
    description: item?.description || '',
    status: item?.status || 'Unpaid',
    paid_date: item?.paid_date || '',
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id || !form.driver_name || !form.fine_date) {
      alert('Please fill in vehicle, driver, and date');
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form };
      payload.vehicle_id = parseInt(payload.vehicle_id, 10);
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
      if (payload.fine_amount) payload.fine_amount = parseFloat(payload.fine_amount);

      if (item) {
        await vehicleFinesApi.update(item.id, payload);
      } else {
        await vehicleFinesApi.create(payload);
      }
      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
        <div className="modal-header">
          <h2>{item ? 'Edit Fine' : 'Record Fine'}</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Vehicle *</label>
              <select name="vehicle_id" value={form.vehicle_id} onChange={handleChange} className="form-input" required>
                <option value="">-- Select Vehicle --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.make} {v.model} — {v.registration_number}</option>
                ))}
              </select>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Driver *</label>
                <select name="driver_name" value={form.driver_name} onChange={handleChange} className="form-input" required>
                  <option value="">-- Select Driver --</option>
                  {personnel.map(p => (
                    <option key={p.id} value={p.full_name}>{p.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fine Date *</label>
                <input type="date" name="fine_date" value={form.fine_date} onChange={handleChange} className="form-input" required />
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Fine Type</label>
                <select name="fine_type" value={form.fine_type} onChange={handleChange} className="form-input">
                  <option value="">-- Select Type --</option>
                  {['Speeding', 'Red Light', 'Parking', 'License Disk', 'Overloading', 'Reckless Driving', 'Other'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount (R)</label>
                <input type="number" name="fine_amount" value={form.fine_amount} onChange={handleChange} className="form-input" step="0.01" placeholder="e.g. 500.00" />
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Reference Number</label>
                <input type="text" name="fine_reference" value={form.fine_reference} onChange={handleChange} className="form-input" placeholder="Fine reference #" />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select name="status" value={form.status} onChange={handleChange} className="form-input">
                  <option value="Unpaid">Unpaid</option>
                  <option value="Paid">Paid</option>
                  <option value="Disputed">Disputed</option>
                  <option value="Written Off">Written Off</option>
                </select>
              </div>
            </div>
            {form.status === 'Paid' && (
              <div className="form-group">
                <label className="form-label">Date Paid</label>
                <input type="date" name="paid_date" value={form.paid_date} onChange={handleChange} className="form-input" />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} className="form-input" rows="2" placeholder="Details about the fine..." />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} className="form-input" rows="2" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (item ? 'Update' : 'Record Fine')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ============================================
// Service / Repair Modal
// ============================================
function ServiceModal({ item, vehicles, onClose, onSuccess }) {
  const [form, setForm] = useState({
    vehicle_id: item?.vehicle_id || '',
    service_type: item?.service_type || 'Service',
    service_date: item?.service_date || new Date().toISOString().split('T')[0],
    odometer_at_service: item?.odometer_at_service || '',
    description: item?.description || '',
    service_provider: item?.service_provider || '',
    cost: item?.cost || '',
    next_service_date: item?.next_service_date || '',
    next_service_odometer: item?.next_service_odometer || '',
    status: item?.status || 'Completed',
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id || !form.service_date) {
      alert('Please select a vehicle and service date');
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form };
      payload.vehicle_id = parseInt(payload.vehicle_id, 10);
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
      if (payload.odometer_at_service) payload.odometer_at_service = parseInt(payload.odometer_at_service, 10);
      if (payload.next_service_odometer) payload.next_service_odometer = parseInt(payload.next_service_odometer, 10);
      if (payload.cost) payload.cost = parseFloat(payload.cost);

      if (item) {
        await vehicleServicesApi.update(item.id, payload);
      } else {
        await vehicleServicesApi.create(payload);
      }

      // Update the vehicle's next service info if provided
      if (payload.next_service_date || payload.next_service_odometer) {
        const updates = {};
        if (payload.next_service_date) updates.next_service_date = payload.next_service_date;
        if (payload.next_service_odometer) updates.next_service_odometer = payload.next_service_odometer;
        if (payload.odometer_at_service) updates.current_odometer = payload.odometer_at_service;
        await vehiclesApi.update(payload.vehicle_id, updates);
      }

      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
        <div className="modal-header">
          <h2>{item ? 'Edit Service Record' : 'Record Service / Repair'}</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Vehicle *</label>
              <select name="vehicle_id" value={form.vehicle_id} onChange={handleChange} className="form-input" required>
                <option value="">-- Select Vehicle --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.make} {v.model} — {v.registration_number}</option>
                ))}
              </select>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Type</label>
                <select name="service_type" value={form.service_type} onChange={handleChange} className="form-input">
                  <option value="Service">Service</option>
                  <option value="Repair">Repair</option>
                  <option value="Tyres">Tyres</option>
                  <option value="Body Work">Body Work</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Service Date *</label>
                <input type="date" name="service_date" value={form.service_date} onChange={handleChange} className="form-input" required />
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Odometer at Service (km)</label>
                <input type="number" name="odometer_at_service" value={form.odometer_at_service} onChange={handleChange} className="form-input" placeholder="e.g. 50000" />
              </div>
              <div className="form-group">
                <label className="form-label">Cost (R)</label>
                <input type="number" name="cost" value={form.cost} onChange={handleChange} className="form-input" step="0.01" placeholder="e.g. 3500.00" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Service Provider</label>
              <input type="text" name="service_provider" value={form.service_provider} onChange={handleChange} className="form-input" placeholder="e.g. Toyota Dealer, John's Auto" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} className="form-input" rows="3" placeholder="What was done..." />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Next Service Date</label>
                <input type="date" name="next_service_date" value={form.next_service_date} onChange={handleChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Next Service Odometer (km)</label>
                <input type="number" name="next_service_odometer" value={form.next_service_odometer} onChange={handleChange} className="form-input" placeholder="e.g. 60000" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select name="status" value={form.status} onChange={handleChange} className="form-input">
                <option value="Completed">Completed</option>
                <option value="In Progress">In Progress</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} className="form-input" rows="2" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (item ? 'Update' : 'Record Service')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ============================================
// Vehicle Detail Modal (history overview)
// ============================================
function VehicleDetailModal({ vehicle, onClose }) {
  const [checkouts, setCheckouts] = useState([]);
  const [fines, setFines] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      vehicleCheckoutsApi.getAllIncludingReturned(vehicle.id),
      vehicleFinesApi.getAll(vehicle.id),
      vehicleServicesApi.getAll(vehicle.id),
    ]).then(([c, f, s]) => {
      setCheckouts(c.data || []);
      setFines(f.data || []);
      setServices(s.data || []);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, [vehicle.id]);

  const totalFines = fines.reduce((sum, f) => sum + (parseFloat(f.fine_amount) || 0), 0);
  const unpaidFines = fines.filter(f => f.status === 'Unpaid');
  const totalServiceCost = services.reduce((sum, s) => sum + (parseFloat(s.cost) || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h2>{vehicle.make} {vehicle.model} — {vehicle.registration_number}</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {loading ? (
            <div className="loading"><div className="spinner"></div> Loading...</div>
          ) : (
            <>
              {/* Vehicle Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{checkouts.length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Trips</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: fines.length > 0 ? 'var(--error-color)' : 'inherit' }}>{fines.length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Fines (R {totalFines.toFixed(2)})</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: unpaidFines.length > 0 ? 'var(--error-color)' : 'var(--success-color)' }}>{unpaidFines.length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Unpaid Fines</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{services.length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Services (R {totalServiceCost.toFixed(2)})</div>
                </div>
              </div>

              {/* Vehicle Details */}
              <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                  {vehicle.year && <div><strong>Year:</strong> {vehicle.year}</div>}
                  {vehicle.color && <div><strong>Color:</strong> {vehicle.color}</div>}
                  {vehicle.vin_number && <div><strong>VIN:</strong> {vehicle.vin_number}</div>}
                  {vehicle.qr_code && <div><strong>QR Code:</strong> {vehicle.qr_code}</div>}
                  <div><strong>Odometer:</strong> {vehicle.current_odometer ? vehicle.current_odometer.toLocaleString() + ' km' : 'N/A'}</div>
                  <div><strong>Status:</strong> {vehicle.vehicle_status}</div>
                  {vehicle.license_disk_expiry && <div><strong>License Disk Expiry:</strong> {new Date(vehicle.license_disk_expiry).toLocaleDateString()}</div>}
                  {vehicle.next_service_date && <div><strong>Next Service:</strong> {new Date(vehicle.next_service_date).toLocaleDateString()}</div>}
                </div>
                {vehicle.notes && <div style={{ marginTop: '8px', fontSize: '0.85rem' }}><strong>Notes:</strong> {vehicle.notes}</div>}
              </div>

              {/* Recent Trips */}
              <h3 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>Recent Trips (last 10)</h3>
              {checkouts.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No trips recorded</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                  {checkouts.slice(0, 10).map(c => (
                    <div key={c.id} style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.83rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{c.driver_name}</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>{new Date(c.checkout_date).toLocaleDateString()}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        {c.destination || c.reason_for_use || '-'} | Odometer: {c.start_odometer?.toLocaleString()}
                        {c.end_odometer ? ` → ${c.end_odometer.toLocaleString()} (${(c.end_odometer - c.start_odometer).toLocaleString()} km)` : ''}
                        <span className={`badge ${c.is_returned ? 'badge-checked-out' : 'badge-available'}`} style={{ marginLeft: '8px', fontSize: '0.7rem' }}>
                          {c.is_returned ? 'Returned' : 'Out'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fines */}
              {fines.length > 0 && (
                <>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>Fines</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                    {fines.map(f => (
                      <div key={f.id} style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.83rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{f.driver_name} — {f.fine_type || 'Fine'}</strong>
                          <span className={`badge ${f.status === 'Paid' ? 'badge-available' : 'badge-overdue'}`}>{f.status}</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {new Date(f.fine_date).toLocaleDateString()} | R {parseFloat(f.fine_amount || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Services */}
              {services.length > 0 && (
                <>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>Service History</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {services.map(s => (
                      <div key={s.id} style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.83rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{s.service_type} — {s.service_provider || 'N/A'}</strong>
                          <span style={{ color: 'var(--text-secondary)' }}>{new Date(s.service_date).toLocaleDateString()}</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {s.description || '-'} | R {parseFloat(s.cost || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default Vehicles;


// ============================================
// Bulk Import Modal
// ============================================
function ImportModal({ onClose, onSuccess }) {
  const [importData, setImportData] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const TEMPLATE_COLUMNS = ['Make', 'Model', 'Registration Number', 'Year', 'Color', 'Fuel Type', 'VIN Number', 'Assigned To', 'Status', 'Current Odometer', 'License Disk Expiry', 'Next Service Date', 'Notes'];

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, ['Toyota', 'Hilux (D/C)', 'BR 02 GL ZN', '2023', 'White', 'Diesel', 'ABC123456789', 'Pool Vehicle', 'Active', '45000', '2025-12-31', '2025-06-15', '']]);
    ws['!cols'] = TEMPLATE_COLUMNS.map(h => ({ wch: Math.max(h.length + 4, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vehicles');
    XLSX.writeFile(wb, 'vehicle_import_template.xlsx');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    const isXlsx = file.name.match(/\.xlsx?$/i);
    reader.onload = (evt) => {
      try {
        let rows;
        if (isXlsx) {
          const wb = XLSX.read(evt.target.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        } else {
          const text = evt.target.result;
          rows = text.split('\n').filter(l => l.trim()).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
        }
        if (rows.length < 2) { alert('No data rows found'); return; }
        const headers = rows[0].map(h => String(h).trim().toLowerCase());
        const dataRows = rows.slice(1).filter(r => r.some(c => c && String(c).trim()));
        const parsed = dataRows.map(row => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = row[i] ? String(row[i]).trim() : ''; });
          return {
            make: obj['make'] || '',
            model: obj['model'] || '',
            registration_number: obj['registration number'] || obj['registration_number'] || obj['reg'] || '',
            year: obj['year'] ? parseInt(obj['year'], 10) : null,
            color: obj['color'] || obj['colour'] || null,
            fuel_type: obj['fuel type'] || obj['fuel_type'] || null,
            vin_number: obj['vin number'] || obj['vin_number'] || obj['vin'] || null,
            assigned_to: obj['assigned to'] || obj['assigned_to'] || null,
            vehicle_status: obj['status'] || 'Active',
            current_odometer: obj['current odometer'] || obj['current_odometer'] || obj['odometer'] ? parseInt(obj['current odometer'] || obj['current_odometer'] || obj['odometer'], 10) || null : null,
            license_disk_expiry: obj['license disk expiry'] || obj['license_disk_expiry'] || null,
            next_service_date: obj['next service date'] || obj['next_service_date'] || null,
            notes: obj['notes'] || null,
          };
        }).filter(r => r.make && r.model && r.registration_number);
        setImportData(parsed);
        setImportResult(null);
      } catch (err) {
        alert('Error parsing file: ' + err.message);
      }
    };
    if (isXlsx) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  };

  const handleImport = async () => {
    if (importData.length === 0) return;
    setImporting(true);
    let success = 0, failed = 0, errors = [];
    for (const row of importData) {
      try {
        const payload = { ...row };
        payload.is_active = !['Decommissioned', 'Sold', 'Written Off'].includes(payload.vehicle_status);
        Object.keys(payload).forEach(k => { if (payload[k] === '' || payload[k] === undefined) payload[k] = null; });
        await vehiclesApi.create(payload);
        success++;
      } catch (err) {
        failed++;
        errors.push(`${row.registration_number}: ${err.message}`);
      }
    }
    setImportResult({ success, failed, errors });
    if (success > 0) setTimeout(() => onSuccess(), 1500);
    setImporting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>Import Vehicles</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
              <Icons.Download size={14} /> Download Template
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>XLSX Format</span>
          </div>
          <div className="form-group">
            <label className="form-label">Select File</label>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="form-input" />
          </div>
          {importData.length > 0 && (
            <div style={{ padding: '10px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px' }}>
              <strong>{importData.length} vehicle{importData.length !== 1 ? 's' : ''} ready to import</strong>
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '8px', fontSize: '0.8rem' }}>
                {importData.slice(0, 20).map((r, i) => (
                  <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                    {r.make} {r.model} - {r.registration_number} {r.year ? `(${r.year})` : ''}
                  </div>
                ))}
                {importData.length > 20 && <div style={{ padding: '4px 0', color: 'var(--text-secondary)' }}>...and {importData.length - 20} more</div>}
              </div>
            </div>
          )}
          {importResult && (
            <div style={{ padding: '10px', background: importResult.failed > 0 ? 'rgba(231,76,60,0.1)' : 'rgba(46,204,113,0.1)', borderRadius: '8px', border: `1px solid ${importResult.failed > 0 ? 'var(--error-color)' : 'var(--success-color)'}` }}>
              <strong>{importResult.success} imported successfully</strong>
              {importResult.failed > 0 && <div style={{ color: 'var(--error-color)' }}>{importResult.failed} failed</div>}
              {importResult.errors.length > 0 && (
                <div style={{ fontSize: '0.8rem', marginTop: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                  {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={importing || importData.length === 0}>
            {importing ? 'Importing...' : `Import ${importData.length} Vehicle${importData.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================
// Bulk Status Update Modal
// ============================================
function BulkStatusModal({ selectedIds, vehicles, onClose, onSuccess }) {
  const [newStatus, setNewStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = vehicles.filter(v => selectedIds.has(v.id));

  const handleSubmit = async () => {
    if (!newStatus) { alert('Please select a status'); return; }
    if (!window.confirm(`Update ${selected.length} vehicle(s) to "${newStatus}"?`)) return;
    setSaving(true);
    try {
      for (const v of selected) {
        const isActive = !['Decommissioned', 'Sold', 'Written Off'].includes(newStatus);
        await vehiclesApi.update(v.id, { vehicle_status: newStatus, is_active: isActive });
      }
      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div className="modal-header">
          <h2>Bulk Status Update</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ padding: '10px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px' }}>
            <strong>{selected.length} vehicle{selected.length !== 1 ? 's' : ''} selected</strong>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', maxHeight: '120px', overflowY: 'auto' }}>
              {selected.map(v => (
                <div key={v.id}>{v.make} {v.model} - {v.registration_number}</div>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">New Status</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="form-input">
              <option value="">-- Select Status --</option>
              {VEHICLE_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !newStatus}>
            {saving ? 'Updating...' : `Update ${selected.length} Vehicle${selected.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
