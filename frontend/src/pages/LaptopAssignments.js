import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { laptopAssignmentsApi, personnelApi } from '../services/api';
import * as XLSX from 'xlsx';
import { useOperator } from '../context/OperatorContext';
import { Icons } from '../components/Icons';
import { getAssetConfig } from './Settings';
import { exportData } from '../services/exportUtils';

function LaptopAssignments() {
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
  const [sortCol, setSortCol] = useState('employee_name');
  const [sortDir, setSortDir] = useState('asc');
  const [showDivisionBreakdown, setShowDivisionBreakdown] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignItem, setReassignItem] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBrandChart, setShowBrandChart] = useState(false);
  const [showCostSummary, setShowCostSummary] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [hiddenColumns, setHiddenColumns] = useState(new Set());
  const [showColumnToggle, setShowColumnToggle] = useState(false);

  const LAPTOP_STATUSES = [
    { value: 'Active', label: 'Active', badge: 'badge-available', color: 'var(--success-color)' },
    { value: 'Returned', label: 'Returned', badge: 'badge-checked-out', color: 'var(--text-secondary)' },
    { value: 'Stolen', label: 'Stolen', badge: 'badge-overdue', color: 'var(--error-color)' },
    { value: 'Damaged', label: 'Damaged', badge: 'badge-overdue', color: '#e67e22' },
    { value: 'Repairs', label: 'Sent for Repairs', badge: 'badge-low-stock', color: '#f39c12' },
    { value: 'Lost', label: 'Lost', badge: 'badge-overdue', color: 'var(--error-color)' },
    { value: 'Decommissioned', label: 'Decommissioned', badge: 'badge-checked-out', color: 'var(--text-secondary)' },
  ];

  // Laptop age helpers
  const getLaptopAgeMonths = (dateAssigned) => {
    if (!dateAssigned) return 0;
    const assigned = new Date(dateAssigned);
    const now = new Date();
    return (now.getFullYear() - assigned.getFullYear()) * 12 + (now.getMonth() - assigned.getMonth());
  };

  const getLaptopAgeLabel = (dateAssigned) => {
    if (!dateAssigned) return '-';
    const months = getLaptopAgeMonths(dateAssigned);
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years > 0) return `${years}y ${remainingMonths}m`;
    return `${remainingMonths}m`;
  };

  const getLaptopAgeColor = (dateAssigned, status) => {
    if (!dateAssigned || status !== 'Active') return 'var(--text-secondary)';
    const months = getLaptopAgeMonths(dateAssigned);
    if (months >= 48) return '#e74c3c';
    if (months >= 36) return '#e67e22';
    if (months >= 24) return '#f39c12';
    return 'var(--success-color)';
  };

  // Upgrade/refresh cycle helpers (4 year lifecycle)
  const getUpgradeStatus = (item) => {
    if (!item.date_assigned || item.laptop_status !== 'Active') return 'ok';
    const months = getLaptopAgeMonths(item.date_assigned);
    if (months >= 48) return 'due';
    if (months >= 36) return 'approaching';
    return 'ok';
  };

  useEffect(() => {
    fetchData();
  }, [showReturned]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assignmentsRes, personnelRes] = await Promise.all([
        laptopAssignmentsApi.getAll(!showReturned),
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
    if (!window.confirm(`Delete this laptop assignment record for ${item.employee_name}?`)) return;
    try {
      await laptopAssignmentsApi.delete(item.id);
      fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Division lookup from personnel
  const personnelDivisionMap = {};
  personnel.forEach(p => {
    if (p.full_name) personnelDivisionMap[p.full_name.toLowerCase()] = p.division || '';
  });

  const DIVISION_ABBREVS = { 'rs': 'RS', 'afs': 'AFS', 'gp': 'GP Consult', 'gp consult': 'GP Consult' };

  const standardiseDivision = (div) => {
    if (!div) return '';
    if (div === 'GP') return 'GP Consult';
    return div;
  };

  const getDivision = (item) => {
    const byName = personnelDivisionMap[item.employee_name?.toLowerCase()];
    if (byName) return standardiseDivision(byName);
    if (item.employee_name) {
      const nameLower = item.employee_name.toLowerCase();
      const partialMatch = personnel.find(p => {
        if (!p.full_name) return false;
        const pName = p.full_name.toLowerCase();
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
    if (item.notes) {
      const notesLower = item.notes.toLowerCase().trim();
      if (DIVISION_ABBREVS[notesLower]) return DIVISION_ABBREVS[notesLower];
    }
    return '';
  };

  // Unique divisions and brands for filters
  const personnelDivisions = personnel.map(p => p.division).filter(Boolean);
  const assignmentDivisions = assignments.map(a => getDivision(a)).filter(Boolean);
  const divisions = [...new Set([...personnelDivisions, ...assignmentDivisions])].sort();
  const brands = [...new Set(assignments.map(a => a.laptop_brand).filter(Boolean))].sort();

  const filtered = assignments.filter(a => {
    if (statusFilter && a.laptop_status !== statusFilter) return false;
    if (brandFilter && a.laptop_brand !== brandFilter) return false;
    if (divisionFilter) {
      const empDiv = getDivision(a);
      if (empDiv !== divisionFilter) return false;
    }
    if (dateFrom && a.date_assigned < dateFrom) return false;
    if (dateTo && a.date_assigned > dateTo) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.employee_name?.toLowerCase().includes(term) ||
      a.laptop_brand?.toLowerCase().includes(term) ||
      a.laptop_model?.toLowerCase().includes(term) ||
      a.serial_number?.toLowerCase().includes(term) ||
      a.asset_tag?.toLowerCase().includes(term)
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
        case 'laptop': valA = `${a.laptop_brand} ${a.laptop_model}`; valB = `${b.laptop_brand} ${b.laptop_model}`; break;
        case 'date_assigned': valA = a.date_assigned || ''; valB = b.date_assigned || ''; break;
        case 'laptop_age': valA = getLaptopAgeMonths(a.date_assigned); valB = getLaptopAgeMonths(b.date_assigned); return sortDir === 'asc' ? valA - valB : valB - valA;
        case 'status': valA = a.laptop_status || ''; valB = b.laptop_status || ''; break;
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

  // Division breakdown
  const divisionBreakdown = useMemo(() => {
    const counts = {};
    assignments.filter(a => a.laptop_status === 'Active').forEach(a => {
      const div = getDivision(a) || 'Unassigned';
      counts[div] = (counts[div] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [assignments, personnel]);

  // Brand distribution
  const brandDistribution = useMemo(() => {
    const counts = {};
    assignments.filter(a => a.laptop_status === 'Active').forEach(a => {
      const brand = a.laptop_brand || 'Unknown';
      counts[brand] = (counts[brand] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [assignments]);

  const brandColors = { 'Lenovo': '#E2231A', 'Dell': '#007DB8', 'HP': '#0096D6', 'Asus': '#00539B', 'Acer': '#83B81A', 'Apple': '#555', 'Microsoft': '#00A4EF', 'Huawei': '#CF0A2C' };

  // Cost per division
  const costPerDivision = useMemo(() => {
    const map = {};
    assignments.filter(a => a.laptop_status === 'Active').forEach(a => {
      const div = getDivision(a) || 'Unassigned';
      if (!map[div]) map[div] = { count: 0, totalDevice: 0, totalMonthly: 0 };
      map[div].count++;
      if (a.device_cost) map[div].totalDevice += Number(a.device_cost);
      if (a.monthly_cost) map[div].totalMonthly += Number(a.monthly_cost);
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [assignments, personnel]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedFiltered.slice(start, start + pageSize);
  }, [sortedFiltered, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, divisionFilter, brandFilter, statusFilter, dateFrom, dateTo, showReturned]);

  // Bulk selection
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === paginatedData.length) return new Set();
      return new Set(paginatedData.map(i => i.id));
    });
  }, [paginatedData]);

  // Column visibility
  const ALL_COLUMNS = [
    { key: 'employee', label: 'Employee' },
    { key: 'division', label: 'Division' },
    { key: 'laptop', label: 'Laptop' },
    { key: 'serial', label: 'Serial / Asset Tag' },
    { key: 'date_assigned', label: 'Date Assigned' },
    { key: 'laptop_age', label: 'Age' },
    { key: 'condition', label: 'Condition' },
    { key: 'setup', label: 'Setup' },
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
      { label: 'Laptop Brand', accessor: 'laptop_brand' },
      { label: 'Laptop Model', accessor: 'laptop_model' },
      { label: 'Serial Number', accessor: 'serial_number' },
      { label: 'Asset Tag', accessor: 'asset_tag' },
      { label: 'Date Assigned', accessor: r => r.date_assigned ? new Date(r.date_assigned).toLocaleDateString() : '' },
      { label: 'Laptop Age', accessor: r => getLaptopAgeLabel(r.date_assigned) },
      { label: 'Status', accessor: 'laptop_status' },
      { label: 'Laptop Setup', accessor: r => r.setup_laptop ? 'Yes' : 'No' },
      { label: 'M365', accessor: r => r.setup_m365 ? 'Yes' : 'No' },
      { label: 'Adobe', accessor: r => r.setup_adobe ? 'Yes' : 'No' },
      { label: 'Zoho', accessor: r => r.setup_zoho ? 'Yes' : 'No' },
      { label: 'Smartsheet', accessor: r => r.setup_smartsheet ? 'Yes' : 'No' },
      { label: 'Dist. Lists', accessor: r => r.setup_distribution_lists ? 'Yes' : 'No' },
      { label: 'Device Cost (R)', accessor: r => r.device_cost ? Number(r.device_cost).toFixed(2) : '' },
      { label: 'Monthly Cost (R)', accessor: r => r.monthly_cost ? Number(r.monthly_cost).toFixed(2) : '' },
      { label: 'Warranty End', accessor: r => r.warranty_end_date ? new Date(r.warranty_end_date).toLocaleDateString() : '' },
      { label: 'Contract Start', accessor: r => r.contract_start_date ? new Date(r.contract_start_date).toLocaleDateString() : '' },
      { label: 'Contract End', accessor: r => r.contract_end_date ? new Date(r.contract_end_date).toLocaleDateString() : '' },
      { label: 'Device Condition', accessor: 'device_condition' },
      { label: 'Accessories', accessor: 'accessories' },
      { label: 'Insurance Policy', accessor: 'insurance_policy' },
      { label: 'Insurance Expiry', accessor: r => r.insurance_expiry ? new Date(r.insurance_expiry).toLocaleDateString() : '' },
      { label: 'Notes', accessor: 'notes' },
    ];
    exportData(format, sortedFiltered, exportColumns, 'laptop_assignments', 'Laptop Assignments Report');
  };

  // Print handler
  const handlePrint = () => {
    const printContent = sortedFiltered.map(item => ({
      employee: item.employee_name || '',
      division: getDivision(item) || '',
      laptop: `${item.laptop_brand} ${item.laptop_model}`,
      serial: item.serial_number || '',
      assetTag: item.asset_tag || '',
      assigned: item.date_assigned ? new Date(item.date_assigned).toLocaleDateString() : '',
      age: getLaptopAgeLabel(item.date_assigned),
      status: item.laptop_status || '',
      setup: [
        item.setup_laptop && 'Laptop',
        item.setup_m365 && 'M365',
        item.setup_adobe && 'Adobe',
        item.setup_zoho && 'Zoho',
        item.setup_smartsheet && 'Smart',
        item.setup_distribution_lists && 'DLists',
      ].filter(Boolean).join(', ') || '-',
    }));

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Laptop Assignments</title>
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
      <h1>Laptop Assignments Report</h1>
      <div class="subtitle">Generated: ${new Date().toLocaleDateString()} | Records: ${printContent.length}</div>
      <table>
        <thead><tr>
          <th>Employee</th><th>Division</th><th>Laptop</th><th>Serial</th><th>Asset Tag</th><th>Assigned</th><th>Age</th><th>Setup</th><th>Status</th>
        </tr></thead>
        <tbody>${printContent.map(r => `
          <tr><td>${r.employee}</td><td>${r.division}</td><td>${r.laptop}</td><td style="font-family:monospace;font-size:10px">${r.serial}</td><td>${r.assetTag}</td><td>${r.assigned}</td><td>${r.age}</td><td>${r.setup}</td><td>${r.status}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="footer">Equipment Store - Laptop Assignments</div>
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
        Loading laptop assignments...
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Laptop Assignments</h1>
          <p className="page-subtitle">Track company laptops assigned to employees</p>
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
            <button className="btn btn-secondary" onClick={() => setShowImportModal(true)} title="Import CSV">
              <Icons.Upload size={14} /> Import
            </button>
          )}
          {isAdminOrManager && selectedIds.size > 0 && (
            <button className="btn btn-secondary" onClick={() => setShowBulkStatusModal(true)} style={{ border: '2px solid var(--primary-color)' }}>
              Update {selectedIds.size} selected
            </button>
          )}
          {isAdminOrManager && (
            <button className="btn btn-primary" onClick={handleAdd}>
              + Assign Laptop
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
            placeholder="Search by name, brand, model, serial, asset tag..."
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
            {LAPTOP_STATUSES.map(s => (
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
          {(divisionFilter || brandFilter || dateFrom || dateTo || searchTerm || statusFilter) && (
            <button className="btn btn-sm" style={{ fontSize: '0.8rem' }} onClick={() => { setDivisionFilter(''); setBrandFilter(''); setDateFrom(''); setDateTo(''); setSearchTerm(''); setStatusFilter(''); }}>Clear Filters</button>
          )}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--success-color)' }}>
            {assignments.filter(a => a.laptop_status === 'Active').length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Active</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f39c12' }}>
            {assignments.filter(a => a.laptop_status === 'Repairs').length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>In Repairs</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#e67e22' }}>
            {assignments.filter(a => a.laptop_status === 'Damaged').length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Damaged</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--error-color)' }}>
            {assignments.filter(a => ['Stolen', 'Lost'].includes(a.laptop_status)).length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Stolen / Lost</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {assignments.filter(a => ['Returned', 'Decommissioned'].includes(a.laptop_status)).length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Returned / Decom.</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary-color)' }}>
            {assignments.length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total</div>
        </div>
      </div>

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
          <Icons.Package size={16} />
          <strong style={{ fontSize: '0.9rem' }}>Brand Distribution</strong>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({brandDistribution.length} brands)</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{showBrandChart ? '▼' : '▶'}</span>
        </div>
        {showBrandChart && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
              {brandDistribution.map(([brand, count]) => {
                const total = brandDistribution.reduce((s, [, c]) => s + c, 0);
                const pct = total ? ((count / total) * 100).toFixed(1) : 0;
                return (
                  <div key={brand} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: brandColors[brand] || '#888' }} />
                    <span style={{ fontSize: '0.85rem' }}>{brand}: <strong>{count}</strong> ({pct}%)</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', height: '20px', borderRadius: '4px', overflow: 'hidden' }}>
              {brandDistribution.map(([brand, count]) => {
                const total = brandDistribution.reduce((s, [, c]) => s + c, 0);
                return (
                  <div key={brand} title={`${brand}: ${count}`} style={{ width: `${(count / total) * 100}%`, background: brandColors[brand] || '#888', transition: 'width 0.3s' }} />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Cost Per Division */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowCostSummary(!showCostSummary)}>
          <Icons.FileText size={16} />
          <strong style={{ fontSize: '0.9rem' }}>Cost Per Division</strong>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{showCostSummary ? '▼' : '▶'}</span>
        </div>
        {showCostSummary && (
          <div className="table-container" style={{ marginTop: '12px' }}>
            <table>
              <thead>
                <tr>
                  <th>Division</th>
                  <th style={{ textAlign: 'right' }}>Laptops</th>
                  <th style={{ textAlign: 'right' }}>Device Cost (R)</th>
                  <th style={{ textAlign: 'right' }}>Monthly (R)</th>
                  <th style={{ textAlign: 'right' }}>Annual (R)</th>
                </tr>
              </thead>
              <tbody>
                {costPerDivision.map(([div, data]) => (
                  <tr key={div}>
                    <td><strong>{div}</strong></td>
                    <td style={{ textAlign: 'right' }}>{data.count}</td>
                    <td style={{ textAlign: 'right' }}>{data.totalDevice ? `R ${data.totalDevice.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}</td>
                    <td style={{ textAlign: 'right' }}>{data.totalMonthly ? `R ${data.totalMonthly.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}</td>
                    <td style={{ textAlign: 'right' }}>{data.totalMonthly ? `R ${(data.totalMonthly * 12).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                  <td>Total</td>
                  <td style={{ textAlign: 'right' }}>{costPerDivision.reduce((s, [, d]) => s + d.count, 0)}</td>
                  <td style={{ textAlign: 'right' }}>R {costPerDivision.reduce((s, [, d]) => s + d.totalDevice, 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: 'right' }}>R {costPerDivision.reduce((s, [, d]) => s + d.totalMonthly, 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: 'right' }}>R {(costPerDivision.reduce((s, [, d]) => s + d.totalMonthly, 0) * 12).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Column Toggle + Page Size */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-sm btn-secondary" onClick={() => setShowColumnToggle(!showColumnToggle)}>
            <Icons.Settings size={14} /> Columns
          </button>
          {showColumnToggle && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: 'var(--bg-primary, #fff)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', minWidth: '180px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {ALL_COLUMNS.map(col => (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', padding: '3px 0' }}>
                  <input type="checkbox" checked={isColVisible(col.key)} onChange={() => toggleColumn(col.key)} />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Per page:</label>
          <select className="form-input" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ width: '70px', padding: '4px 6px', fontSize: '0.85rem' }}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {sortedFiltered.length === 0 ? (
          <div className="empty-state">
            <h3>No laptop assignments found</h3>
            <p>{searchTerm ? 'Try a different search term' : 'Click "Assign Laptop" to add the first record'}</p>
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
                  {isColVisible('laptop') && <SortHeader col="laptop" label="Laptop" />}
                  {isColVisible('serial') && <th>Serial / Asset Tag</th>}
                  {isColVisible('date_assigned') && <SortHeader col="date_assigned" label="Date Assigned" />}
                  {isColVisible('laptop_age') && <SortHeader col="laptop_age" label="Age" />}
                  {isColVisible('condition') && <th>Condition</th>}
                  {isColVisible('setup') && <th>Setup</th>}
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
                    {isColVisible('laptop') && (
                    <td>
                      <div>
                        <strong>{item.laptop_brand}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {item.laptop_model}
                        </div>
                      </div>
                    </td>
                    )}
                    {isColVisible('serial') && (
                    <td>
                      <div>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{item.serial_number}</span>
                        {item.asset_tag && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            Tag: {item.asset_tag}
                          </div>
                        )}
                      </div>
                    </td>
                    )}
                    {isColVisible('date_assigned') && <td>{item.date_assigned ? new Date(item.date_assigned).toLocaleDateString() : '-'}</td>}
                    {isColVisible('laptop_age') && (
                    <td>
                      {(() => {
                        const ageColor = getLaptopAgeColor(item.date_assigned, item.laptop_status);
                        const upgradeStatus = getUpgradeStatus(item);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                            <span style={{ fontWeight: 600, color: ageColor, fontSize: '0.85rem' }}>
                              {getLaptopAgeLabel(item.date_assigned)}
                            </span>
                            {upgradeStatus === 'due' && (
                              <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(231,76,60,0.15)', color: '#e74c3c', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                REFRESH DUE
                              </span>
                            )}
                            {upgradeStatus === 'approaching' && (
                              <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(230,126,34,0.15)', color: '#e67e22', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                REFRESH SOON
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
                          fontSize: '0.8rem', padding: '2px 8px', borderRadius: '10px',
                          background: item.device_condition === 'Good' ? 'rgba(39,174,96,0.12)' :
                                     item.device_condition === 'Fair' ? 'rgba(243,156,18,0.12)' :
                                     item.device_condition === 'Poor' ? 'rgba(230,126,34,0.12)' : 'rgba(231,76,60,0.12)',
                          color: item.device_condition === 'Good' ? '#27ae60' :
                                 item.device_condition === 'Fair' ? '#f39c12' :
                                 item.device_condition === 'Poor' ? '#e67e22' : '#e74c3c',
                          fontWeight: 600,
                        }}>
                          {item.device_condition}
                        </span>
                      ) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>-</span>}
                    </td>
                    )}
                    {isColVisible('setup') && (
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {[
                          { key: 'setup_laptop', label: 'Laptop' },
                          { key: 'setup_m365', label: 'M365' },
                          { key: 'setup_adobe', label: 'Adobe' },
                          { key: 'setup_zoho', label: 'Zoho' },
                          { key: 'setup_smartsheet', label: 'Smart' },
                          { key: 'setup_distribution_lists', label: 'DLists' },
                        ].map(chk => (
                          <span
                            key={chk.key}
                            title={chk.label}
                            style={{
                              display: 'inline-block',
                              padding: '1px 5px',
                              fontSize: '0.65rem',
                              borderRadius: '4px',
                              background: item[chk.key] ? 'var(--success-color)' : 'var(--border-color)',
                              color: item[chk.key] ? '#fff' : 'var(--text-secondary)',
                            }}
                          >
                            {chk.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    )}
                    {isColVisible('status') && (
                    <td>
                      {(() => {
                        const st = LAPTOP_STATUSES.find(s => s.value === item.laptop_status) || LAPTOP_STATUSES[0];
                        return <span className={`badge ${st.badge}`}>{st.label}</span>;
                      })()}
                      {item.laptop_status === 'Returned' && item.date_returned && (
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
                        {isAdminOrManager && item.laptop_status === 'Active' && (
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--primary-color)', color: 'white' }}
                            onClick={() => { setReassignItem(item); setShowReassignModal(true); }}
                            title="Reassign Laptop"
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
        <LaptopModal
          item={editItem}
          personnel={personnel}
          allAssignments={assignments}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          onSuccess={() => { setShowModal(false); setEditItem(null); fetchData(); }}
        />
      )}

      {/* History Modal */}
      {historyItem && (
        <HistoryModal
          item={historyItem}
          onClose={() => setHistoryItem(null)}
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

function ReassignModal({ item, personnel, onClose, onSuccess }) {
  const [newEmployee, setNewEmployee] = useState('');
  const [saving, setSaving] = useState(false);

  const handleReassign = async () => {
    if (!newEmployee) return;
    const person = personnel.find(p => p.name === newEmployee);
    if (!person) return;
    setSaving(true);
    try {
      // Return the old assignment
      await laptopAssignmentsApi.update(item.id, {
        ...item,
        laptop_status: 'Returned',
        date_returned: new Date().toISOString().split('T')[0],
      });
      // Create new assignment for the new employee
      await laptopAssignmentsApi.create({
        employee_name: person.name,
        employee_id: person.employee_id || '',
        employee_email: person.email || '',
        laptop_brand: item.laptop_brand,
        laptop_model: item.laptop_model,
        serial_number: item.serial_number,
        asset_tag: item.asset_tag,
        date_assigned: new Date().toISOString().split('T')[0],
        laptop_status: 'Active',
        setup_laptop: false,
        setup_m365: false,
        setup_adobe: false,
        setup_zoho: false,
        setup_smartsheet: false,
        setup_distribution_lists: false,
        notes: `Reassigned from ${item.employee_name}`,
      });
      onSuccess();
    } catch (err) {
      alert('Failed to reassign: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div className="modal-header">
          <h3>Reassign Laptop</h3>
          <button className="modal-close" onClick={onClose}><Icons.Close size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ marginBottom: '12px' }}>
            Reassign <strong>{item.laptop_brand} {item.laptop_model}</strong> from <strong>{item.employee_name}</strong> to:
          </p>
          <select
            className="form-input"
            value={newEmployee}
            onChange={e => setNewEmployee(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">Select new employee...</option>
            {personnel
              .filter(p => p.name !== item.employee_name && p.status === 'Active')
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(p => (
                <option key={p.id} value={p.name}>{p.name}{p.department ? ` (${p.department})` : ''}</option>
              ))}
          </select>
        </div>
        <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleReassign} disabled={!newEmployee || saving}>
            {saving ? 'Reassigning...' : 'Reassign'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LaptopModal({ item, personnel, allAssignments, onClose, onSuccess }) {
  const [form, setForm] = useState({
    employee_name: item?.employee_name || '',
    employee_id: item?.employee_id || '',
    employee_email: item?.employee_email || '',
    laptop_brand: item?.laptop_brand || '',
    laptop_model: item?.laptop_model || '',
    serial_number: item?.serial_number || '',
    asset_tag: item?.asset_tag || '',
    date_assigned: item?.date_assigned || new Date().toISOString().split('T')[0],
    date_returned: item?.date_returned || '',
    setup_laptop: item?.setup_laptop ?? false,
    setup_m365: item?.setup_m365 ?? false,
    setup_adobe: item?.setup_adobe ?? false,
    setup_zoho: item?.setup_zoho ?? false,
    setup_smartsheet: item?.setup_smartsheet ?? false,
    setup_distribution_lists: item?.setup_distribution_lists ?? false,
    laptop_status: item?.laptop_status || 'Active',
    is_active: item?.is_active ?? true,
    notes: item?.notes || '',
    device_cost: item?.device_cost || '',
    monthly_cost: item?.monthly_cost || '',
    warranty_end_date: item?.warranty_end_date || '',
    contract_start_date: item?.contract_start_date || '',
    contract_end_date: item?.contract_end_date || '',
    device_condition: item?.device_condition || '',
    accessories: item?.accessories || '',
    insurance_policy: item?.insurance_policy || '',
    insurance_expiry: item?.insurance_expiry || '',
  });
  const [saving, setSaving] = useState(false);
  const [serialMatch, setSerialMatch] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // Fuzzy match serial number against existing assignments
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
      `This laptop (${serialMatch.laptop_brand} ${serialMatch.laptop_model}, S/N: ${serialMatch.serial_number}) is currently assigned to ${serialMatch.employee_name}.\n\nReassign it to ${form.employee_name}?`
    )) return;

    try {
      setSaving(true);
      await laptopAssignmentsApi.reassign(serialMatch.id, {
        employee_name: form.employee_name,
        employee_id: form.employee_id,
        employee_email: form.employee_email,
        date_assigned: form.date_assigned,
        setup_laptop: form.setup_laptop,
        setup_m365: form.setup_m365,
        setup_adobe: form.setup_adobe,
        setup_zoho: form.setup_zoho,
        setup_smartsheet: form.setup_smartsheet,
        setup_distribution_lists: form.setup_distribution_lists,
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
    if (!form.employee_name || !form.laptop_brand || !form.laptop_model || !form.serial_number || !form.date_assigned) {
      alert('Please fill in all required fields');
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form };
      if (!payload.date_returned) delete payload.date_returned;
      if (!payload.asset_tag) payload.asset_tag = null;
      if (!payload.employee_email) payload.employee_email = null;
      if (!payload.notes) payload.notes = null;
      payload.device_cost = payload.device_cost ? parseFloat(payload.device_cost) : null;
      payload.monthly_cost = payload.monthly_cost ? parseFloat(payload.monthly_cost) : null;
      if (!payload.warranty_end_date) payload.warranty_end_date = null;
      if (!payload.contract_start_date) payload.contract_start_date = null;
      if (!payload.contract_end_date) payload.contract_end_date = null;
      if (!payload.device_condition) payload.device_condition = null;
      if (!payload.accessories) payload.accessories = null;
      if (!payload.insurance_policy) payload.insurance_policy = null;
      if (!payload.insurance_expiry) payload.insurance_expiry = null;

      if (item) {
        // If status changed, use updateStatus to log history
        if (payload.laptop_status !== item.laptop_status) {
          await laptopAssignmentsApi.updateStatus(item.id, payload.laptop_status);
          delete payload.laptop_status;
          delete payload.is_active;
          delete payload.date_returned;
        }
        await laptopAssignmentsApi.update(item.id, payload);
      } else {
        const res = await laptopAssignmentsApi.create(payload);
        if (res.data?.id) {
          // Log initial assignment to history
          await laptopAssignmentsApi.updateStatus(res.data.id, 'Active').catch(() => {});
        }
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
          <h2>{item ? 'Edit Laptop Assignment' : 'Assign Laptop'}</h2>
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
                  placeholder="e.g. 12345"
                  required
                  readOnly={!!item}
                  style={item ? { backgroundColor: 'var(--bg-secondary, #f5f5f5)' } : {}}
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

            {/* Serial number match warning */}
            {serialMatch && !item && (
              <div style={{
                padding: '12px',
                border: '2px solid #f39c12',
                borderRadius: '8px',
                background: 'rgba(243, 156, 18, 0.1)',
              }}>
                <div style={{ fontWeight: 600, marginBottom: '6px', color: '#f39c12' }}>
                  Existing laptop found!
                </div>
                <div style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                  <strong>{serialMatch.laptop_brand} {serialMatch.laptop_model}</strong> (S/N: {serialMatch.serial_number})
                  <br />
                  Currently assigned to: <strong>{serialMatch.employee_name}</strong>
                  {serialMatch.laptop_status && <> — Status: <strong>{serialMatch.laptop_status}</strong></>}
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
                    Select an employee above to reassign this laptop
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Laptop Brand *</label>
                <select
                  name="laptop_brand"
                  value={form.laptop_brand}
                  onChange={handleChange}
                  className="form-input"
                  required={!serialMatch}
                >
                  <option value="">-- Select Brand --</option>
                  {getAssetConfig().laptopBrands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Laptop Model *</label>
                <input
                  type="text"
                  name="laptop_model"
                  value={form.laptop_model}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. A15 TUF Gaming"
                  required={!serialMatch}
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

            {/* Setup Checklist */}
            <div className="form-group">
              <label className="form-label">Setup Checklist</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-secondary, #f9f9f9)' }}>
                {[
                  { name: 'setup_laptop', label: 'Laptop set up' },
                  { name: 'setup_m365', label: 'Microsoft 365 Business licence' },
                  { name: 'setup_adobe', label: 'Adobe licence' },
                  { name: 'setup_zoho', label: 'Zoho account' },
                  { name: 'setup_smartsheet', label: 'Smartsheet access' },
                  { name: 'setup_distribution_lists', label: 'Distribution lists (Microsoft)' },
                ].map(chk => (
                  <label key={chk.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input
                      type="checkbox"
                      name={chk.name}
                      checked={form[chk.name]}
                      onChange={handleChange}
                    />
                    {chk.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Cost Tracking */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Device Cost (R)</label>
                <input type="number" name="device_cost" value={form.device_cost} onChange={handleChange} className="form-input" placeholder="e.g. 15000" step="0.01" min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Monthly Cost (R)</label>
                <input type="number" name="monthly_cost" value={form.monthly_cost} onChange={handleChange} className="form-input" placeholder="e.g. 350" step="0.01" min="0" />
              </div>
            </div>

            {/* Contract / Warranty */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Contract Start</label>
                <input type="date" name="contract_start_date" value={form.contract_start_date} onChange={handleChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Contract End</label>
                <input type="date" name="contract_end_date" value={form.contract_end_date} onChange={handleChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Warranty End</label>
                <input type="date" name="warranty_end_date" value={form.warranty_end_date} onChange={handleChange} className="form-input" />
              </div>
            </div>

            {/* Condition / Accessories */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Device Condition</label>
                <select name="device_condition" value={form.device_condition} onChange={handleChange} className="form-input">
                  <option value="">-- Select --</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                  <option value="Damaged">Damaged</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Accessories</label>
                <input type="text" name="accessories" value={form.accessories} onChange={handleChange} className="form-input" placeholder="e.g. Charger, Mouse, Bag" />
              </div>
            </div>

            {/* Insurance */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Insurance Policy</label>
                <input type="text" name="insurance_policy" value={form.insurance_policy} onChange={handleChange} className="form-input" placeholder="Policy number" />
              </div>
              <div className="form-group">
                <label className="form-label">Insurance Expiry</label>
                <input type="date" name="insurance_expiry" value={form.insurance_expiry} onChange={handleChange} className="form-input" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Laptop Status</label>
              <select
                name="laptop_status"
                value={form.laptop_status}
                onChange={(e) => {
                  const val = e.target.value;
                  const inactiveStatuses = ['Returned', 'Stolen', 'Lost', 'Decommissioned'];
                  setForm(prev => ({
                    ...prev,
                    laptop_status: val,
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
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            {!serialMatch && (
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : (item ? 'Update' : 'Assign Laptop')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function HistoryModal({ item, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    laptopAssignmentsApi.getHistory(item.id)
      .then(res => setHistory(res.data || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [item.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>Laptop History</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            <Icons.Close size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px' }}>
            <strong>{item.laptop_brand} {item.laptop_model}</strong>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              S/N: {item.serial_number} {item.asset_tag ? `| Asset Tag: ${item.asset_tag}` : ''}
            </div>
            <div style={{ fontSize: '0.85rem' }}>
              Currently: <strong>{item.employee_name}</strong> — {item.laptop_status || 'Active'}
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
        await laptopAssignmentsApi.updateStatus(item.id, newStatus);
        await laptopAssignmentsApi.update(item.id, {
          ...item,
          laptop_status: newStatus,
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

  const LAPTOP_STATUSES_BULK = [
    { value: 'Returned', label: 'Returned' },
    { value: 'Stolen', label: 'Stolen' },
    { value: 'Damaged', label: 'Damaged' },
    { value: 'Repairs', label: 'Sent for Repairs' },
    { value: 'Lost', label: 'Lost' },
    { value: 'Decommissioned', label: 'Decommissioned' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Bulk Status Update ({selected.length} laptops)</h3>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(52,152,219,0.08)', borderRadius: '8px', fontSize: '0.85rem' }}>
            <strong>Selected laptops:</strong>
            <div style={{ maxHeight: '100px', overflowY: 'auto', marginTop: '4px' }}>
              {selected.map(s => (
                <div key={s.id}>{s.employee_name} — {s.laptop_brand} {s.laptop_model}</div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>New Status</label>
            <select className="form-control" value={newStatus} onChange={e => setNewStatus(e.target.value)} disabled={processing}>
              {LAPTOP_STATUSES_BULK.map(s => (
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
            {processing ? `Updating ${progress.done}/${progress.total}...` : `Update ${selected.length} Laptops`}
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

  const EXPECTED_HEADERS = ['employee_name', 'laptop_brand', 'laptop_model', 'serial_number'];
  const ALL_HEADERS = [
    'employee_name', 'laptop_brand', 'laptop_model', 'serial_number',
    'employee_id', 'employee_email', 'asset_tag', 'date_assigned', 'laptop_status',
    'device_cost', 'monthly_cost', 'warranty_end_date', 'contract_start_date', 'contract_end_date',
    'device_condition', 'accessories', 'insurance_policy', 'insurance_expiry', 'notes',
    'setup_laptop', 'setup_m365', 'setup_adobe', 'setup_zoho', 'setup_smartsheet', 'setup_distribution_lists'
  ];

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([ALL_HEADERS]);
    // Set column widths
    ws['!cols'] = ALL_HEADERS.map(h => ({ wch: Math.max(h.length + 2, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laptop Assignments');
    XLSX.writeFile(wb, 'laptop_assignments_template.xlsx');
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setParseError('');
    setParsedRows([]);

    const isExcel = f.name.match(/\.xlsx?$/i);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        let headers, dataRows;
        if (isExcel) {
          const wb = XLSX.read(evt.target.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (json.length < 2) { setParseError('File must have a header row and at least one data row'); return; }
          headers = json[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_'));
          dataRows = json.slice(1).filter(r => r.some(c => String(c).trim()));
        } else {
          const text = evt.target.result;
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          if (lines.length < 2) { setParseError('File must have a header row and at least one data row'); return; }
          headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/['"]/g, ''));
          dataRows = lines.slice(1).map(l => l.split(',').map(v => v.trim().replace(/^["']|["']$/g, '')));
        }

        const missing = EXPECTED_HEADERS.filter(h => !headers.includes(h));
        if (missing.length > 0) { setParseError(`Missing required columns: ${missing.join(', ')}`); return; }

        const rows = [];
        for (const values of dataRows) {
          if (values.length < headers.length) continue;
          const row = {};
          headers.forEach((h, idx) => { row[h] = String(values[idx] || '').trim(); });
          if (row.employee_name && row.laptop_brand) rows.push(row);
        }
        setParsedRows(rows);
      } catch (err) {
        setParseError('Failed to parse file: ' + err.message);
      }
    };
    if (isExcel) {
      reader.readAsArrayBuffer(f);
    } else {
      reader.readAsText(f);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const total = parsedRows.length;
    const errors = [];
    let done = 0;
    setProgress({ done: 0, total, errors: [] });

    for (const row of parsedRows) {
      try {
        await laptopAssignmentsApi.create({
          employee_name: row.employee_name,
          employee_id: row.employee_id || '',
          employee_email: row.employee_email || '',
          laptop_brand: row.laptop_brand,
          laptop_model: row.laptop_model || '',
          serial_number: row.serial_number || '',
          asset_tag: row.asset_tag || '',
          date_assigned: row.date_assigned || new Date().toISOString().split('T')[0],
          laptop_status: row.laptop_status || 'Active',
          setup_laptop: row.setup_laptop === 'true' || row.setup_laptop === 'Yes',
          setup_m365: row.setup_m365 === 'true' || row.setup_m365 === 'Yes',
          setup_adobe: row.setup_adobe === 'true' || row.setup_adobe === 'Yes',
          setup_zoho: row.setup_zoho === 'true' || row.setup_zoho === 'Yes',
          setup_smartsheet: row.setup_smartsheet === 'true' || row.setup_smartsheet === 'Yes',
          setup_distribution_lists: row.setup_distribution_lists === 'true' || row.setup_distribution_lists === 'Yes',
          device_cost: row.device_cost ? parseFloat(row.device_cost) : null,
          monthly_cost: row.monthly_cost ? parseFloat(row.monthly_cost) : null,
          warranty_end_date: row.warranty_end_date || null,
          contract_start_date: row.contract_start_date || null,
          contract_end_date: row.contract_end_date || null,
          device_condition: row.device_condition || null,
          accessories: row.accessories || null,
          insurance_policy: row.insurance_policy || null,
          insurance_expiry: row.insurance_expiry || null,
          notes: row.notes || null,
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
          <h3><Icons.Upload size={18} /> Import Laptop Assignments</h3>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><Icons.Close size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(52,152,219,0.08)', borderRadius: '8px', fontSize: '0.83rem' }}>
            <strong>XLSX Format:</strong> File must include headers. Required columns: <code>employee_name</code>, <code>laptop_brand</code>, <code>laptop_model</code>, <code>serial_number</code>.
            <br />Optional: employee_id, employee_email, asset_tag, date_assigned, laptop_status, device_cost, monthly_cost, warranty_end_date, contract_start_date, contract_end_date, device_condition, accessories, insurance_policy, insurance_expiry, notes, setup_laptop, setup_m365, setup_adobe, setup_zoho, setup_smartsheet, setup_distribution_lists
            <div style={{ marginTop: '8px' }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={downloadTemplate} style={{ fontSize: '0.8rem' }}>
                <Icons.Download size={14} /> Download Template
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Select CSV / XLSX File</label>
            <input type="file" accept=".csv,.xlsx,.xls" className="form-control" onChange={handleFileChange} disabled={importing} />
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
                      <th>Laptop</th>
                      <th>Serial</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 50).map((row, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{row.employee_name}</td>
                        <td>{row.laptop_brand} {row.laptop_model}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.serial_number}</td>
                        <td>{row.laptop_status || 'Active'}</td>
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

export default LaptopAssignments;
