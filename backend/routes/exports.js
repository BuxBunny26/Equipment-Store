const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const ExcelJS = require('exceljs');
const multer = require('multer');

// Configure multer for Excel file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are allowed'));
    }
  }
});

// Export equipment list to Excel
router.get('/equipment', async (req, res) => {
  try {
    const { category, status, format = 'xlsx' } = req.query;
    
    let query = `
      SELECT 
        e.equipment_id AS "Equipment ID",
        e.equipment_name AS "Equipment Name",
        e.serial_number AS "Serial Number",
        cat.name AS "Category",
        sub.name AS "Subcategory",
        e.status AS "Status",
        l.name AS "Current Location",
        p.full_name AS "Current Holder",
        e.is_quantity_tracked AS "Quantity Tracked",
        e.available_quantity AS "Available Qty",
        e.total_quantity AS "Total Qty",
        e.unit AS "Unit",
        e.notes AS "Notes",
        e.created_at AS "Created At"
      FROM equipment e
      LEFT JOIN categories cat ON e.category_id = cat.id
      LEFT JOIN subcategories sub ON e.subcategory_id = sub.id
      LEFT JOIN locations l ON e.current_location_id = l.id
      LEFT JOIN personnel p ON e.current_holder_id = p.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (category) {
      query += ` AND cat.name = $${paramIndex++}`;
      params.push(category);
    }
    
    if (status) {
      query += ` AND e.status = $${paramIndex++}`;
      params.push(status);
    }
    
    query += ' ORDER BY e.equipment_id';
    
    const result = await pool.query(query, params);
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Equipment Store';
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet('Equipment');
    
    if (result.rows.length > 0) {
      worksheet.columns = Object.keys(result.rows[0]).map(key => ({
        header: key,
        key: key,
        width: key.length + 10
      }));
      
      worksheet.addRows(result.rows);
      
      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=equipment_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting equipment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export movements/history to Excel
router.get('/movements', async (req, res) => {
  try {
    const { equipment_id, from_date, to_date, action } = req.query;
    
    let query = `
      SELECT 
        e.equipment_id AS "Equipment ID",
        e.equipment_name AS "Equipment Name",
        em.action AS "Action",
        em.quantity AS "Quantity",
        l.name AS "Location",
        p.full_name AS "Personnel",
        c.display_name AS "Customer",
        em.notes AS "Notes",
        em.created_at AS "Date/Time",
        em.created_by AS "Recorded By"
      FROM equipment_movements em
      JOIN equipment e ON em.equipment_id = e.id
      LEFT JOIN locations l ON em.location_id = l.id
      LEFT JOIN personnel p ON em.personnel_id = p.id
      LEFT JOIN customers c ON em.customer_id = c.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (equipment_id) {
      query += ` AND e.id = $${paramIndex++}`;
      params.push(equipment_id);
    }
    
    if (from_date) {
      query += ` AND em.created_at >= $${paramIndex++}`;
      params.push(from_date);
    }
    
    if (to_date) {
      query += ` AND em.created_at <= $${paramIndex++}`;
      params.push(to_date);
    }
    
    if (action) {
      query += ` AND em.action = $${paramIndex++}`;
      params.push(action);
    }
    
    query += ' ORDER BY em.created_at DESC';
    
    const result = await pool.query(query, params);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Movements');
    
    if (result.rows.length > 0) {
      worksheet.columns = Object.keys(result.rows[0]).map(key => ({
        header: key,
        key: key,
        width: key.length + 10
      }));
      
      worksheet.addRows(result.rows);
      
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=movements_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting movements:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export calibration status to Excel
router.get('/calibration', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        e.equipment_id AS "Equipment ID",
        e.equipment_name AS "Equipment Name",
        e.serial_number AS "Serial Number",
        cat.name AS "Category",
        cr.calibration_date AS "Last Calibration",
        cr.expiry_date AS "Expiry Date",
        cr.certificate_number AS "Certificate No.",
        cr.calibration_provider AS "Provider",
        CASE 
          WHEN cr.expiry_date IS NULL THEN 'Not Calibrated'
          WHEN cr.expiry_date < CURRENT_DATE THEN 'Expired'
          WHEN cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
          ELSE 'Valid'
        END AS "Status",
        cr.expiry_date - CURRENT_DATE AS "Days Until Expiry"
      FROM equipment e
      JOIN categories cat ON e.category_id = cat.id
      LEFT JOIN LATERAL (
        SELECT * FROM calibration_records 
        WHERE equipment_id = e.id 
        ORDER BY calibration_date DESC 
        LIMIT 1
      ) cr ON true
      WHERE e.requires_calibration = true
    `;
    
    const params = [];
    
    if (status) {
      // Status filter would be applied here based on calculated status
    }
    
    query += ' ORDER BY cr.expiry_date NULLS FIRST, e.equipment_id';
    
    const result = await pool.query(query, params);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Calibration Status');
    
    if (result.rows.length > 0) {
      worksheet.columns = Object.keys(result.rows[0]).map(key => ({
        header: key,
        key: key,
        width: key.length + 10
      }));
      
      worksheet.addRows(result.rows);
      
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      
      // Conditional formatting for status column
      result.rows.forEach((row, index) => {
        const statusCell = worksheet.getCell(`I${index + 2}`);
        if (row.Status === 'Expired') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
        } else if (row.Status === 'Due Soon') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } };
        } else if (row.Status === 'Valid') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } };
        }
      });
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=calibration_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting calibration:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export checked out equipment
router.get('/checked-out', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.equipment_id AS "Equipment ID",
        e.equipment_name AS "Equipment Name",
        e.serial_number AS "Serial Number",
        cat.name AS "Category",
        l.name AS "Location",
        p.full_name AS "Checked Out By",
        c.display_name AS "Customer",
        e.last_action_timestamp AS "Checked Out Date",
        CURRENT_DATE - e.last_action_timestamp::date AS "Days Out"
      FROM equipment e
      JOIN categories cat ON e.category_id = cat.id
      LEFT JOIN locations l ON e.current_location_id = l.id
      LEFT JOIN personnel p ON e.current_holder_id = p.id
      LEFT JOIN equipment_movements em ON e.id = em.equipment_id
        AND em.id = (SELECT MAX(id) FROM equipment_movements WHERE equipment_id = e.id)
      LEFT JOIN customers c ON em.customer_id = c.id
      WHERE e.status = 'Checked Out'
      ORDER BY e.last_action_timestamp DESC
    `);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Checked Out Equipment');
    
    if (result.rows.length > 0) {
      worksheet.columns = Object.keys(result.rows[0]).map(key => ({
        header: key,
        key: key,
        width: key.length + 10
      }));
      
      worksheet.addRows(result.rows);
      
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=checked_out_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting checked out:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export maintenance log
router.get('/maintenance', async (req, res) => {
  try {
    const { from_date, to_date, status } = req.query;
    
    let query = `
      SELECT 
        e.equipment_id AS "Equipment ID",
        e.equipment_name AS "Equipment Name",
        mt.name AS "Maintenance Type",
        ml.maintenance_date AS "Maintenance Date",
        ml.completed_date AS "Completed Date",
        ml.description AS "Description",
        ml.performed_by AS "Performed By",
        ml.external_provider AS "External Provider",
        ml.cost AS "Cost",
        ml.cost_currency AS "Currency",
        ml.downtime_days AS "Downtime (Days)",
        ml.status AS "Status",
        ml.work_order_number AS "Work Order",
        ml.next_maintenance_date AS "Next Maintenance",
        ml.notes AS "Notes"
      FROM maintenance_log ml
      JOIN equipment e ON ml.equipment_id = e.id
      JOIN maintenance_types mt ON ml.maintenance_type_id = mt.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (from_date) {
      query += ` AND ml.maintenance_date >= $${paramIndex++}`;
      params.push(from_date);
    }
    
    if (to_date) {
      query += ` AND ml.maintenance_date <= $${paramIndex++}`;
      params.push(to_date);
    }
    
    if (status) {
      query += ` AND ml.status = $${paramIndex++}`;
      params.push(status);
    }
    
    query += ' ORDER BY ml.maintenance_date DESC';
    
    const result = await pool.query(query, params);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Maintenance Log');
    
    if (result.rows.length > 0) {
      worksheet.columns = Object.keys(result.rows[0]).map(key => ({
        header: key,
        key: key,
        width: key.length + 10
      }));
      
      worksheet.addRows(result.rows);
      
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=maintenance_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting maintenance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export audit log
router.get('/audit', async (req, res) => {
  try {
    const { from_date, to_date, table_name } = req.query;
    
    let query = `
      SELECT 
        al.created_at AS "Date/Time",
        al.table_name AS "Table",
        al.record_id AS "Record ID",
        al.action AS "Action",
        COALESCE(u.full_name, al.user_name, 'System') AS "User",
        al.changed_fields AS "Changed Fields",
        al.ip_address AS "IP Address"
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (from_date) {
      query += ` AND al.created_at >= $${paramIndex++}`;
      params.push(from_date);
    }
    
    if (to_date) {
      query += ` AND al.created_at <= $${paramIndex++}`;
      params.push(to_date);
    }
    
    if (table_name) {
      query += ` AND al.table_name = $${paramIndex++}`;
      params.push(table_name);
    }
    
    query += ' ORDER BY al.created_at DESC LIMIT 10000';
    
    const result = await pool.query(query, params);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Audit Log');
    
    if (result.rows.length > 0) {
      worksheet.columns = Object.keys(result.rows[0]).map(key => ({
        header: key,
        key: key,
        width: key.length + 10
      }));
      
      worksheet.addRows(result.rows);
      
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=audit_log_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting audit log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export customer equipment
router.get('/customer-equipment', async (req, res) => {
  try {
    const { customer_id } = req.query;
    
    let query = `
      SELECT 
        c.display_name AS "Customer",
        c.shipping_city AS "City",
        e.equipment_id AS "Equipment ID",
        e.equipment_name AS "Equipment Name",
        e.serial_number AS "Serial Number",
        cat.name AS "Category",
        p.full_name AS "Checked Out By",
        em.created_at AS "Since",
        CURRENT_DATE - em.created_at::date AS "Days"
      FROM equipment e
      JOIN categories cat ON e.category_id = cat.id
      JOIN equipment_movements em ON e.id = em.equipment_id
      JOIN customers c ON em.customer_id = c.id
      LEFT JOIN personnel p ON em.personnel_id = p.id
      WHERE e.status = 'Checked Out'
        AND em.action = 'OUT'
        AND em.customer_id IS NOT NULL
        AND em.id = (SELECT MAX(id) FROM equipment_movements WHERE equipment_id = e.id)
    `;
    
    const params = [];
    
    if (customer_id) {
      query += ' AND c.id = $1';
      params.push(customer_id);
    }
    
    query += ' ORDER BY c.display_name, e.equipment_name';
    
    const result = await pool.query(query, params);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Customer Equipment');
    
    if (result.rows.length > 0) {
      worksheet.columns = Object.keys(result.rows[0]).map(key => ({
        header: key,
        key: key,
        width: key.length + 10
      }));
      
      worksheet.addRows(result.rows);
      
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=customer_equipment_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting customer equipment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download equipment import template
router.get('/equipment-template', async (req, res) => {
  try {
    // Fetch categories, subcategories, and locations for reference sheet
    const [catResult, subResult, locResult] = await Promise.all([
      pool.query('SELECT id, name, is_consumable FROM categories ORDER BY name'),
      pool.query('SELECT s.id, s.name, s.category_id, c.name as category_name FROM subcategories s JOIN categories c ON s.category_id = c.id ORDER BY c.name, s.name'),
      pool.query("SELECT id, name FROM locations WHERE is_active = true ORDER BY name"),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Equipment Store';
    workbook.created = new Date();

    // ---- Main data entry sheet ----
    const ws = workbook.addWorksheet('Equipment Import');

    ws.columns = [
      { header: 'Equipment ID *', key: 'equipment_id', width: 18 },
      { header: 'Equipment Name *', key: 'equipment_name', width: 30 },
      { header: 'Category *', key: 'category', width: 25 },
      { header: 'Subcategory *', key: 'subcategory', width: 25 },
      { header: 'Manufacturer', key: 'manufacturer', width: 20 },
      { header: 'Model', key: 'model', width: 20 },
      { header: 'Serial Number', key: 'serial_number', width: 20 },
      { header: 'Location *', key: 'location', width: 25 },
      { header: 'Description', key: 'description', width: 35 },
      { header: 'Notes', key: 'notes', width: 35 },
    ];

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1976D2' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    // Add 2 example rows
    ws.addRow({
      equipment_id: 'EQ-EXAMPLE-001',
      equipment_name: 'SKF CMXA 80 Analyzer',
      category: catResult.rows[0]?.name || 'Vibration Analysis',
      subcategory: subResult.rows[0]?.name || 'Analyzers',
      manufacturer: 'SKF',
      model: 'CMXA 80',
      serial_number: 'SN-12345',
      location: locResult.rows[0]?.name || 'WearCheck - Springs',
      description: 'Portable vibration analyzer',
      notes: '',
    });
    ws.addRow({
      equipment_id: 'EQ-EXAMPLE-002',
      equipment_name: 'Fluke Ti480 Thermal Camera',
      category: catResult.rows.find(c => !c.is_consumable)?.name || 'Thermal Camera',
      subcategory: 'Handheld Cameras',
      manufacturer: 'Fluke',
      model: 'Ti480',
      serial_number: 'SN-67890',
      location: locResult.rows[0]?.name || 'WearCheck - Springs',
      description: 'Infrared thermal imaging camera',
      notes: 'Delete these example rows before importing',
    });

    // Style example rows in italic gray
    [2, 3].forEach(rowNum => {
      const row = ws.getRow(rowNum);
      row.font = { italic: true, color: { argb: 'FF999999' } };
    });

    // ---- Reference sheet: Categories & Subcategories ----
    const refSheet = workbook.addWorksheet('Reference - Categories');
    refSheet.columns = [
      { header: 'Category', key: 'category', width: 30 },
      { header: 'Subcategory', key: 'subcategory', width: 30 },
      { header: 'Type', key: 'type', width: 15 },
    ];
    const refHeader = refSheet.getRow(1);
    refHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    refHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF388E3C' } };

    subResult.rows.forEach(sub => {
      const cat = catResult.rows.find(c => c.id === sub.category_id);
      refSheet.addRow({
        category: sub.category_name,
        subcategory: sub.name,
        type: cat?.is_consumable ? 'Consumable' : 'Equipment',
      });
    });

    // ---- Reference sheet: Locations ----
    const locSheet = workbook.addWorksheet('Reference - Locations');
    locSheet.columns = [
      { header: 'Location Name', key: 'name', width: 35 },
    ];
    const locHeader = locSheet.getRow(1);
    locHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    locHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF388E3C' } };

    locResult.rows.forEach(loc => {
      locSheet.addRow({ name: loc.name });
    });

    // ---- Instructions sheet ----
    const instrSheet = workbook.addWorksheet('Instructions');
    instrSheet.getColumn(1).width = 80;
    const instructions = [
      'EQUIPMENT IMPORT TEMPLATE - INSTRUCTIONS',
      '',
      '1. Fill in your equipment data on the "Equipment Import" sheet.',
      '2. Fields marked with * are required.',
      '3. Category and Subcategory must exactly match values in the "Reference - Categories" sheet.',
      '4. Location must exactly match a value in the "Reference - Locations" sheet.',
      '5. Equipment ID must be unique - duplicates will be skipped.',
      '6. Serial Number should be unique if provided.',
      '7. Delete the example rows (gray italic) before importing.',
      '8. Save the file and use the Import button on the Equipment List page.',
      '',
      'COLUMN DETAILS:',
      '  Equipment ID * — Unique identifier (e.g., EQ-VA-001, EQP-TC-042)',
      '  Equipment Name * — Display name of the equipment',
      '  Category * — Must match a category from Reference sheet',
      '  Subcategory * — Must match a subcategory under the chosen category',
      '  Manufacturer — Equipment manufacturer (e.g., SKF, Fluke)',
      '  Model — Equipment model number',
      '  Serial Number — Device serial number (must be unique if provided)',
      '  Location * — Storage location, must match Reference sheet',
      '  Description — Optional description',
      '  Notes — Optional notes',
    ];
    instructions.forEach((text, i) => {
      const row = instrSheet.getRow(i + 1);
      row.getCell(1).value = text;
      if (i === 0) {
        row.font = { bold: true, size: 14 };
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=equipment_import_template.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ASSIGNMENT IMPORT TEMPLATE & IMPORT
// ============================================

// Download assignment import template (Equipment + Employee + Location + Date)
router.get('/assignment-template', async (req, res) => {
  try {
    const [eqRes, pRes, lRes, cRes] = await Promise.all([
      pool.query(`
        SELECT e.equipment_id, e.equipment_name, e.serial_number, c.name AS category, e.status
        FROM equipment e
        LEFT JOIN categories c ON e.category_id = c.id
        ORDER BY e.equipment_id
      `),
      pool.query(`SELECT employee_id, full_name, job_title, site FROM personnel WHERE is_active = true ORDER BY full_name`),
      pool.query(`SELECT name, type FROM locations WHERE is_active = true ORDER BY name`),
      pool.query(`SELECT customer_number, display_name FROM customers WHERE is_active = true ORDER BY display_name`)
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Equipment Store';
    workbook.created = new Date();

    // ── Import sheet ──
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

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 28;

    // Example rows
    ws.addRow({ equipment_id: 'EQ-001', employee_id: 'EMP001', location: 'Middelburg Lab', customer: '', checkout_date: new Date('2026-01-15'), expected_return_date: '', notes: 'Example row - delete before importing' });
    ws.addRow({ equipment_id: 'EQ-002', employee_id: 'EMP002', location: 'Secunda Site', customer: 'Sasol', checkout_date: new Date('2026-02-01'), expected_return_date: new Date('2026-06-30'), notes: 'Example row - delete before importing' });

    [2, 3].forEach(r => {
      const row = ws.getRow(r);
      row.font = { italic: true, color: { argb: 'FF999999' } };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
    });

    ws.getColumn('checkout_date').numFmt = 'YYYY-MM-DD';
    ws.getColumn('expected_return_date').numFmt = 'YYYY-MM-DD';

    // Data validation dropdowns from reference sheets
    for (let row = 4; row <= 500; row++) {
      if (eqRes.rows.length > 0) {
        ws.getCell(`A${row}`).dataValidation = {
          type: 'list', formulae: [`Equipment!$A$2:$A$${eqRes.rows.length + 1}`],
          showErrorMessage: true, errorTitle: 'Invalid', error: 'Select from Equipment sheet'
        };
      }
      if (pRes.rows.length > 0) {
        ws.getCell(`B${row}`).dataValidation = {
          type: 'list', formulae: [`Employees!$A$2:$A$${pRes.rows.length + 1}`],
          showErrorMessage: true, errorTitle: 'Invalid', error: 'Select from Employees sheet'
        };
      }
      if (lRes.rows.length > 0) {
        ws.getCell(`C${row}`).dataValidation = {
          type: 'list', formulae: [`Locations!$A$2:$A$${lRes.rows.length + 1}`],
          showErrorMessage: true, errorTitle: 'Invalid', error: 'Select from Locations sheet'
        };
      }
    }
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // ── Instructions sheet ──
    const instrWs = workbook.addWorksheet('Instructions', { properties: { tabColor: { argb: 'FFFFAB40' } } });
    instrWs.getColumn(1).width = 85;
    const instrLines = [
      'EQUIPMENT ASSIGNMENT IMPORT TEMPLATE',
      '',
      'PURPOSE:',
      'Bulk-import current equipment assignments to populate live data.',
      'Each row = one piece of equipment checked out to an employee at a location on a date.',
      '',
      'REQUIRED FIELDS (marked *):',
      '  Equipment ID  — Must match an existing Equipment ID (see Equipment sheet)',
      '  Employee ID   — Must match an existing Employee ID (see Employees sheet)',
      '  Location      — Must match an existing Location name (see Locations sheet)',
      '  Checkout Date — Date the equipment was assigned (YYYY-MM-DD or Excel date)',
      '',
      'OPTIONAL FIELDS:',
      '  Customer             — Customer name (if at a customer site)',
      '  Expected Return Date — When equipment should be returned',
      '  Notes                — Any additional notes',
      '',
      'HOW TO USE:',
      '1. Delete the 2 yellow example rows on the Import sheet',
      '2. Fill in your data starting from row 2',
      '3. Use the dropdown lists — they pull from the reference sheets',
      '4. Save the file',
      '5. Go to Equipment Store > Equipment page > Import Assignments button',
      '6. Upload this file',
      '',
      'WHAT HAPPENS ON IMPORT:',
      '- Equipment set to "Checked Out" status',
      '- Employee assigned as current holder',
      '- Location updated on the equipment record',
      '- A checkout movement record is created with the date you specified',
      '- If Equipment ID appears multiple times, only the last row is used',
    ];
    instrLines.forEach((line, i) => {
      const cell = instrWs.getCell(`A${i + 1}`);
      cell.value = line;
      if (i === 0) cell.font = { bold: true, size: 14, color: { argb: 'FF1565C0' } };
      else if (line.endsWith(':') && line === line.toUpperCase()) cell.font = { bold: true, size: 11 };
    });

    // ── Reference sheets ──
    const styleRef = (sheet) => {
      const h = sheet.getRow(1);
      h.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF546E7A' } };
      h.alignment = { horizontal: 'center' };
      h.height = 24;
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    };

    const eqWs = workbook.addWorksheet('Equipment', { properties: { tabColor: { argb: 'FF90CAF9' } } });
    eqWs.columns = [
      { header: 'Equipment ID', key: 'equipment_id', width: 18 },
      { header: 'Name', key: 'equipment_name', width: 30 },
      { header: 'Serial Number', key: 'serial_number', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Current Status', key: 'status', width: 15 },
    ];
    styleRef(eqWs);
    eqWs.addRows(eqRes.rows);

    const empWs = workbook.addWorksheet('Employees', { properties: { tabColor: { argb: 'FFA5D6A7' } } });
    empWs.columns = [
      { header: 'Employee ID', key: 'employee_id', width: 16 },
      { header: 'Full Name', key: 'full_name', width: 30 },
      { header: 'Job Title', key: 'job_title', width: 25 },
      { header: 'Site', key: 'site', width: 20 },
    ];
    styleRef(empWs);
    empWs.addRows(pRes.rows);

    const locWs = workbook.addWorksheet('Locations', { properties: { tabColor: { argb: 'FFCE93D8' } } });
    locWs.columns = [
      { header: 'Location Name', key: 'name', width: 30 },
      { header: 'Type', key: 'type', width: 15 },
    ];
    styleRef(locWs);
    locWs.addRows(lRes.rows);

    const custWs = workbook.addWorksheet('Customers', { properties: { tabColor: { argb: 'FFFFAB91' } } });
    custWs.columns = [
      { header: 'Customer Number', key: 'customer_number', width: 20 },
      { header: 'Display Name', key: 'display_name', width: 35 },
    ];
    styleRef(custWs);
    custWs.addRows(cRes.rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=assignment_import_template.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating assignment template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import assignments from filled-in template
router.post('/import-assignments', upload.single('file'), async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const ws = workbook.getWorksheet('Import') || workbook.getWorksheet(1);
    if (!ws) {
      return res.status(400).json({ error: 'Could not find "Import" worksheet' });
    }

    // Parse rows (skip header row 1)
    const rows = [];
    const errors = [];

    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // skip header

      const equipmentId = row.getCell(1).text?.trim();
      const employeeId = row.getCell(2).text?.trim();
      const location = row.getCell(3).text?.trim();
      const customer = row.getCell(4).text?.trim();
      let checkoutDate = row.getCell(5).value;
      let expectedReturnDate = row.getCell(6).value;
      const notes = row.getCell(7).text?.trim();

      // Skip empty rows
      if (!equipmentId && !employeeId) return;

      // Validate required fields
      if (!equipmentId) { errors.push(`Row ${rowNum}: Missing Equipment ID`); return; }
      if (!employeeId) { errors.push(`Row ${rowNum}: Missing Employee ID`); return; }
      if (!location) { errors.push(`Row ${rowNum}: Missing Location`); return; }
      if (!checkoutDate) { errors.push(`Row ${rowNum}: Missing Checkout Date`); return; }

      // Parse dates
      if (checkoutDate instanceof Date) {
        checkoutDate = checkoutDate.toISOString().split('T')[0];
      } else if (typeof checkoutDate === 'object' && checkoutDate.result) {
        checkoutDate = new Date(checkoutDate.result).toISOString().split('T')[0];
      } else {
        checkoutDate = String(checkoutDate).trim();
      }

      if (expectedReturnDate instanceof Date) {
        expectedReturnDate = expectedReturnDate.toISOString().split('T')[0];
      } else if (typeof expectedReturnDate === 'object' && expectedReturnDate?.result) {
        expectedReturnDate = new Date(expectedReturnDate.result).toISOString().split('T')[0];
      } else if (expectedReturnDate) {
        expectedReturnDate = String(expectedReturnDate).trim() || null;
      } else {
        expectedReturnDate = null;
      }

      rows.push({ equipmentId, employeeId, location, customer, checkoutDate, expectedReturnDate, notes, rowNum });
    });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No valid data rows found', errors });
    }

    // Process in a transaction
    await client.query('BEGIN');

    const results = { success: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      try {
        // Look up equipment
        const eqRes = await client.query('SELECT id, status FROM equipment WHERE equipment_id = $1', [row.equipmentId]);
        if (eqRes.rows.length === 0) {
          results.errors.push(`Row ${row.rowNum}: Equipment "${row.equipmentId}" not found`);
          results.skipped++;
          continue;
        }
        const equipmentPk = eqRes.rows[0].id;

        // Look up employee
        const empRes = await client.query('SELECT id FROM personnel WHERE employee_id = $1', [row.employeeId]);
        if (empRes.rows.length === 0) {
          results.errors.push(`Row ${row.rowNum}: Employee "${row.employeeId}" not found`);
          results.skipped++;
          continue;
        }
        const personnelId = empRes.rows[0].id;

        // Look up location
        const locRes = await client.query('SELECT id FROM locations WHERE name = $1', [row.location]);
        if (locRes.rows.length === 0) {
          results.errors.push(`Row ${row.rowNum}: Location "${row.location}" not found`);
          results.skipped++;
          continue;
        }
        const locationId = locRes.rows[0].id;

        // Look up customer (optional)
        let customerId = null;
        if (row.customer) {
          const custRes = await client.query('SELECT id FROM customers WHERE display_name = $1', [row.customer]);
          if (custRes.rows.length === 0) {
            results.errors.push(`Row ${row.rowNum}: Customer "${row.customer}" not found (row imported without customer)`);
          } else {
            customerId = custRes.rows[0].id;
          }
        }

        // Update equipment: set status, holder, location
        await client.query(`
          UPDATE equipment 
          SET status = 'Checked Out',
              current_holder_id = $1,
              current_location_id = $2,
              last_action = 'OUT',
              last_action_timestamp = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [personnelId, locationId, row.checkoutDate, equipmentPk]);

        // Create movement record
        await client.query(`
          INSERT INTO equipment_movements (equipment_id, action, quantity, location_id, personnel_id, customer_id, notes, expected_return_date, created_at, created_by)
          VALUES ($1, 'OUT', 1, $2, $3, $4, $5, $6, $7, 'Excel Import')
        `, [equipmentPk, locationId, personnelId, customerId, row.notes || null, row.expectedReturnDate, row.checkoutDate]);

        results.success++;
      } catch (rowErr) {
        results.errors.push(`Row ${row.rowNum}: ${rowErr.message}`);
        results.skipped++;
      }
    }

    await client.query('COMMIT');

    res.json({
      message: `Import complete: ${results.success} assignments imported, ${results.skipped} skipped`,
      totalRows: rows.length,
      ...results,
      parseErrors: errors
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing assignments:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
