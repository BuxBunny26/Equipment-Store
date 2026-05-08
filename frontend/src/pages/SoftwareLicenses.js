import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { softwareLicensesApi, softwareAssignmentsApi, personnelApi } from '../services/api';
import { useOperator } from '../context/OperatorContext';
import { Icons } from '../components/Icons';
import { buildDivisionLookup, lookupDivision } from '../utils/divisionUtils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { saveAs } from 'file-saver';

// ─── helpers ────────────────────────────────────────────────────────────────

const BILLING_CYCLES = ['Monthly', 'Annual', 'One-time'];
const LICENSE_TYPES = ['Per User', 'Per Device', 'Site License', 'Concurrent', 'Expense Reimbursement'];

function monthlyCost(lic) {
  if (!lic || !lic.cost_per_seat) return 0;
  const seats = lic.total_seats || 0;
  if (lic.billing_cycle === 'Annual') return (lic.cost_per_seat / 12) * seats;
  if (lic.billing_cycle === 'One-time') return 0;
  return lic.cost_per_seat * seats;
}

function annualCost(lic) {
  if (!lic || !lic.cost_per_seat) return 0;
  const seats = lic.total_seats || 0;
  if (lic.billing_cycle === 'Annual') return lic.cost_per_seat * seats;
  if (lic.billing_cycle === 'One-time') return 0;
  return (lic.cost_per_seat * seats) * 12;
}

