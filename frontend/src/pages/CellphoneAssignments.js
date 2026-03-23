import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { cellphoneAssignmentsApi, personnelApi } from '../services/api';
import * as XLSX from 'xlsx';
import { useOperator } from '../context/OperatorContext';
import { Icons } from '../components/Icons';
import { getAssetConfig } from './Settings';
import { exportData } from '../services/exportUtils';

function CellphoneAssignments() {
  const { operatorRole } = useOperator();
  const isAdminOrManager = operatorRole && ['admin', 'manager'].includes(operatorRole.toLowerCase());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [showReturned, setShowReturned] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignItem, setReassignItem] = useState(null);
  const [upgradeFilter, setUpgradeFilter] = useState('');
  const [sortCol, setSortCol] = useState('employee_name');
  const [sortDir, setSortDir] = useState('asc');
  const [showDivisionBreakdown, setShowDivisionBreakdown] = useState(false);

  // New feature state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBrandChart, setShowBrandChart] = useState(false);
  const [showCostSummary, setShowCostSummary] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [hiddenColumns, setHiddenColumns] = useState(new Set());
  const [showColumnToggle, setShowColumnToggle] = useState(false);

  const PHONE_STATUSES = [
    { value: 'Active', label: 'Active', badge: 'badge-available', color: 'var(--success-color)' },
    { value: 'Returned', label: 'Returned', badge: 'badge-checked-out', color: 'var(--text-secondary)' },
    { value: 'Stolen', label: 'Stolen', badge: 'badge-overdue', color: 'var(--error-color)' },
    { value: 'Damaged', label: 'Damaged', badge: 'badge-overdue', color: '#e67e22' },
    { value: 'Repairs', label: 'Sent for Repairs', badge: 'badge-low-stock', color: '#f39c12' },
    { value: 'Lost', label: 'Lost', badge: 'badge-overdue', color: 'var(--error-color)' },
    { value: 'Decommissioned', label: 'Decommissioned', badge: 'badge-checked-out', color: 'var(--text-secondary)' },
  ];

  // Upgrade alert helpers
  const UPGRADE_MONTHS = 24;
  const APPROACHING_MONTHS = 18;

  const getPhoneAgeDays = (dateAssigned) => {
    if (!dateAssigned) return 0;
    const assigned = new Date(dateAssigned);
    const now = new Date();
    return Math.floor((now - assigned) / (1000 * 60 * 60 * 24));
  };

  const getPhoneAgeMonths = (dateAssigned) => {
    if (!dateAssigned) return 0;
    const assigned = new Date(dateAssigned);
    const now = new Date();
    return (now.getFullYear() - assigned.getFullYear()) * 12 + (now.getMonth() - assigned.getMonth());
  };

  const getUpgradeStatus = (item) => {
    if (!item.date_assigned || item.phone_status !== 'Active') return 'ok';
    const months = getPhoneAgeMonths(item.date_assigned);
    if (months >= UPGRADE_MONTHS) return 'due';
    if (months >= APPROACHING_MONTHS) return 'approaching';
    return 'ok';
  };

  const getPhoneAgeLabel = (dateAssigned) => {
    if (!dateAssigned) return '-';
    const months = getPhoneAgeMonths(dateAssigned);
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years > 0) return `${years}y ${remainingMonths}m`;
    return `${remainingMonths}m`;
  };

  const getPhoneAgeColor = (dateAssigned, status) => {
    if (!dateAssigned || status !== 'Active') return 'var(--text-secondary)';
    const months = getPhoneAgeMonths(dateAssigned);
    if (months >= UPGRADE_MONTHS) return '#e74c3c';
    if (months >= APPROACHING_MONTHS) return '#e67e22';
    if (months >= 12) return '#f39c12';
    return 'var(--success-color)';
  };

  const upgradesDue = assignments.filter(a => getUpgradeStatus(a) === 'due');
  const upgradesApproaching = assignments.filter(a => getUpgradeStatus(a) === 'approaching');

  useEffect(() => {
    fetchData();
  }, [showReturned]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assignmentsRes, personnelRes] = await Promise.all([
        cellphoneAssignmentsApi.getAll(!showReturned),
        personnelApi.getAll(true),
      ]);
      setAssignments(assignmentsRes.data || []);
      setPersonnel(personnelRes.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditItem(null);
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setShowModal(true);
  };



  const handleDelete = async (item) => {
    if (!window.confirm(`Delete this cellphone assignment record for ${item.employee_name}?`)) return;
    try {
      await cellphoneAssignmentsApi.delete(item.id);
      fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Build lookups for division from personnel (by name, partial name, and employee_id)
  const personnelDivisionMap = {};
  const personnelDivisionByIdMap = {};
  personnel.forEach(p => {
    if (p.full_name) personnelDivisionMap[p.full_name.toLowerCase()] = p.division || '';
    if (p.employee_id) personnelDivisionByIdMap[p.employee_id.toLowerCase()] = p.division || '';
  });

  // Known division abbreviations used in cellphone assignment notes
  const DIVISION_ABBREVS = { 'rs': 'RS', 'afs': 'AFS', 'gp': 'GP Consult', 'gp consult': 'GP Consult', 'wearcheck': 'RS' };

  // Standardise division names
  const standardiseDivision = (div) => {
    if (!div) return '';
    if (div === 'GP') return 'GP Consult';
    return div;
  };

  const getDivision = (item) => {
    // 1. Exact name match
    const byName = personnelDivisionMap[item.employee_name?.toLowerCase()];
    if (byName) return standardiseDivision(byName);
    // 2. Employee ID match
    if (item.employee_id) {
      const byId = personnelDivisionByIdMap[item.employee_id.toLowerCase()];
      if (byId) return standardiseDivision(byId);
    }
    // 3. Partial name match (e.g. "Arnold van Zyl" matches "Arnoldus van Zyl")
    if (item.employee_name) {
      const nameLower = item.employee_name.toLowerCase();
      const partialMatch = personnel.find(p => {
        if (!p.full_name) return false;
        const pName = p.full_name.toLowerCase();
        // Check if last name matches and first name starts similarly
        const nameParts = nameLower.split(' ');
        const pParts = pName.split(' ');
        if (nameParts.length >= 2 && pParts.length >= 2) {
          const lastName = nameParts.slice(1).join(' ');
          const pLastName = pParts.slice(1).join(' ');
          return lastName === pLastName && (pParts[0].startsWith(nameParts[0]) || nameParts[0].startsWith(pParts[0]));
        }
        return false;
      });
      if (partialMatch?.division) return standardiseDivision(partialMatch.division);
    }
    // 4. Fall back to notes field if it contains a known division abbreviation
    if (item.notes) {
      const notesLower = item.notes.toLowerCase().trim();
      if (DIVISION_ABBREVS[notesLower]) return DIVISION_ABBREVS[notesLower];
    }
    return '';
  };

  // Get unique divisions and brands for filter dropdowns
  // Include divisions from both personnel and assignment notes
  const personnelDivisions = personnel.map(p => p.division).filter(Boolean);
  const assignmentDivisions = assignments.map(a => getDivision(a)).filter(Boolean);
  const divisions = [...new Set([...personnelDivisions, ...assignmentDivisions])].sort();
  const brands = [...new Set(assignments.map(a => a.phone_brand).filter(Boolean))].sort();

  const filtered = assignments.filter(a => {
    if (statusFilter && a.phone_status !== statusFilter) return false;
    if (brandFilter && a.phone_brand !== brandFilter) return false;
    if (divisionFilter) {
      const empDiv = getDivision(a);
      if (empDiv !== divisionFilter) return false;
    }
    if (dateFrom && a.date_assigned < dateFrom) return false;
    if (dateTo && a.date_assigned > dateTo) return false;
    // Upgrade filter
    if (upgradeFilter === 'due' && getUpgradeStatus(a) !== 'due') return false;
    if (upgradeFilter === 'approaching' && getUpgradeStatus(a) !== 'approaching') return false;
    if (upgradeFilter === 'all-alerts' && getUpgradeStatus(a) === 'ok') return false;

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.employee_name?.toLowerCase().includes(term) ||
      a.phone_brand?.toLowerCase().includes(term) ||
      a.phone_model?.toLowerCase().includes(term) ||
      a.serial_number?.toLowerCase().includes(term) ||
      a.imei_number?.toLowerCase().includes(term) ||
      a.phone_number?.toLowerCase().includes(term) ||
      a.asset_tag?.toLowerCase().includes(term) ||
      a.network_provider?.toLowerCase().includes(term) ||
      a.sim_number?.toLowerCase().includes(term)
    );
  });

  // Column sorting
  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedFiltered = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let valA, valB;
      switch (sortCol) {
        case 'employee_name': valA = a.employee_name || ''; valB = b.employee_name || ''; break;
        case 'division': valA = getDivision(a); valB = getDivision(b); break;
        case 'phone': valA = `${a.phone_brand} ${a.phone_model}`; valB = `${b.phone_brand} ${b.phone_model}`; break;
        case 'phone_number': valA = a.phone_number || ''; valB = b.phone_number || ''; break;
        case 'date_assigned': valA = a.date_assigned || ''; valB = b.date_assigned || ''; break;
        case 'phone_age': valA = getPhoneAgeMonths(a.date_assigned); valB = getPhoneAgeMonths(b.date_assigned); return sortDir === 'asc' ? valA - valB : valB - valA;
        case 'status': valA = a.phone_status || ''; valB = b.phone_status || ''; break;
        case 'network': valA = a.network_provider || ''; valB = b.network_provider || ''; break;
        default: valA = a.employee_name || ''; valB = b.employee_name || '';
      }
      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  // Duplicate phone detection (employees with multiple active phones)
  const duplicatePhoneEmployees = useMemo(() => {
    const activeCounts = {};
    assignments.filter(a => a.phone_status === 'Active').forEach(a => {
      const name = a.employee_name?.toLowerCase();
      if (name && name !== 'spare') {
        activeCounts[name] = (activeCounts[name] || 0) + 1;
      }
    });
    return Object.entries(activeCounts).filter(([, count]) => count > 1).map(([name, count]) => ({ name, count }));
  }, [assignments]);

  // Division breakdown
  const divisionBreakdown = useMemo(() => {
    const counts = {};
    assignments.filter(a => a.phone_status === 'Active').forEach(a => {
      const div = getDivision(a) || 'Unassigned';
      counts[div] = (counts[div] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [assignments, personnel]);

  // Contract/Warranty alert helpers
  const getContractStatus = (item) => {
    if (!item.contract_end_date || item.phone_status !== 'Active') return 'ok';
    const end = new Date(item.contract_end_date);
    const now = new Date();
    const daysLeft = Math.floor((end - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return 'expired';
    if (daysLeft <= 90) return 'expiring';
    return 'ok';
  };

  const getWarrantyStatus = (item) => {
    if (!item.warranty_end_date || item.phone_status !== 'Active') return 'ok';
    const end = new Date(item.warranty_end_date);
    const now = new Date();
    const daysLeft = Math.floor((end - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return 'expired';
    if (daysLeft <= 90) return 'expiring';
    return 'ok';
  };

  const contractAlerts = assignments.filter(a => ['expired', 'expiring'].includes(getContractStatus(a)));
  const warrantyAlerts = assignments.filter(a => ['expired', 'expiring'].includes(getWarrantyStatus(a)));

  // Brand distribution
  const brandDistribution = useMemo(() => {
    const counts = {};
    assignments.filter(a => a.phone_status === 'Active').forEach(a => {
      const brand = a.phone_brand || 'Unknown';
      counts[brand] = (counts[brand] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [assignments]);

  const brandColors = { Samsung: '#1428A0', Huawei: '#CF0A2C', 'Rugged SA': '#2d8659', Apple: '#555', Nokia: '#005EB8', Xiaomi: '#FF6900' };

  // Cost-per-division summary
  const costPerDivision = useMemo(() => {
    const summary = {};
    assignments.filter(a => a.phone_status === 'Active').forEach(a => {
      const div = getDivision(a) || 'Unassigned';
      if (!summary[div]) summary[div] = { count: 0, totalDevice: 0, totalMonthly: 0 };
      summary[div].count++;
      if (a.device_cost) summary[div].totalDevice += Number(a.device_cost);
      if (a.monthly_cost) summary[div].totalMonthly += Number(a.monthly_cost);
    });
    return Object.entries(summary).sort((a, b) => b[1].totalMonthly - a[1].totalMonthly);
  }, [assignments, personnel]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedFiltered.slice(start, start + pageSize);
  }, [sortedFiltered, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, divisionFilter, brandFilter, dateFrom, dateTo, upgradeFilter, showReturned]);

  // Bulk selection
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

  // Table columns definition for visibility toggle
  const ALL_COLUMNS = [
    { key: 'employee', label: 'Employee' },
    { key: 'division', label: 'Division' },
    { key: 'phone', label: 'Phone' },
    { key: 'serial', label: 'Serial / IMEI' },
    { key: 'phone_number', label: 'Phone Number' },
    { key: 'network', label: 'Network' },
    { key: 'date_assigned', label: 'Date Assigned' },
    { key: 'phone_age', label: 'Phone Age' },
    { key: 'condition', label: 'Condition' },
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

  // Export handler
  const handleExport = (format) => {
    const exportColumns = [
      { label: 'Employee', accessor: 'employee_name' },
      { label: 'Employee ID', accessor: 'employee_id' },
      { label: 'Division', accessor: r => getDivision(r) || '' },
      { label: 'Phone Brand', accessor: 'phone_brand' },
      { label: 'Phone Model', accessor: 'phone_model' },
      { label: 'Serial Number', accessor: 'serial_number' },
      { label: 'IMEI', accessor: 'imei_number' },
      { label: 'Phone Number', accessor: 'phone_number' },
      { label: 'Network Provider', accessor: 'network_provider' },
      { label: 'SIM Number', accessor: 'sim_number' },
      { label: 'Date Assigned', accessor: r => r.date_assigned ? new Date(r.date_assigned).toLocaleDateString() : '' },
      { label: 'Phone Age', accessor: r => getPhoneAgeLabel(r.date_assigned) },
      { label: 'Upgrade Status', accessor: r => { const s = getUpgradeStatus(r); return s === 'due' ? 'UPGRADE DUE' : s === 'approaching' ? 'UPGRADE SOON' : 'OK'; } },
      { label: 'Status', accessor: 'phone_status' },
      { label: 'Device Cost (R)', accessor: r => r.device_cost ? Number(r.device_cost).toFixed(2) : '' },
      { label: 'Monthly Cost (R)', accessor: r => r.monthly_cost ? Number(r.monthly_cost).toFixed(2) : '' },
      { label: 'Contract End', accessor: r => r.contract_end_date ? new Date(r.contract_end_date).toLocaleDateString() : '' },
      { label: 'Warranty End', accessor: r => r.warranty_end_date ? new Date(r.warranty_end_date).toLocaleDateString() : '' },
      { label: 'Device Condition', accessor: 'device_condition' },
      { label: 'Data Plan', accessor: 'data_plan' },
      { label: 'Accessories', accessor: 'accessories' },
      { label: 'Insurance Policy', accessor: 'insurance_policy' },
      { label: 'Insurance Expiry', accessor: r => r.insurance_expiry ? new Date(r.insurance_expiry).toLocaleDateString() : '' },
      { label: 'Contract Start', accessor: r => r.contract_start_date ? new Date(r.contract_start_date).toLocaleDateString() : '' },
      { label: 'Notes', accessor: 'notes' },
    ];
    exportData(format, sortedFiltered, exportColumns, 'cellphone_assignments', 'Cellphone Assignments Report');
  };

  // Print handler
  const handlePrint = () => {
    const printContent = sortedFiltered.map(item => ({
      employee: item.employee_name || '',
      division: getDivision(item) || '',
      phone: `${item.phone_brand} ${item.phone_model}`,
      serial: item.serial_number || '',
      imei: item.imei_number || '',
      phoneNumber: item.phone_number || '',
      assigned: item.date_assigned ? new Date(item.date_assigned).toLocaleDateString() : '',
      age: getPhoneAgeLabel(item.date_assigned),
      status: item.phone_status || '',
    }));

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Cellphone Assignments</title>
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
      <h1>Cellphone Assignments Report</h1>
      <div class="subtitle">Generated: ${new Date().toLocaleDateString()} | Records: ${printContent.length}</div>
      <table>
        <thead><tr>
          <th>Employee</th><th>Division</th><th>Phone</th><th>Serial</th><th>Phone Number</th><th>Assigned</th><th>Age</th><th>Status</th>
        </tr></thead>
        <tbody>${printContent.map(r => `
          <tr><td>${r.employee}</td><td>${r.division}</td><td>${r.phone}</td><td style="font-family:monospace;font-size:10px">${r.serial}</td><td>${r.phoneNumber}</td><td>${r.assigned}</td><td>${r.age}</td><td>${r.status}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="footer">Equipment Store - Cellphone Assignments</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const SortHeader = ({ col, label }) => (
    <th onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {label} {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3 }}>▲</span>}
    </th>
  );

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading cellphone assignments...
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cellphone Assignments</h1>
          <p className="page-subtitle">Track company cellphones assigned to employees</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => handleExport('csv')} title="Export CSV">
            <Icons.Download size={14} /> CSV
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('excel')} title="Export Excel">
            <Icons.Download size={14} /> Excel
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('pdf')} title="Export PDF">
            <Icons.Download size={14} /> PDF
          </button>
          <button className="btn btn-secondary" onClick={handlePrint} title="Print">
            <Icons.Printer size={14} /> Print
          </button>
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
          {isAdminOrManager && (
            <button className="btn btn-primary" onClick={handleAdd}>
              + Assign Cellphone
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button className="btn btn-sm btn-secondary" onClick={fetchData} style={{ marginLeft: 'auto' }}>
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name, brand, model, serial, IMEI, number..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <select
            className="form-input"
            value={divisionFilter}
            onChange={e => setDivisionFilter(e.target.value)}
            style={{ minWidth: '140px' }}
          >
            <option value="">All Divisions</option>
            {divisions.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            className="form-input"
            value={brandFilter}
            onChange={e => setBrandFilter(e.target.value)}
            style={{ minWidth: '140px' }}
          >
            <option value="">All Brands</option>
            {brands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            className="form-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ minWidth: '140px' }}
          >
            <option value="">All Statuses</option>
            {PHONE_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={showReturned}
              onChange={e => setShowReturned(e.target.checked)}
            />
            Show inactive
          </label>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Assigned From:</label>
            <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '150px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>To:</label>
            <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '150px' }} />
          </div>
          <select
            className="form-input"
            value={upgradeFilter}
            onChange={e => setUpgradeFilter(e.target.value)}
            style={{ minWidth: '150px' }}
          >
            <option value="">All Upgrade Status</option>
            <option value="due">Due for Upgrade ({upgradesDue.length})</option>
            <option value="approaching">Approaching Upgrade ({upgradesApproaching.length})</option>
            <option value="all-alerts">All Alerts ({upgradesDue.length + upgradesApproaching.length})</option>
          </select>
          {(divisionFilter || brandFilter || dateFrom || dateTo || searchTerm || statusFilter || upgradeFilter) && (
            <button className="btn btn-sm" style={{ fontSize: '0.8rem' }} onClick={() => { setDivisionFilter(''); setBrandFilter(''); setDateFrom(''); setDateTo(''); setSearchTerm(''); setStatusFilter(''); setUpgradeFilter(''); }}>Clear Filters</button>
          )}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--success-color)' }}>
            {assignments.filter(a => a.phone_status === 'Active').length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Active</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center', cursor: 'pointer', border: upgradeFilter === 'due' ? '2px solid #e74c3c' : undefined }} onClick={() => setUpgradeFilter(upgradeFilter === 'due' ? '' : 'due')}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#e74c3c' }}>
            {upgradesDue.length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Upgrade Due</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center', cursor: 'pointer', border: upgradeFilter === 'approaching' ? '2px solid #e67e22' : undefined }} onClick={() => setUpgradeFilter(upgradeFilter === 'approaching' ? '' : 'approaching')}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#e67e22' }}>
            {upgradesApproaching.length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Upgrade Soon</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f39c12' }}>
            {assignments.filter(a => a.phone_status === 'Repairs').length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>In Repairs</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#e67e22' }}>
            {assignments.filter(a => a.phone_status === 'Damaged').length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Damaged</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--error-color)' }}>
            {assignments.filter(a => ['Stolen', 'Lost'].includes(a.phone_status)).length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Stolen / Lost</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {assignments.filter(a => ['Returned', 'Decommissioned'].includes(a.phone_status)).length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Returned / Decom.</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary-color)' }}>
            {assignments.length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total</div>
        </div>
        {contractAlerts.length > 0 && (
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#8e44ad' }}>
              {contractAlerts.length}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Contract Alerts</div>
          </div>
        )}
        {warrantyAlerts.length > 0 && (
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#2980b9' }}>
              {warrantyAlerts.length}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Warranty Alerts</div>
          </div>
        )}
      </div>

      {/* Upgrade Alert Banner */}
      {(upgradesDue.length > 0 || upgradesApproaching.length > 0) && (
        <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: upgradesDue.length > 0 ? '10px' : '0' }}>
            <Icons.Phone size={18} />
            <strong style={{ fontSize: '0.95rem' }}>Upgrade Alerts</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
              Based on 2-year upgrade cycle
            </span>
          </div>

          {upgradesDue.length > 0 && (
            <div style={{
              padding: '10px 14px',
              border: '1px solid #e74c3c',
              borderRadius: '8px',
              background: 'rgba(231, 76, 60, 0.08)',
              marginBottom: upgradesApproaching.length > 0 ? '8px' : '0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ color: '#e74c3c', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icons.Warning size={14} /> {upgradesDue.length} phone{upgradesDue.length !== 1 ? 's' : ''} due for upgrade
                </span>
                <button
                  className="btn btn-sm"
                  style={{ marginLeft: 'auto', fontSize: '0.75rem' }}
                  onClick={() => setUpgradeFilter('due')}
                >
                  Show in table
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {upgradesDue.slice(0, 8).map(a => (
                  <span key={a.id} style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(231, 76, 60, 0.15)',
                    color: '#c0392b',
                    whiteSpace: 'nowrap',
                  }}>
                    {a.employee_name} — {a.phone_brand} {a.phone_model} ({getPhoneAgeLabel(a.date_assigned)})
                  </span>
                ))}
                {upgradesDue.length > 8 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
                    +{upgradesDue.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}

          {upgradesApproaching.length > 0 && (
            <div style={{
              padding: '10px 14px',
              border: '1px solid #e67e22',
              borderRadius: '8px',
              background: 'rgba(230, 126, 34, 0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ color: '#e67e22', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icons.Clock size={14} /> {upgradesApproaching.length} phone{upgradesApproaching.length !== 1 ? 's' : ''} approaching upgrade (18-24 months)
                </span>
                <button
                  className="btn btn-sm"
                  style={{ marginLeft: 'auto', fontSize: '0.75rem' }}
                  onClick={() => setUpgradeFilter('approaching')}
                >
                  Show in table
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {upgradesApproaching.slice(0, 8).map(a => (
                  <span key={a.id} style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(230, 126, 34, 0.15)',
                    color: '#d35400',
                    whiteSpace: 'nowrap',
                  }}>
                    {a.employee_name} — {a.phone_brand} {a.phone_model} ({getPhoneAgeLabel(a.date_assigned)})
                  </span>
                ))}
                {upgradesApproaching.length > 8 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
                    +{upgradesApproaching.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contract/Warranty Alert Banner */}
      {(contractAlerts.length > 0 || warrantyAlerts.length > 0) && (
        <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Icons.Clipboard size={18} />
            <strong style={{ fontSize: '0.95rem' }}>Contract & Warranty Alerts</strong>
          </div>

          {contractAlerts.length > 0 && (
            <div style={{ padding: '10px 14px', border: '1px solid #8e44ad', borderRadius: '8px', background: 'rgba(142, 68, 173, 0.08)', marginBottom: warrantyAlerts.length > 0 ? '8px' : '0' }}>
              <div style={{ color: '#8e44ad', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icons.FileText size={14} /> {contractAlerts.length} contract{contractAlerts.length !== 1 ? 's' : ''} expiring/expired</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {contractAlerts.slice(0, 6).map(a => (
                  <span key={a.id} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(142, 68, 173, 0.15)', color: '#6c3483', whiteSpace: 'nowrap' }}>
                    {a.employee_name} — ends {new Date(a.contract_end_date).toLocaleDateString()}
                  </span>
                ))}
                {contractAlerts.length > 6 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>+{contractAlerts.length - 6} more</span>}
              </div>
            </div>
          )}

          {warrantyAlerts.length > 0 && (
            <div style={{ padding: '10px 14px', border: '1px solid #2980b9', borderRadius: '8px', background: 'rgba(41, 128, 185, 0.08)' }}>
              <div style={{ color: '#2980b9', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icons.Shield size={14} /> {warrantyAlerts.length} warrant{warrantyAlerts.length !== 1 ? 'ies' : 'y'} expiring/expired</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {warrantyAlerts.slice(0, 6).map(a => (
                  <span key={a.id} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(41, 128, 185, 0.15)', color: '#1a5276', whiteSpace: 'nowrap' }}>
                    {a.employee_name} — ends {new Date(a.warranty_end_date).toLocaleDateString()}
                  </span>
                ))}
                {warrantyAlerts.length > 6 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>+{warrantyAlerts.length - 6} more</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Duplicate Phone Alert */}
      {duplicatePhoneEmployees.length > 0 && (
        <div className="card" style={{ marginBottom: '16px', padding: '16px', border: '1px solid #f39c12' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Icons.Warning size={16} style={{ color: '#e67e22' }} />
            <strong style={{ fontSize: '0.9rem', color: '#e67e22' }}>Duplicate Active Phones Detected</strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {duplicatePhoneEmployees.map(d => (
              <span key={d.name} style={{ fontSize: '0.8rem', padding: '3px 10px', borderRadius: '12px', background: 'rgba(243, 156, 18, 0.15)', color: '#d35400' }}>
                {d.name} — {d.count} active phones
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Division Breakdown */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowDivisionBreakdown(!showDivisionBreakdown)}>
          <Icons.Building size={16} />
          <strong style={{ fontSize: '0.9rem' }}>Division Breakdown</strong>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({divisionBreakdown.length} divisions)</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{showDivisionBreakdown ? '▼' : '▶'}</span>
        </div>
        {showDivisionBreakdown && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {divisionBreakdown.map(([div, count]) => {
              const maxCount = divisionBreakdown[0]?.[1] || 1;
              return (
                <div key={div} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.85rem', minWidth: '120px', textAlign: 'right' }}>{div}</span>
                  <div style={{ flex: 1, background: 'var(--bg-secondary, #f0f0f0)', borderRadius: '4px', height: '20px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(count / maxCount) * 100}%`,
                      height: '100%',
                      background: 'var(--primary-color)',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                      minWidth: '2px',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '30px' }}>{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Brand Distribution */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowBrandChart(!showBrandChart)}>
          <Icons.Phone size={16} />
          <strong style={{ fontSize: '0.9rem' }}>Brand Distribution</strong>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({brandDistribution.length} brands)</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{showBrandChart ? '▼' : '▶'}</span>
        </div>
        {showBrandChart && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {brandDistribution.map(([brand, count]) => {
                const total = brandDistribution.reduce((s, [, c]) => s + c, 0);
                const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                const color = brandColors[brand] || '#666';
                return (
                  <div key={brand} style={{ textAlign: 'center', minWidth: '80px' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{count}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{brand}</div>
                    <div style={{ fontSize: '0.7rem', color }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
            {/* Stacked bar */}
            <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden' }}>
              {brandDistribution.map(([brand, count]) => {
                const total = brandDistribution.reduce((s, [, c]) => s + c, 0);
                const pct = total > 0 ? (count / total) * 100 : 0;
                const color = brandColors[brand] || '#666';
                return (
                  <div
                    key={brand}
                    title={`${brand}: ${count} (${pct.toFixed(1)}%)`}
                    style={{ width: `${pct}%`, background: color, minWidth: pct > 0 ? '2px' : '0', transition: 'width 0.3s ease' }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Cost Per Division Summary */}
      {costPerDivision.some(([, s]) => s.totalMonthly > 0 || s.totalDevice > 0) && (
        <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowCostSummary(!showCostSummary)}>
            <Icons.FileText size={16} />
            <strong style={{ fontSize: '0.9rem' }}>Cost Per Division</strong>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{showCostSummary ? '▼' : '▶'}</span>
          </div>
          {showCostSummary && (
            <div style={{ marginTop: '12px', overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Division</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Phones</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Device Cost (R)</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Monthly (R)</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Annual (R)</th>
                  </tr>
                </thead>
                <tbody>
                  {costPerDivision.map(([div, s]) => (
                    <tr key={div} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 8px' }}>{div}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.count}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.totalDevice > 0 ? `R ${s.totalDevice.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.totalMonthly > 0 ? `R ${s.totalMonthly.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{s.totalMonthly > 0 ? `R ${(s.totalMonthly * 12).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 8px' }}>Total</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{costPerDivision.reduce((s, [, d]) => s + d.count, 0)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>R {costPerDivision.reduce((s, [, d]) => s + d.totalDevice, 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>R {costPerDivision.reduce((s, [, d]) => s + d.totalMonthly, 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>R {(costPerDivision.reduce((s, [, d]) => s + d.totalMonthly, 0) * 12).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Column Visibility Toggle + Table Controls */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-sm btn-secondary" onClick={() => setShowColumnToggle(!showColumnToggle)}>
            <Icons.Settings size={14} /> Columns
          </button>
          {showColumnToggle && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 50,
              background: 'var(--bg-primary, white)', border: '1px solid var(--border-color)',
              borderRadius: '8px', padding: '8px', minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
              {ALL_COLUMNS.map(col => (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', cursor: 'pointer', fontSize: '0.8rem' }}>
                  <input type="checkbox" checked={isColVisible(col.key)} onChange={() => toggleColumn(col.key)} />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
        {isAdminOrManager && selectedIds.size > 0 && (
          <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 600 }}>{selectedIds.size} selected</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select className="form-input" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ width: '80px', fontSize: '0.8rem', padding: '4px' }}>
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {sortedFiltered.length === 0 ? (
          <div className="empty-state">
            <h3>No cellphone assignments found</h3>
            <p>{searchTerm ? 'Try a different search term' : 'Click "Assign Cellphone" to add the first record'}</p>
          </div>
        ) : (
          <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {isAdminOrManager && <th style={{ width: '36px' }}><input type="checkbox" checked={selectedIds.size === paginatedData.length && paginatedData.length > 0} onChange={toggleSelectAll} title="Select all on this page" /></th>}
                  {isColVisible('employee') && <SortHeader col="employee_name" label="Employee" />}
                  {isColVisible('division') && <SortHeader col="division" label="Division" />}
                  {isColVisible('phone') && <SortHeader col="phone" label="Phone" />}
                  {isColVisible('serial') && <th>Serial / IMEI</th>}
                  {isColVisible('phone_number') && <SortHeader col="phone_number" label="Phone Number" />}
                  {isColVisible('network') && <SortHeader col="network" label="Network" />}
                  {isColVisible('date_assigned') && <SortHeader col="date_assigned" label="Date Assigned" />}
                  {isColVisible('phone_age') && <SortHeader col="phone_age" label="Phone Age" />}
                  {isColVisible('condition') && <th>Condition</th>}
                  {isColVisible('status') && <SortHeader col="status" label="Status" />}
                  {isColVisible('actions') && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(item => (
                  <tr key={item.id} style={selectedIds.has(item.id) ? { background: 'rgba(52,152,219,0.08)' } : undefined}>
                    {isAdminOrManager && <td><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} /></td>}
                    {isColVisible('employee') && (
                    <td>
                      <div>
                        <strong>{item.employee_name}</strong>
                        {item.employee_id && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {item.employee_id}
                          </div>
                        )}
                        {item.employee_email && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            {item.employee_email}
                          </div>
                        )}
                      </div>
                    </td>
                    )}
                    {isColVisible('division') && (
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {getDivision(item) || '-'}
                      </span>
                    </td>
                    )}
                    {isColVisible('phone') && (
                    <td>
                      <div>
                        <strong>{item.phone_brand}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {item.phone_model}
                        </div>
                      </div>
                    </td>
                    )}
                    {isColVisible('serial') && (
                    <td>
                      <div>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{item.serial_number}</span>
                        {item.imei_number && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            IMEI: {item.imei_number}
                          </div>
                        )}
                      </div>
                    </td>
                    )}
                    {isColVisible('phone_number') && <td>{item.phone_number || '-'}</td>}
                    {isColVisible('network') && (
                    <td>
                      <div>
                        {item.network_provider && <div style={{ fontSize: '0.85rem' }}>{item.network_provider}</div>}
                        {item.sim_number && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>SIM: {item.sim_number}</div>}
                        {!item.network_provider && !item.sim_number && '-'}
                      </div>
                    </td>
                    )}
                    {isColVisible('date_assigned') && <td>{item.date_assigned ? new Date(item.date_assigned).toLocaleDateString() : '-'}</td>}
                    {isColVisible('phone_age') && (
                    <td>
                      {(() => {
                        const ageColor = getPhoneAgeColor(item.date_assigned, item.phone_status);
                        const upgradeStatus = getUpgradeStatus(item);
                        const ageLabel = getPhoneAgeLabel(item.date_assigned);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                            <span style={{
                              fontWeight: 600,
                              color: ageColor,
                              fontSize: '0.85rem',
                            }}>
                              {ageLabel}
                            </span>
                            {upgradeStatus === 'due' && (
                              <span style={{
                                fontSize: '0.65rem',
                                padding: '1px 6px',
                                borderRadius: '10px',
                                background: 'rgba(231, 76, 60, 0.15)',
                                color: '#e74c3c',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}>
                                UPGRADE DUE
                              </span>
                            )}
                            {upgradeStatus === 'approaching' && (
                              <span style={{
                                fontSize: '0.65rem',
                                padding: '1px 6px',
                                borderRadius: '10px',
                                background: 'rgba(230, 126, 34, 0.15)',
                                color: '#e67e22',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}>
                                UPGRADE SOON
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    )}
                    {isColVisible('condition') && (
                    <td>
                      {item.device_condition ? (
                        <span style={{
                          fontSize: '0.8rem',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: item.device_condition === 'Good' ? 'rgba(39,174,96,0.12)' :
                                     item.device_condition === 'Fair' ? 'rgba(243,156,18,0.12)' :
                                     item.device_condition === 'Poor' ? 'rgba(230,126,34,0.12)' :
                                     'rgba(231,76,60,0.12)',
                          color: item.device_condition === 'Good' ? '#27ae60' :
                                 item.device_condition === 'Fair' ? '#f39c12' :
                                 item.device_condition === 'Poor' ? '#e67e22' :
                                 '#e74c3c',
                          fontWeight: 600,
                        }}>
                          {item.device_condition}
                        </span>
                      ) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>-</span>}
                    </td>
                    )}
                    {isColVisible('status') && (
                    <td>
                      {(() => {
                        const st = PHONE_STATUSES.find(s => s.value === item.phone_status) || PHONE_STATUSES[0];
                        return <span className={`badge ${st.badge}`}>{st.label}</span>;
                      })()}
                      {item.phone_status === 'Returned' && item.date_returned && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          {new Date(item.date_returned).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    )}
                    {isColVisible('actions') && (
                    <td>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => setHistoryItem(item)} title="View History">
                          <Icons.Clock size={14} />
                        </button>
                        {isAdminOrManager && item.phone_status === 'Active' && (
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--primary-color)', color: 'white' }}
                            onClick={() => { setReassignItem(item); setShowReassignModal(true); }}
                            title="Reassign Phone"
                          >
                            <Icons.Users size={14} />
                          </button>
                        )}
                        {isAdminOrManager && (
                          <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(item)} title="Edit">
                            <Icons.Edit size={14} />
                          </button>
                        )}
                        {isAdminOrManager && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item)} title="Delete">
                            <Icons.Trash size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                    )}
                  </tr>
                ))}
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
                Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, sortedFiltered.length)} of {sortedFiltered.length}
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
                    p === '...' ? <span key={`dot-${i}`} style={{ padding: '0 4px', color: 'var(--text-secondary)' }}>…</span> :
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

      {/* Add/Edit Modal */}
      {showModal && (
        <CellphoneModal
          item={editItem}
          personnel={personnel}
          allAssignments={assignments}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          onSuccess={() => { setShowModal(false); setEditItem(null); fetchData(); }}
        />
      )}

      {/* Reassign Modal */}
      {showReassignModal && reassignItem && (
        <ReassignModal
          item={reassignItem}
          personnel={personnel}
          onClose={() => { setShowReassignModal(false); setReassignItem(null); }}
          onSuccess={() => { setShowReassignModal(false); setReassignItem(null); fetchData(); }}
        />
      )}

      {/* History Modal */}
      {historyItem && (
        <HistoryModal
          item={historyItem}
          onClose={() => setHistoryItem(null)}
        />
      )}

      {/* Bulk Status Modal */}
      {showBulkStatusModal && (
        <BulkStatusModal
          selectedIds={selectedIds}
          assignments={assignments}
          onClose={() => setShowBulkStatusModal(false)}
          onSuccess={() => { setShowBulkStatusModal(false); setSelectedIds(new Set()); fetchData(); }}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => { setShowImportModal(false); fetchData(); }}
        />
      )}
    </div>
  );
}

function CellphoneModal({ item, personnel, allAssignments, onClose, onSuccess }) {
  const [form, setForm] = useState({
    employee_name: item?.employee_name || '',
    employee_id: item?.employee_id || '',
    employee_email: item?.employee_email || '',
    phone_brand: item?.phone_brand || '',
    phone_model: item?.phone_model || '',
    serial_number: item?.serial_number || '',
    imei_number: item?.imei_number || '',
    phone_number: item?.phone_number || '',
    asset_tag: item?.asset_tag || '',
    date_assigned: item?.date_assigned || new Date().toISOString().split('T')[0],
    date_returned: item?.date_returned || '',
    phone_status: item?.phone_status || 'Active',
    is_active: item?.is_active ?? true,
    notes: item?.notes || '',
    device_cost: item?.device_cost || '',
    monthly_cost: item?.monthly_cost || '',
    contract_start_date: item?.contract_start_date || '',
    contract_end_date: item?.contract_end_date || '',
    warranty_end_date: item?.warranty_end_date || '',
    sim_number: item?.sim_number || '',
    network_provider: item?.network_provider || '',
    data_plan: item?.data_plan || '',
    device_condition: item?.device_condition || '',
    accessories: item?.accessories || '',
    insurance_policy: item?.insurance_policy || '',
    insurance_expiry: item?.insurance_expiry || '',
  });
  const [saving, setSaving] = useState(false);
  const [serialMatch, setSerialMatch] = useState(null);
  const [imeiError, setImeiError] = useState('');

  // IMEI Luhn check validation
  const validateIMEI = (imei) => {
    if (!imei) { setImeiError(''); return; }
    const digits = imei.replace(/\D/g, '');
    if (digits.length !== 15) { setImeiError('IMEI must be exactly 15 digits'); return; }
    // Luhn algorithm
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      let d = parseInt(digits[i], 10);
      if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    if (checkDigit !== parseInt(digits[14], 10)) {
      setImeiError('Invalid IMEI (Luhn check failed)');
    } else {
      setImeiError('');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSerialChange = (e) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, serial_number: val }));

    if (!item && val.length >= 3) {
      const normalised = val.replace(/[\s\-]/g, '').toLowerCase();
      const match = allAssignments.find(a => {
        const existingNorm = (a.serial_number || '').replace(/[\s\-]/g, '').toLowerCase();
        return existingNorm === normalised || existingNorm.includes(normalised) || normalised.includes(existingNorm);
      });
      setSerialMatch(match || null);
    } else {
      setSerialMatch(null);
    }
  };

  const handlePersonnelSelect = (e) => {
    const personId = e.target.value;
    const person = personnel.find(p => String(p.id) === personId);
    if (person) {
      setForm(prev => ({
        ...prev,
        employee_name: person.full_name,
        employee_id: person.employee_id || '',
        employee_email: person.email || '',
      }));
    } else {
      setForm(prev => ({ ...prev, employee_name: '', employee_id: '', employee_email: '' }));
    }
  };

  const handleReassign = async () => {
    if (!serialMatch) return;
    if (!form.employee_name) {
      alert('Please select an employee first');
      return;
    }
    if (!window.confirm(
      `This phone (${serialMatch.phone_brand} ${serialMatch.phone_model}, S/N: ${serialMatch.serial_number}) is currently assigned to ${serialMatch.employee_name}.\n\nReassign it to ${form.employee_name}?`
    )) return;

    try {
      setSaving(true);
      await cellphoneAssignmentsApi.reassign(serialMatch.id, {
        employee_name: form.employee_name,
        employee_id: form.employee_id,
        employee_email: form.employee_email,
        date_assigned: form.date_assigned,
        notes: form.notes || null,
      });
      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee_name || !form.phone_brand || !form.phone_model || !form.serial_number || !form.date_assigned) {
      alert('Please fill in all required fields');
      return;
    }
    if (imeiError) {
      alert('Please fix the IMEI number before saving');
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form };
      if (!payload.date_returned) delete payload.date_returned;
      if (!payload.asset_tag) payload.asset_tag = null;
      if (!payload.employee_email) payload.employee_email = null;
      if (!payload.imei_number) payload.imei_number = null;
      if (!payload.phone_number) payload.phone_number = null;
      if (!payload.notes) payload.notes = null;
      if (!payload.device_cost) payload.device_cost = null;
      if (!payload.monthly_cost) payload.monthly_cost = null;
      if (!payload.contract_start_date) payload.contract_start_date = null;
      if (!payload.contract_end_date) payload.contract_end_date = null;
      if (!payload.warranty_end_date) payload.warranty_end_date = null;
      if (!payload.sim_number) payload.sim_number = null;
      if (!payload.network_provider) payload.network_provider = null;
      if (!payload.data_plan) payload.data_plan = null;
      if (!payload.device_condition) payload.device_condition = null;
      if (!payload.accessories) payload.accessories = null;
      if (!payload.insurance_policy) payload.insurance_policy = null;
      if (!payload.insurance_expiry) payload.insurance_expiry = null;

      if (item) {
        // If status changed, use updateStatus to log history
        if (payload.phone_status !== item.phone_status) {
          await cellphoneAssignmentsApi.updateStatus(item.id, payload.phone_status);
          delete payload.phone_status;
          delete payload.is_active;
          delete payload.date_returned;
        }
        await cellphoneAssignmentsApi.update(item.id, payload);
      } else {
        await cellphoneAssignmentsApi.create(payload);
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
          <h2>{item ? 'Edit Cellphone Assignment' : 'Assign Cellphone'}</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            <Icons.Close size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="form-group">
              <label className="form-label">Employee *</label>
              <select
                name="employee_name"
                value={personnel.find(p => p.full_name === form.employee_name)?.id || ''}
                onChange={handlePersonnelSelect}
                className="form-input"
                required
              >
                <option value="">-- Select Employee --</option>
                {personnel.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}{p.employee_id ? ` (${p.employee_id})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Employee ID</label>
                <input
                  type="text"
                  name="employee_id"
                  value={form.employee_id}
                  className="form-input"
                  readOnly
                  style={{ backgroundColor: 'var(--bg-secondary, #f5f5f5)' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  name="employee_email"
                  value={form.employee_email}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Auto-filled from employee"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Serial Number *</label>
                <input
                  type="text"
                  name="serial_number"
                  value={form.serial_number}
                  onChange={handleSerialChange}
                  className="form-input"
                  placeholder="e.g. R58T12ABC"
                  required
                  readOnly={!!item}
                  style={item ? { backgroundColor: 'var(--bg-secondary, #f5f5f5)' } : {}}
                />
              </div>
              <div className="form-group">
                <label className="form-label">IMEI Number</label>
                <input
                  type="text"
                  name="imei_number"
                  value={form.imei_number}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 15);
                    setForm(prev => ({ ...prev, imei_number: val }));
                    validateIMEI(val);
                  }}
                  className="form-input"
                  placeholder="15-digit IMEI"
                  maxLength={15}
                  style={imeiError ? { borderColor: '#e74c3c' } : {}}
                />
                {imeiError && <div style={{ fontSize: '0.75rem', color: '#e74c3c', marginTop: '2px' }}>{imeiError}</div>}
                {form.imei_number && !imeiError && form.imei_number.length === 15 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--success-color)', marginTop: '2px' }}>Valid IMEI</div>
                )}
              </div>
            </div>

            {/* Serial number match warning */}
            {serialMatch && !item && (
              <div style={{
                padding: '12px',
                border: '2px solid #f39c12',
                borderRadius: '8px',
                background: 'rgba(243, 156, 18, 0.1)',
              }}>
                <div style={{ fontWeight: 600, marginBottom: '6px', color: '#f39c12' }}>
                  Existing phone found!
                </div>
                <div style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                  <strong>{serialMatch.phone_brand} {serialMatch.phone_model}</strong> (S/N: {serialMatch.serial_number})
                  <br />
                  Currently assigned to: <strong>{serialMatch.employee_name}</strong>
                  {serialMatch.phone_status && <> — Status: <strong>{serialMatch.phone_status}</strong></>}
                </div>
                {form.employee_name && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={handleReassign}
                    disabled={saving}
                  >
                    {saving ? 'Reassigning...' : `Reassign to ${form.employee_name}`}
                  </button>
                )}
                {!form.employee_name && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Select an employee above to reassign this phone
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Phone Brand *</label>
                <select
                  name="phone_brand"
                  value={form.phone_brand}
                  onChange={handleChange}
                  className="form-input"
                  required={!serialMatch}
                >
                  <option value="">-- Select Brand --</option>
                  {getAssetConfig().phoneBrands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phone Model *</label>
                <input
                  type="text"
                  name="phone_model"
                  value={form.phone_model}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. Galaxy S24 Ultra"
                  required={!serialMatch}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. +27 82 123 4567"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Asset Tag</label>
                <input
                  type="text"
                  name="asset_tag"
                  value={form.asset_tag}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Date Assigned *</label>
                <input
                  type="date"
                  name="date_assigned"
                  value={form.date_assigned}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date Returned</label>
                <input
                  type="date"
                  name="date_returned"
                  value={form.date_returned}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Phone Status</label>
              <select
                name="phone_status"
                value={form.phone_status}
                onChange={(e) => {
                  const val = e.target.value;
                  const inactiveStatuses = ['Returned', 'Stolen', 'Lost', 'Decommissioned'];
                  setForm(prev => ({
                    ...prev,
                    phone_status: val,
                    is_active: !inactiveStatuses.includes(val),
                    ...(val === 'Returned' && !prev.date_returned ? { date_returned: new Date().toISOString().split('T')[0] } : {}),
                  }));
                }}
                className="form-input"
              >
                {[
                  { value: 'Active', label: 'Active' },
                  { value: 'Returned', label: 'Returned' },
                  { value: 'Stolen', label: 'Stolen' },
                  { value: 'Damaged', label: 'Damaged' },
                  { value: 'Repairs', label: 'Sent for Repairs' },
                  { value: 'Lost', label: 'Lost' },
                  { value: 'Decommissioned', label: 'Decommissioned' },
                ].map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                className="form-input"
                rows="2"
                placeholder="Any additional notes"
              />
            </div>

            {/* SIM & Network */}
            <div style={{ borderTop: '1px solid var(--border-color, #e0e0e0)', paddingTop: '12px', marginTop: '4px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>SIM & Network</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Network Provider</label>
                  <select
                    name="network_provider"
                    value={form.network_provider}
                    onChange={handleChange}
                    className="form-input"
                  >
                    <option value="">-- Select --</option>
                    {['Vodacom', 'MTN', 'Cell C', 'Telkom', 'Rain', 'Other'].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">SIM Number</label>
                  <input
                    type="text"
                    name="sim_number"
                    value={form.sim_number}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="SIM card number"
                  />
                </div>
              </div>
            </div>

            {/* Cost Tracking */}
            <div style={{ borderTop: '1px solid var(--border-color, #e0e0e0)', paddingTop: '12px', marginTop: '4px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Cost Tracking</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Device Cost (R)</label>
                  <input
                    type="number"
                    name="device_cost"
                    value={form.device_cost}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="e.g. 15999.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Monthly Cost (R)</label>
                  <input
                    type="number"
                    name="monthly_cost"
                    value={form.monthly_cost}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="e.g. 599.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            {/* Contract & Warranty */}
            <div style={{ borderTop: '1px solid var(--border-color, #e0e0e0)', paddingTop: '12px', marginTop: '4px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Contract & Warranty</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Contract Start Date</label>
                  <input
                    type="date"
                    name="contract_start_date"
                    value={form.contract_start_date}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contract End Date</label>
                  <input
                    type="date"
                    name="contract_end_date"
                    value={form.contract_end_date}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                <div className="form-group">
                  <label className="form-label">Warranty End Date</label>
                  <input
                    type="date"
                    name="warranty_end_date"
                    value={form.warranty_end_date}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Data Plan</label>
                  <input
                    type="text"
                    name="data_plan"
                    value={form.data_plan}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="e.g. 10GB monthly"
                  />
                </div>
              </div>
            </div>

            {/* Device Condition & Accessories */}
            <div style={{ borderTop: '1px solid var(--border-color, #e0e0e0)', paddingTop: '12px', marginTop: '4px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Device Condition & Accessories</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Device Condition</label>
                  <select
                    name="device_condition"
                    value={form.device_condition}
                    onChange={handleChange}
                    className="form-input"
                  >
                    <option value="">-- Select --</option>
                    {['Good', 'Fair', 'Poor', 'Damaged'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Accessories</label>
                  <input
                    type="text"
                    name="accessories"
                    value={form.accessories}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Charger, Case, Screen Protector"
                  />
                </div>
              </div>
            </div>

            {/* Insurance */}
            <div style={{ borderTop: '1px solid var(--border-color, #e0e0e0)', paddingTop: '12px', marginTop: '4px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Insurance</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Policy Number</label>
                  <input
                    type="text"
                    name="insurance_policy"
                    value={form.insurance_policy}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Insurance policy number"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Insurance Expiry</label>
                  <input
                    type="date"
                    name="insurance_expiry"
                    value={form.insurance_expiry}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            {!serialMatch && (
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : (item ? 'Update' : 'Assign Cellphone')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function ReassignModal({ item, personnel, onClose, onSuccess }) {
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [notes, setNotes] = useState('');
  const [dateAssigned, setDateAssigned] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const handlePersonSelect = (e) => {
    const personId = e.target.value;
    const person = personnel.find(p => String(p.id) === personId);
    setSelectedPerson(person || null);
  };

  const handleReassign = async () => {
    if (!selectedPerson) {
      alert('Please select an employee to reassign to');
      return;
    }
    if (!window.confirm(
      `Reassign ${item.phone_brand} ${item.phone_model} (S/N: ${item.serial_number}) from ${item.employee_name} to ${selectedPerson.full_name}?`
    )) return;

    try {
      setSaving(true);
      await cellphoneAssignmentsApi.reassign(item.id, {
        employee_name: selectedPerson.full_name,
        employee_id: selectedPerson.employee_id || '',
        employee_email: selectedPerson.email || '',
        date_assigned: dateAssigned,
        notes: notes || null,
      });
      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2>Reassign Cellphone</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            <Icons.Close size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Current assignment info */}
          <div style={{
            padding: '12px',
            background: 'var(--bg-secondary, #f5f5f5)',
            borderRadius: '8px',
          }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>CURRENTLY ASSIGNED TO</div>
            <strong>{item.employee_name}</strong>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {item.phone_brand} {item.phone_model} | S/N: {item.serial_number}
            </div>
            {item.phone_number && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Phone: {item.phone_number}
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', fontSize: '1.2rem', color: 'var(--text-secondary)' }}>↓</div>

          {/* New assignment */}
          <div className="form-group">
            <label className="form-label">Reassign To *</label>
            <select
              className="form-input"
              onChange={handlePersonSelect}
              value={selectedPerson ? String(personnel.find(p => p.full_name === selectedPerson.full_name)?.id || '') : ''}
            >
              <option value="">-- Select Employee --</option>
              {personnel
                .filter(p => p.full_name !== item.employee_name)
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}{p.employee_id ? ` (${p.employee_id})` : ''}{p.division ? ` — ${p.division}` : ''}
                  </option>
                ))}
            </select>
          </div>

          {selectedPerson && (
            <div style={{
              padding: '10px',
              border: '1px solid var(--primary-color)',
              borderRadius: '8px',
              background: 'rgba(52, 152, 219, 0.05)',
              fontSize: '0.85rem',
            }}>
              <strong>{selectedPerson.full_name}</strong>
              {selectedPerson.employee_id && <span> ({selectedPerson.employee_id})</span>}
              {selectedPerson.email && <div style={{ color: 'var(--text-secondary)' }}>{selectedPerson.email}</div>}
              {selectedPerson.division && <div style={{ color: 'var(--text-secondary)' }}>Division: {selectedPerson.division}</div>}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">New Assignment Date *</label>
            <input
              type="date"
              className="form-input"
              value={dateAssigned}
              onChange={e => setDateAssigned(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Reassignment Notes</label>
            <textarea
              className="form-input"
              rows="2"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Reason for reassignment (optional)"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleReassign}
            disabled={saving || !selectedPerson}
          >
            {saving ? 'Reassigning...' : 'Reassign Phone'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ item, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cellphoneAssignmentsApi.getHistory(item.id)
      .then(res => setHistory(res.data || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [item.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>Cellphone History</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            <Icons.Close size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px' }}>
            <strong>{item.phone_brand} {item.phone_model}</strong>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              S/N: {item.serial_number} {item.imei_number ? `| IMEI: ${item.imei_number}` : ''}
            </div>
            <div style={{ fontSize: '0.85rem' }}>
              Currently: <strong>{item.employee_name}</strong> — {item.phone_status || 'Active'}
            </div>
          </div>

          {loading ? (
            <div className="loading"><div className="spinner"></div> Loading history...</div>
          ) : history.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px' }}>
              <p>No history records yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.map(h => (
                <div key={h.id} style={{
                  padding: '10px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{h.action}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {new Date(h.performed_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {h.employee_name}{h.employee_id ? ` (${h.employee_id})` : ''}
                  </div>
                  {h.notes && <div style={{ marginTop: '4px', fontStyle: 'italic' }}>{h.notes}</div>}
                </div>
              ))}
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

// ── Bulk Status Update Modal ──
function BulkStatusModal({ selectedIds, assignments, onClose, onSuccess }) {
  const [newStatus, setNewStatus] = useState('Returned');
  const [condition, setCondition] = useState('Good');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: [] });

  const selected = assignments.filter(a => selectedIds.has(a.id));

  const handleBulkUpdate = async () => {
    setProcessing(true);
    const total = selected.length;
    const errors = [];
    let done = 0;
    setProgress({ done: 0, total, errors: [] });

    for (const item of selected) {
      try {
        await cellphoneAssignmentsApi.updateStatus(item.id, newStatus);
        await cellphoneAssignmentsApi.update(item.id, {
          ...item,
          phone_status: newStatus,
          device_condition: condition,
          notes: notes || `Bulk status update to ${newStatus}`,
          ...(newStatus === 'Returned' ? { date_returned: new Date().toISOString().split('T')[0] } : {}),
        });
      } catch (err) {
        errors.push(`${item.employee_name}: ${err.message}`);
      }
      done++;
      setProgress({ done, total, errors: [...errors] });
    }

    if (errors.length === 0) {
      onSuccess();
    } else {
      setProcessing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Bulk Status Update ({selected.length} phones)</h3>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(52,152,219,0.08)', borderRadius: '8px', fontSize: '0.85rem' }}>
            <strong>Selected phones:</strong>
            <div style={{ maxHeight: '100px', overflowY: 'auto', marginTop: '4px' }}>
              {selected.map(s => (
                <div key={s.id}>{s.employee_name} — {s.phone_brand} {s.phone_model}</div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>New Status</label>
            <select className="form-control" value={newStatus} onChange={e => setNewStatus(e.target.value)} disabled={processing}>
              {PHONE_STATUSES.filter(s => s.value !== 'Active').map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Device Condition</label>
            <select className="form-control" value={condition} onChange={e => setCondition(e.target.value)} disabled={processing}>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
              <option value="Damaged">Damaged</option>
            </select>
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <input className="form-control" value={notes} onChange={e => setNotes(e.target.value)} disabled={processing} placeholder="Reason for status change" />
          </div>

          {processing && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span>Processing...</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div style={{ background: 'var(--border-color)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${(progress.done / progress.total) * 100}%`, height: '100%', background: 'var(--primary-color)', transition: 'width 0.3s' }} />
              </div>
              {progress.errors.length > 0 && (
                <div style={{ marginTop: '8px', color: '#e74c3c', fontSize: '0.8rem' }}>
                  {progress.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={processing}>Cancel</button>
          <button className="btn btn-primary" onClick={handleBulkUpdate} disabled={processing}>
            {processing ? `Updating ${progress.done}/${progress.total}...` : `Update ${selected.length} Phones`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Import Modal ──
function ImportModal({ onClose, onSuccess }) {
  const [parsedRows, setParsedRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: [] });
  const [parseError, setParseError] = useState('');

  const EXPECTED_HEADERS = ['employee_name', 'phone_brand', 'phone_model', 'serial_number'];
  const ALL_HEADERS = [
    'employee_name', 'phone_brand', 'phone_model', 'serial_number',
    'employee_id', 'employee_email', 'phone_number', 'imei_number', 'asset_tag',
    'date_assigned', 'phone_status', 'network_provider', 'sim_number',
    'device_cost', 'monthly_cost', 'contract_end_date', 'warranty_end_date',
    'data_plan', 'device_condition', 'accessories', 'insurance_policy', 'insurance_expiry'
  ];

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([ALL_HEADERS]);
    ws['!cols'] = ALL_HEADERS.map(h => ({ wch: Math.max(h.length + 2, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cellphone Assignments');
    XLSX.writeFile(wb, 'cellphone_assignments_template.xlsx');
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setParseError('');
    setParsedRows([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setParseError('File must have a header row and at least one data row'); return; }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/['"]/g, ''));
        const missing = EXPECTED_HEADERS.filter(h => !headers.includes(h));
        if (missing.length > 0) { setParseError(`Missing required columns: ${missing.join(', ')}`); return; }

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
          if (values.length < headers.length) continue;
          const row = {};
          headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
          if (row.employee_name && row.phone_brand) rows.push(row);
        }
        setParsedRows(rows);
      } catch (err) {
        setParseError('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    setImporting(true);
    const total = parsedRows.length;
    const errors = [];
    let done = 0;
    setProgress({ done: 0, total, errors: [] });

    for (const row of parsedRows) {
      try {
        await cellphoneAssignmentsApi.create({
          employee_name: row.employee_name,
          employee_id: row.employee_id || '',
          employee_email: row.employee_email || '',
          phone_brand: row.phone_brand,
          phone_model: row.phone_model || '',
          serial_number: row.serial_number || '',
          imei_number: row.imei_number || '',
          phone_number: row.phone_number || '',
          asset_tag: row.asset_tag || '',
          date_assigned: row.date_assigned || new Date().toISOString().split('T')[0],
          phone_status: row.phone_status || 'Active',
          network_provider: row.network_provider || '',
          sim_number: row.sim_number || '',
          device_cost: row.device_cost ? parseFloat(row.device_cost) : null,
          monthly_cost: row.monthly_cost ? parseFloat(row.monthly_cost) : null,
          contract_end_date: row.contract_end_date || null,
          warranty_end_date: row.warranty_end_date || null,
          data_plan: row.data_plan || null,
          contract_start_date: row.contract_start_date || null,
          device_condition: row.device_condition || null,
          accessories: row.accessories || null,
          insurance_policy: row.insurance_policy || null,
          insurance_expiry: row.insurance_expiry || null,
        });
      } catch (err) {
        errors.push(`Row ${done + 1} (${row.employee_name}): ${err.message}`);
      }
      done++;
      setProgress({ done, total, errors: [...errors] });
    }

    if (errors.length === 0) {
      onSuccess();
    } else {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><Icons.Upload size={18} /> Import Cellphone Assignments</h3>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(52,152,219,0.08)', borderRadius: '8px', fontSize: '0.83rem' }}>
            <strong>CSV Format:</strong> File must include headers. Required columns: <code>employee_name</code>, <code>phone_brand</code>, <code>phone_model</code>, <code>serial_number</code>.
            <br />Optional: employee_id, employee_email, phone_number, imei_number, asset_tag, date_assigned, phone_status, network_provider, sim_number, device_cost, monthly_cost, contract_end_date, warranty_end_date, data_plan, device_condition, accessories, insurance_policy, insurance_expiry
            <div style={{ marginTop: '8px' }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={downloadTemplate} style={{ fontSize: '0.8rem' }}>
                <Icons.Download size={14} /> Download Template
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Select CSV File</label>
            <input type="file" accept=".csv" className="form-control" onChange={handleFileChange} disabled={importing} />
          </div>

          {parseError && <div style={{ color: '#e74c3c', fontSize: '0.85rem', marginBottom: '8px' }}><Icons.Warning size={14} /> {parseError}</div>}

          {parsedRows.length > 0 && (
            <div>
              <strong style={{ fontSize: '0.9rem' }}>{parsedRows.length} records ready to import</strong>
              <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto', marginTop: '8px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Employee</th>
                      <th>Phone</th>
                      <th>Serial</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 50).map((row, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{row.employee_name}</td>
                        <td>{row.phone_brand} {row.phone_model}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.serial_number}</td>
                        <td>{row.phone_status || 'Active'}</td>
                      </tr>
                    ))}
                    {parsedRows.length > 50 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>...and {parsedRows.length - 50} more</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importing && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span>Importing...</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div style={{ background: 'var(--border-color)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${(progress.done / progress.total) * 100}%`, height: '100%', background: '#27ae60', transition: 'width 0.3s' }} />
              </div>
              {progress.errors.length > 0 && (
                <div style={{ marginTop: '8px', color: '#e74c3c', fontSize: '0.8rem', maxHeight: '100px', overflowY: 'auto' }}>
                  {progress.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={importing}>Cancel</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={importing || parsedRows.length === 0}>
            {importing ? `Importing ${progress.done}/${progress.total}...` : `Import ${parsedRows.length} Records`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CellphoneAssignments;
