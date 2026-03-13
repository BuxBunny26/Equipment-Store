import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================
// CSV Export
// ============================================
function exportCSV(data, columns, filename) {
    const header = columns.map(c => c.label).join(',');
    const rows = data.map(row =>
        columns.map(c => {
            let val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
            if (val === null || val === undefined) val = '';
            val = String(val).replace(/"/g, '""');
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                val = `"${val}"`;
            }
            return val;
        }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${filename}.csv`);
}

// ============================================
// Excel Export
// ============================================
function exportExcel(data, columns, filename, sheetName = 'Sheet1') {
    const headerRow = columns.map(c => c.label);
    const dataRows = data.map(row =>
        columns.map(c => {
            const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
            return val === null || val === undefined ? '' : val;
        })
    );
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

    // Auto-size columns
    ws['!cols'] = columns.map((c, i) => {
        const maxLen = Math.max(
            c.label.length,
            ...dataRows.map(r => String(r[i] || '').length)
        );
        return { wch: Math.min(maxLen + 2, 50) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `${filename}.xlsx`);
}

// ============================================
// PDF Export
// ============================================
function exportPDF(data, columns, filename, title) {
    const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });

    // Title
    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235);
    doc.text(title || filename, 14, 18);

    // Subtitle with date
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()}  |  ${data.length} record(s)`, 14, 25);

    // Table
    autoTable(doc, {
        startY: 30,
        head: [columns.map(c => c.label)],
        body: data.map(row =>
            columns.map(c => {
                const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
                return val === null || val === undefined ? '' : String(val);
            })
        ),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
    });

    doc.save(`${filename}.pdf`);
}

// ============================================
// Main Export Function
// ============================================
export function exportData(format, data, columns, filename, title) {
    if (!data || data.length === 0) {
        return { success: false, error: 'No data to export.' };
    }
    const ts = new Date().toISOString().slice(0, 10);
    const fn = `${filename}_${ts}`;

    try {
        switch (format) {
            case 'csv': exportCSV(data, columns, fn); break;
            case 'excel': exportExcel(data, columns, fn, title || filename); break;
            case 'pdf': exportPDF(data, columns, fn, title || filename); break;
            default: exportExcel(data, columns, fn, title || filename); break;
        }
        return { success: true };
    } catch (err) {
        console.error('Export failed:', err);
        return { success: false, error: 'Export failed: ' + err.message };
    }
}

// ============================================
// Pre-defined column configs for each export type
// ============================================

export const EXPORT_COLUMNS = {
    equipment: [
        { label: 'Equipment ID', accessor: 'equipment_id' },
        { label: 'Name', accessor: 'equipment_name' },
        { label: 'Category', accessor: 'category_name' },
        { label: 'Subcategory', accessor: 'subcategory_name' },
        { label: 'Serial Number', accessor: 'serial_number' },
        { label: 'Status', accessor: 'status' },
        { label: 'Location', accessor: 'current_location' },
        { label: 'Holder', accessor: 'current_holder' },
        { label: 'Manufacturer', accessor: 'manufacturer' },
        { label: 'Model', accessor: 'model' },
    ],

    checkedOut: [
        { label: 'Equipment ID', accessor: 'equipment_id' },
        { label: 'Name', accessor: 'equipment_name' },
        { label: 'Category', accessor: 'category' },
        { label: 'Serial Number', accessor: 'serial_number' },
        { label: 'Checked Out To', accessor: 'checked_out_to' },
        { label: 'Employee ID', accessor: 'holder_employee_id' },
        { label: 'Location', accessor: 'current_location' },
        { label: 'Checked Out', accessor: r => r.checked_out_at ? new Date(r.checked_out_at).toLocaleDateString() : '' },
        { label: 'Days Out', accessor: 'days_out' },
        { label: 'Overdue', accessor: r => r.is_overdue ? 'Yes' : 'No' },
    ],

    overdue: [
        { label: 'Equipment ID', accessor: 'equipment_id' },
        { label: 'Name', accessor: 'equipment_name' },
        { label: 'Category', accessor: 'category' },
        { label: 'Serial Number', accessor: 'serial_number' },
        { label: 'Checked Out To', accessor: 'checked_out_to' },
        { label: 'Employee ID', accessor: 'holder_employee_id' },
        { label: 'Email', accessor: 'holder_email' },
        { label: 'Checked Out', accessor: r => r.checked_out_at ? new Date(r.checked_out_at).toLocaleDateString() : '' },
        { label: 'Days Overdue', accessor: 'days_overdue' },
    ],

    available: [
        { label: 'Equipment ID', accessor: 'equipment_id' },
        { label: 'Name', accessor: 'equipment_name' },
        { label: 'Category', accessor: 'category' },
        { label: 'Subcategory', accessor: 'subcategory' },
        { label: 'Serial Number', accessor: 'serial_number' },
        { label: 'Location', accessor: 'current_location' },
        { label: 'Calibration Status', accessor: 'calibration_status' },
        { label: 'Calibration Expiry', accessor: r => r.calibration_expiry_date ? new Date(r.calibration_expiry_date).toLocaleDateString() : 'N/A' },
    ],

    lowStock: [
        { label: 'Equipment ID', accessor: 'equipment_id' },
        { label: 'Name', accessor: 'equipment_name' },
        { label: 'Category', accessor: 'category' },
        { label: 'Subcategory', accessor: 'subcategory' },
        { label: 'Available', accessor: 'available_quantity' },
        { label: 'Total', accessor: 'total_quantity' },
        { label: 'Reorder Level', accessor: 'reorder_level' },
        { label: 'Unit', accessor: 'unit' },
        { label: 'Location', accessor: 'current_location' },
    ],

    byCategory: [
        { label: 'Category', accessor: 'category' },
        { label: 'Total Items', accessor: 'total_items' },
        { label: 'Available', accessor: 'available' },
        { label: 'Checked Out', accessor: 'checked_out' },
        { label: 'Checkout Allowed', accessor: r => r.is_checkout_allowed ? 'Yes' : 'No' },
        { label: 'Type', accessor: r => r.is_consumable ? 'Consumable' : 'Equipment' },
    ],

    byLocation: [
        { label: 'Location', accessor: 'location' },
        { label: 'Total Items', accessor: 'total_items' },
        { label: 'Available', accessor: 'available' },
        { label: 'Checked Out', accessor: 'checked_out' },
    ],

    calibration: [
        { label: 'Equipment ID', accessor: 'equipment_code' },
        { label: 'Equipment Name', accessor: 'equipment_name' },
        { label: 'Category', accessor: 'category' },
        { label: 'Serial Number', accessor: 'serial_number' },
        { label: 'Manufacturer', accessor: 'manufacturer' },
        { label: 'Certificate #', accessor: 'certificate_number' },
        { label: 'Provider', accessor: 'calibration_provider' },
        { label: 'Cal. Date', accessor: r => r.calibration_date ? new Date(r.calibration_date).toLocaleDateString() : '' },
        { label: 'Expiry Date', accessor: r => r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : '' },
        { label: 'Status', accessor: 'calibration_status' },
    ],

    movements: [
        { label: 'Date', accessor: r => r.created_at ? new Date(r.created_at).toLocaleString() : '' },
        { label: 'Equipment ID', accessor: 'equipment_id' },
        { label: 'Equipment Name', accessor: 'equipment_name' },
        { label: 'Action', accessor: 'action' },
        { label: 'Quantity', accessor: 'quantity' },
        { label: 'Category', accessor: 'category' },
        { label: 'Location', accessor: 'location' },
        { label: 'Personnel', accessor: 'personnel_name' },
        { label: 'Notes', accessor: 'notes' },
    ],

    auditLog: [
        { label: 'Date', accessor: r => r.created_at ? new Date(r.created_at).toLocaleString() : '' },
        { label: 'Action', accessor: 'action' },
        { label: 'Table', accessor: 'table_name' },
        { label: 'Record ID', accessor: 'record_id' },
        { label: 'Changed By', accessor: 'user_full_name' },
    ],

    customers: [
        { label: 'Customer #', accessor: 'customer_number' },
        { label: 'Name', accessor: 'display_name' },
        { label: 'City', accessor: 'billing_city' },
        { label: 'State', accessor: 'billing_state' },
        { label: 'Country', accessor: 'billing_country' },
        { label: 'Currency', accessor: 'currency_code' },
        { label: 'Email', accessor: 'email' },
        { label: 'Active', accessor: r => r.is_active ? 'Yes' : 'No' },
    ],

    customerEquipment: [
        { label: 'Equipment ID', accessor: 'equipment_id' },
        { label: 'Name', accessor: 'equipment_name' },
        { label: 'Serial Number', accessor: 'serial_number' },
        { label: 'Category', accessor: 'category' },
        { label: 'Checked Out To', accessor: 'checked_out_to' },
        { label: 'Checked Out', accessor: r => r.checked_out_at ? new Date(r.checked_out_at).toLocaleDateString() : '' },
    ],

    maintenance: [
        { label: 'Date', accessor: r => r.maintenance_date ? new Date(r.maintenance_date).toLocaleDateString() : '' },
        { label: 'Equipment ID', accessor: 'equipment_code' },
        { label: 'Equipment', accessor: 'equipment_name' },
        { label: 'Type', accessor: 'maintenance_type' },
        { label: 'Description', accessor: 'description' },
        { label: 'Performed By', accessor: 'performed_by' },
        { label: 'Status', accessor: 'status' },
        { label: 'Cost', accessor: r => r.cost ? `${r.cost_currency || 'ZAR'} ${r.cost}` : '' },
        { label: 'Completed', accessor: r => r.completed_date ? new Date(r.completed_date).toLocaleDateString() : '' },
    ],

    reservations: [
        { label: 'Equipment ID', accessor: 'equipment_code' },
        { label: 'Equipment', accessor: 'equipment_name' },
        { label: 'Reserved By', accessor: 'personnel_name' },
        { label: 'Customer', accessor: 'customer_name' },
        { label: 'Start Date', accessor: r => r.start_date ? new Date(r.start_date).toLocaleDateString() : '' },
        { label: 'End Date', accessor: r => r.end_date ? new Date(r.end_date).toLocaleDateString() : '' },
        { label: 'Purpose', accessor: 'purpose' },
        { label: 'Status', accessor: 'status' },
    ],
};