function fmtCurrency(val) {
  if (val == null || isNaN(val)) return '-';
  return 'R ' + Number(val).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getRenewalStatus(date) {
  if (!date) return null;
  const days = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'expired';
  if (days <= 30) return 'due-soon';
  return 'ok';
}

function renewalDaysLabel(date) {
  if (!date) return null;
  const days = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  if (days <= 30) return `Due in ${days} day${days === 1 ? '' : 's'}`;
  return new Date(date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Main Component ─────────────────────────────────────────────────────────

function SoftwareLicenses() {
  const { operatorRole } = useOperator();
  const isAdmin = true; // same pattern as LaptopAssignments

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [licenses, setLicenses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [personnel, setPersonnel] = useState([]);

  // Catalog modal
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [editLicense, setEditLicense] = useState(null);
  const [licenseForm, setLicenseForm] = useState({});
  const [licSaving, setLicSaving] = useState(false);

  // Export dropdown
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  // Assignment modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForLicense, setAssignForLicense] = useState(null);
  const [editAssignment, setEditAssignment] = useState(null);
  const [assignForm, setAssignForm] = useState({});
  const [assignSaving, setAssignSaving] = useState(false);

  // Filters (assignments tab)
  const [assignSearch, setAssignSearch] = useState('');
  const [assignSoftwareFilter, setAssignSoftwareFilter] = useState('');
  const [assignDivisionFilter, setAssignDivisionFilter] = useState('');

  // Filters (catalog tab)
  const [catSearch, setCatSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Bulk assign modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkForLicense, setBulkForLicense] = useState(null);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [licRes, assignRes, personnelRes] = await Promise.all([
        softwareLicensesApi.getAll(false),
        softwareAssignmentsApi.getAll(null, false),
        personnelApi.getAll(true),
      ]);
      setLicenses(licRes.data || []);
      setAssignments(assignRes.data || []);
      setPersonnel(personnelRes.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const divLookup = buildDivisionLookup(personnel);

  // Enrich licenses with assignment counts
  const enrichedLicenses = useMemo(() => {
    return licenses.map(lic => {
      const active = assignments.filter(a => a.software_license_id === lic.id && a.is_active);
      // seats_used is a manual override for when individual assignment records aren't entered
      const assigned_count = Math.max(active.length, lic.seats_used || 0);
      return { ...lic, assigned_count };
    });
  }, [licenses, assignments]);

  // Filter catalog
  const filteredCatalog = useMemo(() => {
    return enrichedLicenses.filter(lic => {
      if (lic.license_type === 'Expense Reimbursement') return false;
      if (deptFilter && lic.department !== deptFilter) return false;
      if (catSearch) {
        const t = catSearch.toLowerCase();
        return lic.name?.toLowerCase().includes(t) || lic.vendor?.toLowerCase().includes(t);
      }
      return true;
    });
  }, [enrichedLicenses, catSearch, deptFilter]);

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      if (!a.is_active) return false;
      if (assignSoftwareFilter && a.software_license_id !== parseInt(assignSoftwareFilter)) return false;
      if (assignDivisionFilter) {
        const div = lookupDivision(divLookup, { employee_name: a.employee_name }, 'employee_name');
        if (div !== assignDivisionFilter) return false;
      }
      if (assignSearch) {
        const t = assignSearch.toLowerCase();
        return (
          a.employee_name?.toLowerCase().includes(t) ||
          a.employee_id?.toLowerCase().includes(t) ||
          a.software_name?.toLowerCase().includes(t)
        );
      }
      return true;
    });
  }, [assignments, assignSoftwareFilter, assignDivisionFilter, assignSearch, divLookup]);

  // Stats
  const stats = useMemo(() => {
    const activeLics = enrichedLicenses.filter(l => l.is_active);
    const totalMonthly = activeLics.reduce((s, l) => s + monthlyCost(l), 0);
    const totalAnnual = activeLics.reduce((s, l) => s + annualCost(l), 0);
    const totalSeats = assignments.filter(a => a.is_active).length;
    const expiringSoon = activeLics.filter(l => getRenewalStatus(l.renewal_date) === 'due-soon').length;
    return { count: activeLics.length, totalMonthly, totalAnnual, totalSeats, expiringSoon };
  }, [enrichedLicenses, assignments]);

  // Division cost breakdown (for active assignments)
  const divisionBreakdown = useMemo(() => {
    const map = {};
    assignments.filter(a => a.is_active).forEach(a => {
      const div = lookupDivision(divLookup, { employee_name: a.employee_name }, 'employee_name') || 'Unknown';
      if (!map[div]) map[div] = { count: 0, monthly: 0 };
      map[div].count += 1;
      const lic = enrichedLicenses.find(l => l.id === a.software_license_id);
      if (lic && lic.cost_per_seat) {
        const m = lic.billing_cycle === 'Annual' ? lic.cost_per_seat / 12 : lic.billing_cycle === 'One-time' ? 0 : lic.cost_per_seat;
        map[div].monthly += m;
      }
    });
    return Object.entries(map).map(([div, v]) => ({ division: div, ...v })).sort((a, b) => b.monthly - a.monthly);
  }, [assignments, enrichedLicenses, divLookup]);

  const divisions = useMemo(() => {
    return [...new Set(
      personnel.map(p => p.division).filter(Boolean)
    )].sort();
  }, [personnel]);

  // Cost allocation by department
  const costAllocation = useMemo(() => {
    const active = enrichedLicenses.filter(l => l.is_active && l.license_type !== 'Expense Reimbursement');
    const expenseItems = enrichedLicenses.filter(l => l.is_active && l.license_type === 'Expense Reimbursement');
    const deptItems = active.filter(l => l.department);
    const unallocated = active.filter(l => !l.department);
    const productNames = [...new Set(deptItems.map(l => l.name))].sort();
    const products = productNames.map(name => {
      const afsLic = deptItems.find(l => l.name === name && l.department === 'AFS');
      const rsLic  = deptItems.find(l => l.name === name && l.department === 'RS');
      return {
        name,
        vendor: (afsLic || rsLic)?.vendor,
        afs: afsLic ? { seats: afsLic.total_seats || 0, monthly: monthlyCost(afsLic) } : null,
        rs:  rsLic  ? { seats: rsLic.total_seats  || 0, monthly: monthlyCost(rsLic)  } : null,
      };
    });
    const afsTotals   = { monthly: deptItems.filter(l => l.department === 'AFS').reduce((s, l) => s + monthlyCost(l), 0) };
    const rsTotals    = { monthly: deptItems.filter(l => l.department === 'RS' ).reduce((s, l) => s + monthlyCost(l), 0) };
    const unallocTotals = { monthly: unallocated.reduce((s, l) => s + monthlyCost(l), 0) };
    const expenseTotals = { monthly: expenseItems.reduce((s, l) => s + monthlyCost(l), 0) };
    return { products, afsTotals, rsTotals, unallocTotals, unallocated, expenseItems, expenseTotals };
  }, [enrichedLicenses]);

  // ── License CRUD ───────────────────────────────────────────────────────────

  const openAddLicense = () => {
    setEditLicense(null);
    setLicenseForm({ name: '', vendor: '', license_type: 'Per User', cost_per_seat: '', billing_cycle: 'Monthly', total_seats: '', renewal_date: '', notes: '', is_active: true, department: '' });
    setShowLicenseModal(true);
  };

  const openEditLicense = (lic) => {
    setEditLicense(lic);
    setLicenseForm({
      name: lic.name || '',
      vendor: lic.vendor || '',
      license_type: lic.license_type || 'Per User',
      cost_per_seat: lic.cost_per_seat ?? '',
      billing_cycle: lic.billing_cycle || 'Monthly',
      total_seats: lic.total_seats ?? '',
      renewal_date: lic.renewal_date || '',
      notes: lic.notes || '',
      is_active: lic.is_active !== false,
      department: lic.department || '',
    });
    setShowLicenseModal(true);
  };

  const saveLicense = async () => {
    if (!licenseForm.name?.trim()) { alert('Software name is required.'); return; }
    setLicSaving(true);
    try {
      const payload = {
        name: licenseForm.name.trim(),
        vendor: licenseForm.vendor?.trim() || null,
        license_type: licenseForm.license_type || 'Per User',
        cost_per_seat: licenseForm.cost_per_seat !== '' ? parseFloat(licenseForm.cost_per_seat) : null,
        billing_cycle: licenseForm.billing_cycle || 'Monthly',
        total_seats: licenseForm.total_seats !== '' ? parseInt(licenseForm.total_seats) : null,
        renewal_date: licenseForm.renewal_date || null,
        notes: licenseForm.notes?.trim() || null,
        is_active: licenseForm.is_active !== false,
        department: licenseForm.department || null,
      };
      if (editLicense) {
        await softwareLicensesApi.update(editLicense.id, payload);
      } else {
        await softwareLicensesApi.create(payload);
      }
      setShowLicenseModal(false);
      fetchData();
    } catch (err) {
      alert('Error saving: ' + err.message);
    } finally {
      setLicSaving(false);
    }
  };

  const deleteLicense = async (lic) => {
    if (!window.confirm(`Delete "${lic.name}"? This will also remove all its assignments.`)) return;
    try {
      await softwareLicensesApi.delete(lic.id);
      fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ── Assignment CRUD ────────────────────────────────────────────────────────

  const openAssign = (lic) => {
    setAssignForLicense(lic);
    setEditAssignment(null);
    setAssignForm({ personnel_id: '', assigned_date: new Date().toISOString().split('T')[0], notes: '' });
    setShowAssignModal(true);
  };

  const openEditAssignment = (a) => {
    setAssignForLicense(enrichedLicenses.find(l => l.id === a.software_license_id) || null);
    setEditAssignment(a);
    setAssignForm({ personnel_id: a.personnel_id || '', assigned_date: a.assigned_date || '', notes: a.notes || '' });
    setShowAssignModal(true);
  };

  const saveAssignment = async () => {
    if (!assignForm.personnel_id && !assignForm.employee_name?.trim()) {
      alert('Please select an employee.'); return;
    }
    setAssignSaving(true);
    try {
      const person = personnel.find(p => p.id === parseInt(assignForm.personnel_id));
      const payload = {
        software_license_id: assignForLicense.id,
        personnel_id: person ? person.id : null,
        employee_name: person ? person.full_name : '',
        employee_id: person ? person.employee_id : '',
        assigned_date: assignForm.assigned_date || new Date().toISOString().split('T')[0],
        notes: assignForm.notes?.trim() || null,
        is_active: true,
      };
      if (editAssignment) {
        await softwareAssignmentsApi.update(editAssignment.id, payload);
      } else {
        await softwareAssignmentsApi.create(payload);
      }
      setShowAssignModal(false);
      fetchData();
    } catch (err) {
      alert('Error saving: ' + err.message);
    } finally {
      setAssignSaving(false);
    }
  };

  // ── Bulk Assign ────────────────────────────────────────────────────────────

  const openBulkAssign = (lic) => {
    setBulkForLicense(lic);
    // Pre-tick employees already assigned
    const alreadyAssigned = new Set(
      assignments
        .filter(a => a.software_license_id === lic.id && a.is_active && a.personnel_id)
        .map(a => a.personnel_id)
    );
    setBulkSelected(new Set(alreadyAssigned));
    setBulkSearch('');
    setShowBulkModal(true);
  };

  const saveBulkAssign = async () => {
    setBulkSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // Existing active assignments for this license
      const existing = assignments.filter(
        a => a.software_license_id === bulkForLicense.id && a.is_active
      );
      const existingByPersonnel = new Map(existing.map(a => [a.personnel_id, a]));

      // Revoke assignments for unselected employees who were previously assigned
      const toRevoke = existing.filter(a => a.personnel_id && !bulkSelected.has(a.personnel_id));
      for (const a of toRevoke) {
        await softwareAssignmentsApi.update(a.id, { is_active: false });
      }

      // Create assignments for newly selected employees
      for (const pid of bulkSelected) {
        if (existingByPersonnel.has(pid)) continue; // already assigned
        const person = personnel.find(p => p.id === pid);
        if (!person) continue;
        await softwareAssignmentsApi.create({
          software_license_id: bulkForLicense.id,
          personnel_id: person.id,
          employee_name: person.full_name,
          employee_id: person.employee_id || '',
          assigned_date: today,
          is_active: true,
        });
      }

      setShowBulkModal(false);
      fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBulkSaving(false);
    }
  };

  const revokeAssignment = async (a) => {
    if (!window.confirm(`Revoke ${a.software_name} for ${a.employee_name}?`)) return;
    try {
      await softwareAssignmentsApi.update(a.id, { is_active: false });
      fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────

  const fmtZAR = (v) => v != null ? `R ${Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Catalog
    const catalogRows = enrichedLicenses
      .filter(l => l.license_type !== 'Expense Reimbursement')
      .map(l => ({
        'Software': l.name,
        'Vendor': l.vendor || '',
        'Department': l.department || '',
        'License Type': l.license_type || '',
        'Cost per Seat (ZAR)': l.cost_per_seat ?? '',
        'Billing Cycle': l.billing_cycle || '',
        'Total Seats': l.total_seats ?? '',
        'Assigned Seats': l.assigned_count,
        'Monthly Cost (ZAR)': +monthlyCost(l).toFixed(2),
        'Annual Cost (ZAR)': +annualCost(l).toFixed(2),
        'Renewal Date': l.renewal_date || '',
        'Status': l.is_active ? 'Active' : 'Inactive',
        'Notes': l.notes || '',
      }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catalogRows), 'Catalog');

    // Sheet 2: Assignments
    const assignRows = assignments
      .filter(a => a.is_active)
      .map(a => ({
        'Employee': a.employee_name || '',
        'Employee ID': a.employee_id || '',
        'Division': lookupDivision(divLookup, { employee_name: a.employee_name }, 'employee_name') || '',
        'Software': a.software_name || '',
        'Vendor': a.vendor || '',
        'Cost per Seat (ZAR)': a.cost_per_seat ?? '',
        'Billing Cycle': a.billing_cycle || '',
        'Monthly Cost (ZAR)': a.cost_per_seat != null ? +(a.billing_cycle === 'Annual' ? a.cost_per_seat / 12 : a.billing_cycle === 'One-time' ? 0 : a.cost_per_seat).toFixed(2) : '',
        'Assigned Date': a.assigned_date || '',
        'Notes': a.notes || '',
      }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assignRows.length ? assignRows : [{ Note: 'No active assignments' }]), 'Assignments');

    // Sheet 3: Cost Allocation
    const costRows = [];
    costAllocation.products.forEach(p => {
      if (p.afs) costRows.push({ 'Product': p.name, 'Vendor': p.vendor || '', 'Department': 'AFS', 'Seats': p.afs.seats, 'Monthly (ZAR)': +p.afs.monthly.toFixed(2), 'Annual (ZAR)': +(p.afs.monthly * 12).toFixed(2), 'Category': 'Allocated' });
      if (p.rs)  costRows.push({ 'Product': p.name, 'Vendor': p.vendor || '', 'Department': 'RS',  'Seats': p.rs.seats,  'Monthly (ZAR)': +p.rs.monthly.toFixed(2),  'Annual (ZAR)': +(p.rs.monthly * 12).toFixed(2),  'Category': 'Allocated' });
    });
    costAllocation.unallocated.forEach(l => costRows.push({ 'Product': l.name, 'Vendor': l.vendor || '', 'Department': '', 'Seats': l.total_seats ?? '', 'Monthly (ZAR)': +monthlyCost(l).toFixed(2), 'Annual (ZAR)': +annualCost(l).toFixed(2), 'Category': 'Unallocated' }));
    costAllocation.expenseItems.forEach(l => costRows.push({ 'Product': l.name, 'Vendor': l.vendor || '', 'Department': l.department || '', 'Seats': '', 'Monthly (ZAR)': l.cost_per_seat ? +monthlyCost(l).toFixed(2) : 'TBC', 'Annual (ZAR)': l.cost_per_seat ? +annualCost(l).toFixed(2) : 'TBC', 'Category': 'Expense Reimbursed' }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(costRows.length ? costRows : [{ Note: 'No cost data' }]), 'Cost Allocation');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `Software_Licenses_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setExportOpen(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const today = new Date().toLocaleDateString('en-ZA');
    const grandMonthly = costAllocation.afsTotals.monthly + costAllocation.rsTotals.monthly + costAllocation.unallocTotals.monthly + costAllocation.expenseTotals.monthly;

    doc.setFontSize(16); doc.setFont(undefined, 'bold');
    doc.text('Software License Cost Report', 14, 16);
    doc.setFontSize(9); doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${today}`, 14, 23);
    doc.setDrawColor(200); doc.line(14, 26, 283, 26);

    // Summary row
    doc.setFontSize(9);
    const summaryY = 32;
    const summaryItems = [
      ['AFS Monthly', fmtZAR(costAllocation.afsTotals.monthly)],
      ['RS Monthly', fmtZAR(costAllocation.rsTotals.monthly)],
      ['Unallocated', fmtZAR(costAllocation.unallocTotals.monthly)],
      ['Expense Claims', fmtZAR(costAllocation.expenseTotals.monthly)],
      ['GRAND TOTAL', fmtZAR(grandMonthly)],
    ];
    const colW = 55;
    summaryItems.forEach(([lbl, val], i) => {
      const x = 14 + i * colW;
      const isLast = i === summaryItems.length - 1;
      doc.setFillColor(isLast ? 39 : 248, isLast ? 174 : 249, isLast ? 96 : 250);
      doc.roundedRect(x, summaryY - 5, colW - 3, 16, 2, 2, 'F');
      doc.setFont(undefined, 'normal'); doc.setFontSize(7); doc.setTextColor(100);
      doc.text(lbl, x + 3, summaryY + 1);
      doc.setFont(undefined, 'bold'); doc.setFontSize(9); doc.setTextColor(isLast ? 39 : 50, isLast ? 174 : 50, isLast ? 96 : 50);
      doc.text(val, x + 3, summaryY + 8);
    });
    doc.setTextColor(0);

    let y = summaryY + 20;

    if (costAllocation.products.length > 0) {
      doc.setFontSize(11); doc.setFont(undefined, 'bold');
      doc.text('Department Breakdown by Product', 14, y); y += 3;
      doc.autoTable({
        startY: y,
        head: [['Product', 'Vendor', 'AFS Seats', 'AFS Monthly', 'RS Seats', 'RS Monthly', 'Total Monthly', 'Total Annual']],
        body: costAllocation.products.map(p => [
          p.name, p.vendor || '',
          p.afs?.seats ?? '-', p.afs ? fmtZAR(p.afs.monthly) : '-',
          p.rs?.seats ?? '-',  p.rs  ? fmtZAR(p.rs.monthly)  : '-',
          fmtZAR((p.afs?.monthly || 0) + (p.rs?.monthly || 0)),
          fmtZAR(((p.afs?.monthly || 0) + (p.rs?.monthly || 0)) * 12),
        ]),
        foot: [['SUBTOTAL', '', costAllocation.products.reduce((s,p)=>s+(p.afs?.seats||0),0), fmtZAR(costAllocation.afsTotals.monthly), costAllocation.products.reduce((s,p)=>s+(p.rs?.seats||0),0), fmtZAR(costAllocation.rsTotals.monthly), fmtZAR(costAllocation.afsTotals.monthly+costAllocation.rsTotals.monthly), fmtZAR((costAllocation.afsTotals.monthly+costAllocation.rsTotals.monthly)*12)]],
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        footStyles: { fillColor: [232, 244, 252], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, alternateRowStyles: { fillColor: [248, 251, 254] },
        margin: { left: 14, right: 14 }, showFoot: 'lastPage',
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    if (costAllocation.unallocated.length > 0) {
      if (y > 170) { doc.addPage(); y = 20; }
      doc.setFontSize(11); doc.setFont(undefined, 'bold');
      doc.text('Unallocated Licenses', 14, y); y += 3;
      doc.autoTable({
        startY: y,
        head: [['Product', 'Vendor', 'Seats', 'Monthly', 'Annual']],
        body: costAllocation.unallocated.map(l => [l.name, l.vendor || '', l.total_seats ?? '-', fmtZAR(monthlyCost(l)), fmtZAR(annualCost(l))]),
        foot: [['TOTAL', '', '', fmtZAR(costAllocation.unallocTotals.monthly), fmtZAR(costAllocation.unallocTotals.monthly * 12)]],
        headStyles: { fillColor: [149, 165, 166], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        footStyles: { fillColor: [245, 245, 245], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, alternateRowStyles: { fillColor: [250, 250, 250] },
        margin: { left: 14, right: 14 }, showFoot: 'lastPage',
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    if (costAllocation.expenseItems.length > 0) {
      if (y > 170) { doc.addPage(); y = 20; }
      doc.setFontSize(11); doc.setFont(undefined, 'bold');
      doc.text('Expense-Reimbursed Subscriptions', 14, y); y += 3;
      doc.autoTable({
        startY: y,
        head: [['Tool', 'Vendor', 'Dept', 'Approx Monthly', 'Approx Annual', 'Notes']],
        body: costAllocation.expenseItems.map(l => [l.name, l.vendor || '', l.department || '', l.cost_per_seat ? fmtZAR(monthlyCost(l)) : 'TBC', l.cost_per_seat ? fmtZAR(annualCost(l)) : 'TBC', (l.notes || '').slice(0, 80)]),
        foot: [['TOTAL', '', '', fmtZAR(costAllocation.expenseTotals.monthly), fmtZAR(costAllocation.expenseTotals.monthly * 12), '']],
        headStyles: { fillColor: [39, 174, 96], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        footStyles: { fillColor: [240, 253, 244], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, alternateRowStyles: { fillColor: [247, 254, 249] },
        columnStyles: { 5: { cellWidth: 70 } },
        margin: { left: 14, right: 14 }, showFoot: 'lastPage',
      });
    }

    doc.save(`Software_Cost_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    setExportOpen(false);
  };

  // Close export dropdown when clicking outside
  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportOpen]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="page-content">
      <div className="loading-state">
        <Icons.Refresh size={24} className="spin" />
        <span>Loading software licenses…</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="page-content">
      <div className="error-state">
        <Icons.AlertCircle size={20} />
        <span>{error}</span>
        <button className="btn btn-secondary" onClick={fetchData}>Retry</button>
      </div>
    </div>
  );

  return (
    <div className="page-content">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1>Software Licenses</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            Track software licenses, assignments and costs
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={fetchData}>
            <Icons.Refresh size={14} /> Refresh
          </button>
          {/* Export dropdown */}
          <div style={{ position: 'relative' }} ref={exportRef}>
            <button className="btn btn-secondary" onClick={() => setExportOpen(o => !o)}>
              <Icons.Download size={14} /> Export
            </button>
            {exportOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '110%', zIndex: 200,
                background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                minWidth: 220, overflow: 'hidden',
              }}>
                <button
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-primary)', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg, rgba(0,0,0,0.04))'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  onClick={exportExcel}
                >
                  <Icons.Grid size={15} style={{ color: '#27ae60' }} />
                  <div><div style={{ fontWeight: 500 }}>Export to Excel</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Catalog, Assignments, Cost Allocation</div></div>
                </button>
                <div style={{ height: 1, background: 'var(--border-color)' }} />
                <button
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-primary)', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg, rgba(0,0,0,0.04))'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  onClick={exportPDF}
                >
                  <Icons.AlertCircle size={15} style={{ color: '#e74c3c' }} />
                  <div><div style={{ fontWeight: 500 }}>Export Cost Report (PDF)</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>AFS / RS / Unallocated breakdown</div></div>
                </button>
              </div>
            )}
          </div>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openAddLicense}>
              <Icons.Plus size={14} /> Add Software
            </button>
          )}
        </div>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────────────── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard label="Software Products" value={stats.count} icon={<Icons.Grid size={18} />} color="var(--accent-color)" />
        <StatCard label="Active Assignments" value={stats.totalSeats} icon={<Icons.Users size={18} />} color="var(--success-color)" />
        <StatCard label="Monthly Cost" value={fmtCurrency(stats.totalMonthly)} icon={<Icons.TrendingUp size={18} />} color="#2980b9" small />
        <StatCard label="Annual Cost" value={fmtCurrency(stats.totalAnnual)} icon={<Icons.BarChart size={18} />} color="#8e44ad" small />
        {stats.expiringSoon > 0 && (
          <StatCard label="Renewals Due" value={stats.expiringSoon} icon={<Icons.Calendar size={18} />} color="var(--warning-color)" />
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      {stats.expiringSoon > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(230,126,34,0.1)', border: '1px solid rgba(230,126,34,0.35)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.87rem', color: 'var(--warning-color, #e67e22)' }}>
          <Icons.Calendar size={16} />
          <strong>{stats.expiringSoon} license{stats.expiringSoon !== 1 ? 's' : ''} renewing within 30 days</strong>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>— check the Catalog tab for details.</span>
        </div>
      )}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {[
          { key: 'overview', label: 'Overview', count: enrichedLicenses.filter(l => l.is_active && l.license_type !== 'Expense Reimbursement').length },
          { key: 'catalog', label: 'Catalog', count: filteredCatalog.length },
          { key: 'assignments', label: 'Assignments', count: assignments.filter(a => a.is_active).length },
          { key: 'cost-allocation', label: 'Cost Allocation' },
        ].map(t => (
          <button
            key={t.key}
            className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}{t.count != null && <span style={{ marginLeft: 6, background: activeTab === t.key ? 'rgba(255,255,255,0.25)' : 'var(--border-color)', borderRadius: 10, padding: '1px 7px', fontSize: '0.72rem', fontWeight: 600 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB: Overview
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div>
          {/* Department filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Department:</span>
            {['', 'AFS', 'RS'].map(d => (
              <button key={d} className={`btn btn-sm ${deptFilter === d ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDeptFilter(d)}>
                {d || 'All'}
              </button>
            ))}
          </div>
          {/* Per-software summary cards */}
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>License Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 28 }}>
            {enrichedLicenses.filter(l => l.is_active && l.license_type !== 'Expense Reimbursement' && (!deptFilter || l.department === deptFilter)).map(lic => (
              <LicenseSummaryCard
                key={lic.id}
                lic={lic}
                onAssign={() => openAssign(lic)}
                onBulkAssign={() => openBulkAssign(lic)}
                onEdit={() => openEditLicense(lic)}
                isAdmin={isAdmin}
              />
            ))}
            {enrichedLicenses.filter(l => l.is_active).length === 0 && (
              <p style={{ color: 'var(--text-secondary)', gridColumn: '1/-1' }}>
                No software products yet. Click "Add Software" to get started.
              </p>
            )}
          </div>

          {/* Budget overview stacked bar */}
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 12px' }}>Monthly Budget Overview</h3>
          <CostBreakdownBar costAllocation={costAllocation} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: Catalog
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'catalog' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-box" style={{ flex: '1 1 220px', minWidth: 180 }}>
              <Icons.Search size={14} />
              <input
                placeholder="Search software or vendor…"
                value={catSearch}
                onChange={e => setCatSearch(e.target.value)}
              />
            </div>
            {['', 'AFS', 'RS'].map(d => (
              <button key={d} className={`btn btn-sm ${deptFilter === d ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDeptFilter(d)}>
                {d || 'All Depts'}
              </button>
            ))}
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
              {filteredCatalog.length} product{filteredCatalog.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Software</th>
                  <th>Vendor</th>
                  <th>Dept</th>
                  <th>Type</th>
                  <th>Cost / Seat</th>
                  <th>Cycle</th>
                  <th>Assigned</th>
                  <th>Monthly Cost</th>
                  <th>Annual Cost</th>
                  <th>Renewal Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCatalog.length === 0 && (
                  <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>No software products found.</td></tr>
                )}
                {filteredCatalog.map(lic => {
                  const renewal = getRenewalStatus(lic.renewal_date);
                  return (
                    <tr key={lic.id}>
                      <td style={{ fontWeight: 500 }}>{lic.name}</td>
                      <td>{lic.vendor || '-'}</td>
                      <td>{lic.department ? <span className="badge" style={{ background: lic.department === 'AFS' ? 'rgba(231,76,60,0.15)' : 'rgba(41,128,185,0.15)', color: lic.department === 'AFS' ? '#c0392b' : '#1a6fa0', fontSize: '0.7rem' }}>{lic.department}</span> : <span style={{ color: 'var(--text-secondary)' }}>-</span>}</td>
                      <td>{lic.license_type || '-'}</td>
                      <td>{lic.cost_per_seat != null ? fmtCurrency(lic.cost_per_seat) : '-'}</td>
                      <td>{lic.billing_cycle}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: lic.total_seats && lic.assigned_count > lic.total_seats ? 'var(--error-color)' : 'inherit' }}>{lic.assigned_count}</span>
                        {lic.total_seats ? <span style={{ color: 'var(--text-secondary)' }}> / {lic.total_seats}</span> : ''}
                        {lic.total_seats && lic.assigned_count > lic.total_seats && <span style={{ marginLeft: 5, fontSize: '0.7rem', background: 'rgba(231,76,60,0.12)', color: '#c0392b', borderRadius: 3, padding: '1px 5px' }}>over</span>}
                      </td>
                      <td>{fmtCurrency(monthlyCost(lic))}</td>
                      <td>{fmtCurrency(annualCost(lic))}</td>
                      <td>
                        {lic.renewal_date ? (
                          <span style={{ color: renewal === 'expired' ? 'var(--error-color)' : renewal === 'due-soon' ? 'var(--warning-color)' : 'inherit' }}>
                            {renewalDaysLabel(lic.renewal_date)}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        <span className={`badge ${lic.is_active ? 'badge-available' : 'badge-checked-out'}`}>
                          {lic.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {isAdmin && lic.is_active && (
                          <>
                            <button className="btn btn-secondary btn-sm" onClick={() => openBulkAssign(lic)} title="Bulk Assign">
                              <Icons.Users size={13} /> Bulk Assign
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => openAssign(lic)} title="Assign one">
                              <Icons.Plus size={13} /> Assign
                            </button>
                          </>
                          )}
                          {isAdmin && (
                            <>
                              <button className="btn btn-secondary btn-sm icon-btn" onClick={() => openEditLicense(lic)} title="Edit">
                                <Icons.Edit size={13} />
                              </button>
                              <button className="btn btn-danger btn-sm icon-btn" onClick={() => deleteLicense(lic)} title="Delete">
                                <Icons.Trash size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredCatalog.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 600, borderTop: '2px solid var(--border-color)' }}>
                    <td colSpan={7}>Total (active, assigned seats)</td>
                    <td>{fmtCurrency(filteredCatalog.filter(l => l.is_active).reduce((s, l) => s + monthlyCost(l), 0))}</td>
                    <td>{fmtCurrency(filteredCatalog.filter(l => l.is_active).reduce((s, l) => s + annualCost(l), 0))}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: Assignments
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'assignments' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-box" style={{ flex: '1 1 220px', minWidth: 180 }}>
              <Icons.Search size={14} />
              <input
                placeholder="Search employee or software…"
                value={assignSearch}
                onChange={e => setAssignSearch(e.target.value)}
              />
            </div>
            <select className="filter-select" value={assignSoftwareFilter} onChange={e => setAssignSoftwareFilter(e.target.value)}>
              <option value="">All Software</option>
              {licenses.filter(l => l.is_active).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <select className="filter-select" value={assignDivisionFilter} onChange={e => setAssignDivisionFilter(e.target.value)}>
              <option value="">All Divisions</option>
              {divisions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
              {filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Division</th>
                  <th>Software</th>
                  <th>Vendor</th>
                  <th>Cost / Seat</th>
                  <th>Billing</th>
                  <th>Monthly Cost</th>
                  <th>Assigned Date</th>
                  <th>Notes</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.length === 0 && (
                  <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>No assignments found.</td></tr>
                )}
                {filteredAssignments.map(a => {
                  const div = lookupDivision(divLookup, { employee_name: a.employee_name }, 'employee_name') || '-';
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 500 }}>{a.employee_name || '-'}</td>
                      <td>{a.employee_id || '-'}</td>
                      <td>{div}</td>
                      <td>{a.software_name || '-'}</td>
                      <td>{a.vendor || '-'}</td>
                      <td>{a.cost_per_seat != null ? fmtCurrency(a.cost_per_seat) : '-'}</td>
                      <td>{a.billing_cycle || '-'}</td>
                      <td>{a.cost_per_seat != null ? fmtCurrency(a.billing_cycle === 'Annual' ? a.cost_per_seat / 12 : a.billing_cycle === 'One-time' ? 0 : a.cost_per_seat) : '-'}</td>
                      <td>{a.assigned_date || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{a.notes || ''}</td>
                      {isAdmin && (
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm icon-btn" onClick={() => openEditAssignment(a)} title="Edit">
                              <Icons.Edit size={13} />
                            </button>
                            <button className="btn btn-danger btn-sm icon-btn" onClick={() => revokeAssignment(a)} title="Revoke">
                              <Icons.Trash size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: Cost Allocation
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'cost-allocation' && (
        <div>
          {(() => {
            const grandTotal = costAllocation.afsTotals.monthly + costAllocation.rsTotals.monthly + costAllocation.unallocTotals.monthly + costAllocation.expenseTotals.monthly;
            const pct = (v) => grandTotal > 0 ? `${Math.round(v / grandTotal * 100)}%` : '—';
            const costCards = [
              { label: 'AFS Monthly', value: costAllocation.afsTotals.monthly, color: '#e74c3c' },
              { label: 'RS Monthly', value: costAllocation.rsTotals.monthly, color: '#2980b9' },
              { label: 'Unallocated', value: costAllocation.unallocTotals.monthly, color: '#95a5a6' },
              { label: 'Expense Claims', value: costAllocation.expenseTotals.monthly, color: '#27ae60' },
            ];
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
                {costCards.map(c => (
                  <div key={c.label} className="stat-card" style={{ borderLeft: `4px solid ${c.color}` }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtCurrency(c.value)}</div>
                    <div style={{ fontSize: '0.78rem', color: c.color, fontWeight: 500, marginTop: 3 }}>{pct(c.value)} of total</div>
                  </div>
                ))}
                <div className="stat-card" style={{ borderLeft: '4px solid #27ae60', background: 'rgba(39,174,96,0.04)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Grand Total Monthly</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtCurrency(grandTotal)}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 3 }}>{fmtCurrency(grandTotal * 12)} / year</div>
                </div>
              </div>
            );
          })()}

          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Department Breakdown by Product</h3>
          <div className="table-container" style={{ marginBottom: 28 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Vendor</th>
                  <th style={{ background: 'rgba(231,76,60,0.08)', color: '#c0392b' }}>AFS Seats</th>
                  <th style={{ background: 'rgba(231,76,60,0.08)', color: '#c0392b' }}>AFS Monthly</th>
                  <th style={{ background: 'rgba(41,128,185,0.08)', color: '#1a6fa0' }}>RS Seats</th>
                  <th style={{ background: 'rgba(41,128,185,0.08)', color: '#1a6fa0' }}>RS Monthly</th>
                  <th>Total Monthly</th>
                  <th>Total Annual</th>
                </tr>
              </thead>
              <tbody>
                {costAllocation.products.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 28 }}>No department-allocated licenses yet. Edit licenses and set their Department to AFS or RS.</td></tr>
                )}
                {costAllocation.products.map(p => (
                  <tr key={p.name} style={{ background: (p.afs && !p.rs) || (!p.afs && p.rs) ? 'rgba(230,126,34,0.06)' : 'inherit' }}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td>{p.vendor || '-'}</td>
                    <td style={{ background: 'rgba(231,76,60,0.04)' }}>{p.afs ? p.afs.seats : <span style={{ color: 'var(--text-secondary)' }}>-</span>}</td>
                    <td style={{ background: 'rgba(231,76,60,0.04)', color: p.afs ? '#c0392b' : 'var(--text-secondary)' }}>{p.afs ? fmtCurrency(p.afs.monthly) : '-'}</td>
                    <td style={{ background: 'rgba(41,128,185,0.04)' }}>{p.rs ? p.rs.seats : <span style={{ color: 'var(--text-secondary)' }}>-</span>}</td>
                    <td style={{ background: 'rgba(41,128,185,0.04)', color: p.rs ? '#1a6fa0' : 'var(--text-secondary)' }}>{p.rs ? fmtCurrency(p.rs.monthly) : '-'}</td>
                    <td style={{ fontWeight: 600 }}>{fmtCurrency((p.afs?.monthly || 0) + (p.rs?.monthly || 0))}</td>
                    <td>{fmtCurrency(((p.afs?.monthly || 0) + (p.rs?.monthly || 0)) * 12)}</td>
                  </tr>
                ))}
              </tbody>
              {costAllocation.products.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                    <td colSpan={2}>Subtotal (Allocated)</td>
                    <td style={{ background: 'rgba(231,76,60,0.04)', color: '#c0392b' }}>{costAllocation.products.reduce((s, p) => s + (p.afs?.seats || 0), 0)}</td>
                    <td style={{ background: 'rgba(231,76,60,0.04)', color: '#c0392b' }}>{fmtCurrency(costAllocation.afsTotals.monthly)}</td>
                    <td style={{ background: 'rgba(41,128,185,0.04)', color: '#1a6fa0' }}>{costAllocation.products.reduce((s, p) => s + (p.rs?.seats || 0), 0)}</td>
                    <td style={{ background: 'rgba(41,128,185,0.04)', color: '#1a6fa0' }}>{fmtCurrency(costAllocation.rsTotals.monthly)}</td>
                    <td>{fmtCurrency(costAllocation.afsTotals.monthly + costAllocation.rsTotals.monthly)}</td>
                    <td>{fmtCurrency((costAllocation.afsTotals.monthly + costAllocation.rsTotals.monthly) * 12)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {costAllocation.unallocated.length > 0 && (
            <>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>Unallocated Licenses</h3>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: 12 }}>No department set. Edit these licenses and set Department to include them in cost reporting.</p>
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>Product</th><th>Vendor</th><th>Seats</th><th>Monthly</th><th>Annual</th></tr></thead>
                  <tbody>
                    {costAllocation.unallocated.map(lic => (
                      <tr key={lic.id}>
                        <td style={{ fontWeight: 500 }}>{lic.name}</td>
                        <td>{lic.vendor || '-'}</td>
                        <td>{lic.total_seats || '-'}</td>
                        <td>{fmtCurrency(monthlyCost(lic))}</td>
                        <td>{fmtCurrency(annualCost(lic))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 600, borderTop: '2px solid var(--border-color)' }}>
                      <td colSpan={3}>Total Unallocated</td>
                      <td>{fmtCurrency(costAllocation.unallocTotals.monthly)}</td>
                      <td>{fmtCurrency(costAllocation.unallocTotals.monthly * 12)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {/* Expense-reimbursed subscriptions */}
          {costAllocation.expenseItems.length > 0 && (
            <>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6, marginTop: 28 }}>Expense-Reimbursed Subscriptions</h3>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Software tools paid personally by staff and claimed back via Zoho Expenses. Costs are approximate monthly averages based on expense history.</p>
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>Tool</th><th>Vendor</th><th>Dept</th><th>Notes</th><th>Approx Monthly</th><th>Approx Annual</th><th></th></tr></thead>
                  <tbody>
                    {costAllocation.expenseItems.map(lic => (
                      <tr key={lic.id}>
                        <td style={{ fontWeight: 500 }}>{lic.name}</td>
                        <td>{lic.vendor || '-'}</td>
                        <td>{lic.department ? <span className="badge" style={{ background: lic.department === 'AFS' ? 'rgba(231,76,60,0.15)' : 'rgba(41,128,185,0.15)', color: lic.department === 'AFS' ? '#c0392b' : '#1a6fa0', fontSize: '0.7rem' }}>{lic.department}</span> : '-'}</td>
                        <td style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', maxWidth: 260 }}>{lic.notes || '-'}</td>
                        <td>{lic.cost_per_seat ? fmtCurrency(monthlyCost(lic)) : <span style={{ color: 'var(--text-secondary)' }}>TBC</span>}</td>
                        <td>{lic.cost_per_seat ? fmtCurrency(annualCost(lic)) : '-'}</td>
                        <td><button className="btn btn-sm btn-secondary" onClick={() => openEditLicense(lic)} title="Edit"><Icons.Edit size={13} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 600, borderTop: '2px solid var(--border-color)' }}>
                      <td colSpan={4}>Total Expense-Reimbursed</td>
                      <td>{fmtCurrency(costAllocation.expenseTotals.monthly)}</td>
                      <td>{fmtCurrency(costAllocation.expenseTotals.monthly * 12)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Add / Edit License
         ══════════════════════════════════════════════════════════════════ */}
      {showLicenseModal && (
        <div className="modal-overlay" onClick={() => setShowLicenseModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2>{editLicense ? 'Edit Software License' : 'Add Software License'}</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowLicenseModal(false)}>
                <Icons.Close size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Software Name *</label>
                <input
                  className="form-input"
                  value={licenseForm.name || ''}
                  onChange={e => setLicenseForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Microsoft 365 Business"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Vendor</label>
                  <input
                    className="form-input"
                    value={licenseForm.vendor || ''}
                    onChange={e => setLicenseForm(f => ({ ...f, vendor: e.target.value }))}
                    placeholder="e.g. Microsoft"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">License Type</label>
                  <select className="form-input" value={licenseForm.license_type || 'Per User'} onChange={e => setLicenseForm(f => ({ ...f, license_type: e.target.value }))}>
                    {LICENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Cost per Seat (ZAR)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={licenseForm.cost_per_seat ?? ''}
                    onChange={e => setLicenseForm(f => ({ ...f, cost_per_seat: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Billing Cycle</label>
                  <select className="form-input" value={licenseForm.billing_cycle || 'Monthly'} onChange={e => setLicenseForm(f => ({ ...f, billing_cycle: e.target.value }))}>
                    {BILLING_CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Total Seats Purchased</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={licenseForm.total_seats ?? ''}
                    onChange={e => setLicenseForm(f => ({ ...f, total_seats: e.target.value }))}
                    placeholder="Leave blank if unlimited"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Renewal Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={licenseForm.renewal_date || ''}
                    onChange={e => setLicenseForm(f => ({ ...f, renewal_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <select className="form-input" value={licenseForm.department || ''} onChange={e => setLicenseForm(f => ({ ...f, department: e.target.value }))}>
                  <option value="">— None / Shared —</option>
                  <option value="AFS">AFS</option>
                  <option value="RS">RS</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={licenseForm.notes || ''}
                  onChange={e => setLicenseForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes"
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={licenseForm.is_active !== false}
                    onChange={e => setLicenseForm(f => ({ ...f, is_active: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowLicenseModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveLicense} disabled={licSaving}>
                {licSaving ? 'Saving…' : editLicense ? 'Update' : 'Add Software'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Bulk Assign
         ══════════════════════════════════════════════════════════════════ */}
      {showBulkModal && bulkForLicense && (() => {
        const alreadyRevoked = assignments
          .filter(a => a.software_license_id === bulkForLicense.id && a.is_active && a.personnel_id)
          .map(a => a.personnel_id);
        const filtered = personnel.filter(p =>
          !bulkSearch ||
          p.full_name?.toLowerCase().includes(bulkSearch.toLowerCase()) ||
          p.employee_id?.toLowerCase().includes(bulkSearch.toLowerCase())
        );
        const allFiltered = filtered.every(p => bulkSelected.has(p.id));
        return (
          <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
            <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Bulk Assign — {bulkForLicense.name}</h2>
                <button className="btn btn-sm btn-secondary" onClick={() => setShowBulkModal(false)}>
                  <Icons.Close size={16} />
                </button>
              </div>
              <div className="modal-body" style={{ padding: '12px 20px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 10 }}>
                  Tick employees to assign. Unticking a currently assigned employee will revoke their licence.
                </p>
                {/* Search + select-all */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                  <div className="search-box" style={{ flex: 1 }}>
                    <Icons.Search size={13} />
                    <input
                      placeholder="Search employees…"
                      value={bulkSearch}
                      onChange={e => setBulkSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={allFiltered && filtered.length > 0}
                      onChange={e => {
                        setBulkSelected(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) filtered.forEach(p => next.add(p.id));
                          else filtered.forEach(p => next.delete(p.id));
                          return next;
                        });
                      }}
                    />
                    Select all
                  </label>
                </div>
                {/* Employee list */}
                <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                  {filtered.length === 0 && (
                    <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No employees found.</div>
                  )}
                  {filtered.map((p, i) => (
                    <label key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 14px',
                      background: i % 2 === 0 ? 'transparent' : 'var(--table-row-alt, rgba(0,0,0,0.02))',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                    }}>
                      <input
                        type="checkbox"
                        checked={bulkSelected.has(p.id)}
                        onChange={e => {
                          setBulkSelected(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(p.id);
                            else next.delete(p.id);
                            return next;
                          });
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{p.full_name}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                          {p.employee_id || ''}{p.division ? ` · ${p.division}` : ''}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {bulkSelected.size} employee{bulkSelected.size !== 1 ? 's' : ''} selected
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveBulkAssign} disabled={bulkSaving}>
                  {bulkSaving ? 'Saving…' : `Save Assignments`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Assign Software to Employee
         ══════════════════════════════════════════════════════════════════ */}
      {showAssignModal && assignForLicense && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2>{editAssignment ? 'Edit Assignment' : `Assign ${assignForLicense.name}`}</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowAssignModal(false)}>
                <Icons.Close size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Employee *</label>
                <select
                  className="form-input"
                  value={assignForm.personnel_id || ''}
                  onChange={e => setAssignForm(f => ({ ...f, personnel_id: e.target.value }))}
                >
                  <option value="">Select employee…</option>
                  {personnel.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.employee_id || 'no ID'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Assigned Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={assignForm.assigned_date || ''}
                  onChange={e => setAssignForm(f => ({ ...f, assigned_date: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input
                  className="form-input"
                  value={assignForm.notes || ''}
                  onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveAssignment} disabled={assignSaving}>
                {assignSaving ? 'Saving…' : editAssignment ? 'Update' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, small }) {
  return (
    <div className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: small ? '1.2rem' : '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        </div>
        <div style={{ color, opacity: 0.8 }}>{icon}</div>
      </div>
    </div>
  );
}

function LicenseSummaryCard({ lic, onAssign, onBulkAssign, onEdit, isAdmin }) {
  const monthly = monthlyCost(lic);
  const annual = annualCost(lic);
  const renewal = getRenewalStatus(lic.renewal_date);
  const overLimit = lic.total_seats > 0 && lic.assigned_count > lic.total_seats;
  const utilPct = lic.total_seats > 0 ? Math.min(100, (lic.assigned_count / lic.total_seats) * 100) : null;
  const fullyUsed = !overLimit && utilPct === 100;
  const barColor = overLimit ? 'var(--error-color, #e74c3c)' : fullyUsed ? '#27ae60' : utilPct >= 90 ? 'var(--warning-color, #e67e22)' : 'var(--accent-color, #3498db)';

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: `1px solid ${overLimit ? 'rgba(231,76,60,0.4)' : 'var(--border-color)'}`,
      borderRadius: 8,
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>{lic.name}</div>
          {lic.vendor && <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{lic.vendor}</div>}
        {lic.department && (
          <span style={{ display: 'inline-block', marginTop: 3, background: lic.department === 'AFS' ? 'rgba(231,76,60,0.12)' : 'rgba(41,128,185,0.12)', color: lic.department === 'AFS' ? '#c0392b' : '#1a6fa0', borderRadius: 4, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>
            {lic.department}
          </span>
        )}
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-secondary btn-sm icon-btn" onClick={onEdit} title="Edit"><Icons.Edit size={12} /></button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.85rem' }}>
        <KV label="Assigned" value={`${lic.assigned_count}${lic.total_seats ? ` / ${lic.total_seats}` : ''} seats`} valueStyle={{ color: overLimit ? 'var(--error-color)' : 'inherit' }} />
        <KV label="Cost/Seat" value={lic.cost_per_seat != null ? fmtCurrency(lic.cost_per_seat) : '-'} />
        <KV label="Monthly" value={fmtCurrency(monthly)} strong />
        <KV label="Annual" value={fmtCurrency(annual)} />
        {lic.renewal_date && (
          <KV label="Renewal" value={renewalDaysLabel(lic.renewal_date)}
            valueStyle={{ color: renewal === 'expired' ? 'var(--error-color)' : renewal === 'due-soon' ? 'var(--warning-color)' : 'inherit' }}
          />
        )}
      </div>

      {utilPct !== null && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{lic.assigned_count} / {lic.total_seats} seats</span>
            <span style={{ color: barColor, fontWeight: 600 }}>
              {Math.round(utilPct)}%{overLimit ? ' — over limit' : ''}
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4 }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${Math.min(100, utilPct)}%`,
              background: barColor,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      {lic.notes && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: 8, marginTop: 2, fontStyle: 'italic', lineHeight: 1.4 }} title={lic.notes}>
          {lic.notes.length > 90 ? lic.notes.slice(0, 90) + '…' : lic.notes}
        </div>
      )}
      </div>{/* end content wrapper */}

      {isAdmin && (
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={onBulkAssign}>
            <Icons.Users size={12} /> Bulk Assign
          </button>
          <button className="btn btn-secondary btn-sm icon-btn" onClick={onAssign} title="Assign single employee">
            <Icons.Plus size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function KV({ label, value, strong, valueStyle }) {
  return (
    <div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: 1 }}>{label}</div>
      <div style={{ fontWeight: strong ? 600 : 400, ...valueStyle }}>{value}</div>
    </div>
  );
}

function CostBreakdownBar({ costAllocation }) {
  const segments = [
    { label: 'AFS', value: costAllocation.afsTotals.monthly, color: '#e74c3c' },
    { label: 'RS', value: costAllocation.rsTotals.monthly, color: '#2980b9' },
    { label: 'Unallocated', value: costAllocation.unallocTotals.monthly, color: '#bdc3c7' },
    { label: 'Expense Claims', value: costAllocation.expenseTotals.monthly, color: '#27ae60' },
  ].filter(s => s.value > 0);
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return (
    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 28 }}>
      No cost data yet — add software and set departments to see the breakdown.
    </p>
  );
  return (
    <div style={{ marginBottom: 28 }}>
      {/* Stacked horizontal bar */}
      <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden', marginBottom: 14, border: '1px solid var(--border-color)' }}>
        {segments.map(s => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color, transition: 'width 0.5s ease' }}
            title={`${s.label}: ${fmtCurrency(s.value)}/mo (${Math.round(s.value / total * 100)}%)`}
          />
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 28px', marginBottom: 10 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem' }}>
            <div style={{ width: 13, height: 13, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{s.label}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(s.value)}/mo</span>
            <span style={{ background: s.color + '22', color: s.color, fontWeight: 700, borderRadius: 4, padding: '1px 6px', fontSize: '0.78rem' }}>
              {Math.round(s.value / total * 100)}%
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
        Grand total: <strong style={{ color: 'var(--text-primary)' }}>{fmtCurrency(total)}/month</strong>
        {' · '}
        <strong style={{ color: 'var(--text-primary)' }}>{fmtCurrency(total * 12)}/year</strong>
        {' · '}
        <span>Go to <strong>Cost Allocation</strong> tab for per-product breakdown</span>
      </div>
    </div>
  );
}

export default SoftwareLicenses;
