/**
 * Generate Equipment Assignment Import Template (standalone, no DB needed)
 * Run: node generate_template_standalone.js
 */

const ExcelJS = require('exceljs');
const path = require('path');

async function generateTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Equipment Store';
  workbook.created = new Date();

  // ── 1. IMPORT sheet ──
  const ws = workbook.addWorksheet('Import', { properties: { tabColor: { argb: 'FF4CAF50' } } });
  ws.columns = [
    { header: 'Equipment ID *', key: 'equipment_id', width: 18 },
    { header: 'Employee ID *', key: 'employee_id', width: 16 },
    { header: 'Location *', key: 'location', width: 25 },
    { header: 'Customer', key: 'customer', width: 25 },
    { header: 'Checkout Date *', key: 'checkout_date', width: 18 },
    { header: 'Expected Return Date', key: 'expected_return_date', width: 22 },
    { header: 'Notes', key: 'notes', width: 35 },
  ];

  // Style header
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 28;

  // Example rows
  ws.addRow({
    equipment_id: 'EQ-VA-001',
    employee_id: 'EMP001',
    location: 'Middelburg Lab',
    customer: '',
    checkout_date: new Date('2026-01-15'),
    expected_return_date: '',
    notes: 'Example - delete before importing'
  });
  ws.addRow({
    equipment_id: 'EQ-TC-002',
    employee_id: 'EMP002',
    location: 'Secunda Site',
    customer: 'Sasol',
    checkout_date: new Date('2026-02-01'),
    expected_return_date: new Date('2026-06-30'),
    notes: 'Example - delete before importing'
  });

  // Style example rows
  [2, 3].forEach(r => {
    const row = ws.getRow(r);
    row.font = { italic: true, color: { argb: 'FF999999' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
  });

  ws.getColumn('checkout_date').numFmt = 'YYYY-MM-DD';
  ws.getColumn('expected_return_date').numFmt = 'YYYY-MM-DD';
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // ── 2. INSTRUCTIONS sheet ──
  const instrWs = workbook.addWorksheet('Instructions', { properties: { tabColor: { argb: 'FFFFAB40' } } });
  instrWs.getColumn(1).width = 90;

  const instrLines = [
    'EQUIPMENT ASSIGNMENT IMPORT TEMPLATE',
    '',
    'PURPOSE:',
    'Bulk-import current equipment assignments to populate live data.',
    'Each row = one piece of equipment checked out to an employee at a location on a date.',
    '',
    'REQUIRED FIELDS (marked with *):',
    '  Equipment ID   — Must match an existing Equipment ID in the system (e.g. EQ-VA-001)',
    '  Employee ID    — Must match an existing Employee ID in the system (e.g. EMP001)',
    '  Location       — Must match an existing Location name exactly (e.g. Middelburg Lab)',
    '  Checkout Date  — Date the equipment was assigned (YYYY-MM-DD)',
    '',
    'OPTIONAL FIELDS:',
    '  Customer              — Customer name if equipment is at a customer site',
    '  Expected Return Date  — When equipment should be returned (YYYY-MM-DD)',
    '  Notes                 — Any additional notes',
    '',
    'HOW TO USE:',
    '1. Delete the 2 yellow example rows on the Import sheet',
    '2. Fill in your data starting from row 2 (row 1 is the header — do not change it)',
    '3. Use exact Equipment IDs, Employee IDs, and Location names as they appear in the system',
    '4. Dates can be typed as YYYY-MM-DD or selected via Excel date picker',
    '5. Save the file as .xlsx',
    '6. Upload via the Equipment Store app',
    '',
    'WHAT HAPPENS ON IMPORT:',
    '- Equipment status set to "Checked Out"',
    '- Employee assigned as current holder',
    '- Location updated on the equipment record',
    '- A checkout movement record is created with your specified date',
    '- If an Equipment ID appears multiple times, only the last occurrence is used',
    '',
    'TIPS:',
    '- Download the template from the site to get dropdown lists pre-filled with your data',
    '- You can export the current equipment list first to see all valid Equipment IDs',
    '- Check the Personnel/Employees page in the app for valid Employee IDs',
  ];

  instrLines.forEach((line, i) => {
    const cell = instrWs.getCell(`A${i + 1}`);
    cell.value = line;
    if (i === 0) cell.font = { bold: true, size: 14, color: { argb: 'FF1565C0' } };
    else if (line.endsWith(':') && line === line.toUpperCase()) cell.font = { bold: true, size: 11 };
  });

  // ── Write file ──
  const desktopPath = path.join(
    'C:', 'Users', 'nadhi',
    'OneDrive - Wearcheck Reliability Solutions',
    'Desktop',
    'Equipment_Assignment_Import_Template.xlsx'
  );
  await workbook.xlsx.writeFile(desktopPath);
  console.log(`\nTemplate saved to:\n  ${desktopPath}\n`);
}

generateTemplate().then(() => process.exit(0)).catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
