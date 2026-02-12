const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const ExcelJS = require('exceljs');

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

module.exports = router;
