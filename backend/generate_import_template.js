/**
 * Generate Equipment Assignment Import Template
 * Run: node generate_import_template.js
 * 
 * Creates an Excel file with:
 *  - Import sheet with headers and example rows
 *  - Instructions sheet
 *  - Reference sheets with valid Equipment IDs, Employees, Locations
 */

const ExcelJS = require('exceljs');
const pool = require('./database/db');
const path = require('path');

async function generateTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Equipment Store';
  workbook.created = new Date();

  // ── Fetch reference data from DB ──────────────────────────────
  let equipmentRows = [], personnelRows = [], locationRows = [], customerRows = [];
  try {
    const eqRes = await pool.query(`
      SELECT e.equipment_id, e.equipment_name, e.serial_number, c.name AS category, s.name AS subcategory, e.status,
             l.name AS current_location, p.full_name AS current_holder
      FROM equipment e
      LEFT JOIN categories c ON e.category_id = c.id
      LEFT JOIN subcategories s ON e.subcategory_id = s.id
      LEFT JOIN locations l ON e.current_location_id = l.id
      LEFT JOIN personnel p ON e.current_holder_id = p.id
      ORDER BY e.equipment_id
    `);
    equipmentRows = eqRes.rows;

    const pRes = await pool.query(`
      SELECT employee_id, full_name, job_title, site, department
      FROM personnel WHERE is_active = true ORDER BY full_name
    `);
    personnelRows = pRes.rows;

    const lRes = await pool.query(`SELECT name, type FROM locations WHERE is_active = true ORDER BY name`);
    locationRows = lRes.rows;

    const cRes = await pool.query(`SELECT customer_number, display_name FROM customers WHERE is_active = true ORDER BY display_name`);
    customerRows = cRes.rows;
  } catch (err) {
    console.error('Could not fetch reference data (template will have empty reference sheets):', err.message);
  }

  // ── 1. IMPORT sheet ──────────────────────────────────────────
  const ws = workbook.addWorksheet('Import', { properties: { tabColor: { argb: 'FF4CAF50' } } });

  const columns = [
    { header: 'Equipment ID *', key: 'equipment_id', width: 18 },
    { header: 'Employee ID *', key: 'employee_id', width: 16 },
    { header: 'Location *', key: 'location', width: 25 },
    { header: 'Customer', key: 'customer', width: 25 },
    { header: 'Checkout Date *', key: 'checkout_date', width: 18 },
    { header: 'Expected Return Date', key: 'expected_return_date', width: 22 },
    { header: 'Notes', key: 'notes', width: 35 },
  ];

  ws.columns = columns;

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 28;

  // Add 2 example rows
  ws.addRow({ equipment_id: 'EQ-001', employee_id: 'EMP001', location: 'Middelburg Lab', customer: '', checkout_date: new Date('2026-01-15'), expected_return_date: '', notes: 'Assigned for Q1 project' });
  ws.addRow({ equipment_id: 'EQ-002', employee_id: 'EMP002', location: 'Secunda Site', customer: 'Sasol', checkout_date: new Date('2026-02-01'), expected_return_date: new Date('2026-06-30'), notes: '' });

  // Style example rows
  [2, 3].forEach(r => {
    const row = ws.getRow(r);
    row.font = { italic: true, color: { argb: 'FF999999' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
  });

  // Date format for date columns
  ws.getColumn('checkout_date').numFmt = 'YYYY-MM-DD';
  ws.getColumn('expected_return_date').numFmt = 'YYYY-MM-DD';

  // Add data validation if we have reference data
  if (equipmentRows.length > 0) {
    const eqIds = equipmentRows.map(r => `"${r.equipment_id}"`).join(',');
    if (eqIds.length < 255) {
      for (let row = 4; row <= 500; row++) {
        ws.getCell(`A${row}`).dataValidation = {
          type: 'list',
          formulae: [`Equipment!$A$2:$A$${equipmentRows.length + 1}`],
          showErrorMessage: true,
          errorTitle: 'Invalid Equipment ID',
          error: 'Please select a valid Equipment ID from the Equipment reference sheet.'
        };
      }
    }
  }

  if (personnelRows.length > 0) {
    for (let row = 4; row <= 500; row++) {
      ws.getCell(`B${row}`).dataValidation = {
        type: 'list',
        formulae: [`Employees!$A$2:$A$${personnelRows.length + 1}`],
        showErrorMessage: true,
        errorTitle: 'Invalid Employee ID',
        error: 'Please select a valid Employee ID from the Employees reference sheet.'
      };
    }
  }

  if (locationRows.length > 0) {
    for (let row = 4; row <= 500; row++) {
      ws.getCell(`C${row}`).dataValidation = {
        type: 'list',
        formulae: [`Locations!$A$2:$A$${locationRows.length + 1}`],
        showErrorMessage: true,
        errorTitle: 'Invalid Location',
        error: 'Please select a valid Location from the Locations reference sheet.'
      };
    }
  }

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // ── 2. INSTRUCTIONS sheet ────────────────────────────────────
  const instrWs = workbook.addWorksheet('Instructions', { properties: { tabColor: { argb: 'FFFFAB40' } } });
  instrWs.getColumn(1).width = 80;

  const instructions = [
    'EQUIPMENT ASSIGNMENT IMPORT TEMPLATE',
    '',
    'PURPOSE:',
    'Use this template to bulk-import current equipment assignments.',
    'Each row represents one piece of equipment checked out to an employee at a location.',
    '',
    'REQUIRED FIELDS (marked with *):',
    '  Equipment ID  — Must match an existing Equipment ID (see Equipment sheet)',
    '  Employee ID   — Must match an existing Employee ID (see Employees sheet)',
    '  Location      — Must match an existing Location name (see Locations sheet)',
    '  Checkout Date — Date the equipment was assigned (YYYY-MM-DD)',
    '',
    'OPTIONAL FIELDS:',
    '  Customer             — Customer name if equipment is at a customer site',
    '  Expected Return Date — When the equipment should be returned (YYYY-MM-DD)',
    '  Notes                — Any additional notes',
    '',
    'INSTRUCTIONS:',
    '1. Delete the 2 yellow example rows on the Import sheet',
    '2. Fill in your data starting from row 2 (row 1 is the header)',
    '3. Use the dropdown lists or reference sheets to find valid IDs',
    '4. Save the file',
    '5. Upload via the Equipment Store app: Settings > Import Assignments',
    '',
    'NOTES:',
    '- Equipment already marked "Checked Out" will have its assignment updated',
    '- Equipment marked "Available" will be checked out to the specified employee',
    '- Duplicate Equipment IDs in the import file will use the last row',
    '- Dates can be entered as YYYY-MM-DD or as Excel date values',
  ];

  instructions.forEach((line, i) => {
    const cell = instrWs.getCell(`A${i + 1}`);
    cell.value = line;
    if (i === 0) {
      cell.font = { bold: true, size: 14, color: { argb: 'FF1565C0' } };
    } else if (line.endsWith(':') && line === line.toUpperCase()) {
      cell.font = { bold: true, size: 11 };
    }
  });

  // ── 3. EQUIPMENT reference sheet ─────────────────────────────
  const eqWs = workbook.addWorksheet('Equipment', { properties: { tabColor: { argb: 'FF90CAF9' } } });
  eqWs.columns = [
    { header: 'Equipment ID', key: 'equipment_id', width: 18 },
    { header: 'Name', key: 'equipment_name', width: 30 },
    { header: 'Serial Number', key: 'serial_number', width: 20 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Subcategory', key: 'subcategory', width: 20 },
    { header: 'Current Status', key: 'status', width: 15 },
    { header: 'Current Location', key: 'current_location', width: 20 },
    { header: 'Current Holder', key: 'current_holder', width: 25 },
  ];
  styleRefSheet(eqWs);
  if (equipmentRows.length > 0) eqWs.addRows(equipmentRows);

  // ── 4. EMPLOYEES reference sheet ─────────────────────────────
  const empWs = workbook.addWorksheet('Employees', { properties: { tabColor: { argb: 'FFA5D6A7' } } });
  empWs.columns = [
    { header: 'Employee ID', key: 'employee_id', width: 16 },
    { header: 'Full Name', key: 'full_name', width: 30 },
    { header: 'Job Title', key: 'job_title', width: 25 },
    { header: 'Site', key: 'site', width: 20 },
    { header: 'Department', key: 'department', width: 20 },
  ];
  styleRefSheet(empWs);
  if (personnelRows.length > 0) empWs.addRows(personnelRows);

  // ── 5. LOCATIONS reference sheet ─────────────────────────────
  const locWs = workbook.addWorksheet('Locations', { properties: { tabColor: { argb: 'FFCE93D8' } } });
  locWs.columns = [
    { header: 'Location Name', key: 'name', width: 30 },
    { header: 'Type', key: 'type', width: 15 },
  ];
  styleRefSheet(locWs);
  if (locationRows.length > 0) locWs.addRows(locationRows);

  // ── 6. CUSTOMERS reference sheet ─────────────────────────────
  const custWs = workbook.addWorksheet('Customers', { properties: { tabColor: { argb: 'FFFFAB91' } } });
  custWs.columns = [
    { header: 'Customer Number', key: 'customer_number', width: 20 },
    { header: 'Display Name', key: 'display_name', width: 35 },
  ];
  styleRefSheet(custWs);
  if (customerRows.length > 0) custWs.addRows(customerRows);

  // ── Write file ───────────────────────────────────────────────
  const outputPath = path.join(__dirname, 'equipment_assignment_import_template.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Template saved to: ${outputPath}`);
  
  await pool.end();
}

function styleRefSheet(ws) {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF546E7A' } };
  header.alignment = { horizontal: 'center', vertical: 'middle' };
  header.height = 24;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

generateTemplate().catch(err => {
  console.error('Failed to generate template:', err);
  process.exit(1);
});
