const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// Get all maintenance types
router.get('/types', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM maintenance_types 
      WHERE is_active = true 
      ORDER BY name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maintenance types:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all maintenance records with filters
router.get('/', async (req, res) => {
  try {
    const { equipment_id, status, type_id, from_date, to_date, search } = req.query;
    
    let query = `
      SELECT 
        ml.id,
        ml.equipment_id,
        e.equipment_id AS equipment_code,
        e.equipment_name,
        e.serial_number,
        ml.maintenance_type_id,
        mt.name AS maintenance_type,
        ml.maintenance_date,
        ml.completed_date,
        ml.description,
        ml.performed_by,
        ml.external_provider,
        ml.cost,
        ml.cost_currency,
        ml.downtime_days,
        ml.next_maintenance_date,
        ml.status,
        ml.work_order_number,
        ml.notes,
        ml.created_at,
        cat.name AS category
      FROM maintenance_log ml
      JOIN equipment e ON ml.equipment_id = e.id
      JOIN maintenance_types mt ON ml.maintenance_type_id = mt.id
      LEFT JOIN categories cat ON e.category_id = cat.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (equipment_id) {
      query += ` AND ml.equipment_id = $${paramIndex++}`;
      params.push(equipment_id);
    }
    
    if (status) {
      query += ` AND ml.status = $${paramIndex++}`;
      params.push(status);
    }
    
    if (type_id) {
      query += ` AND ml.maintenance_type_id = $${paramIndex++}`;
      params.push(type_id);
    }
    
    if (from_date) {
      query += ` AND ml.maintenance_date >= $${paramIndex++}`;
      params.push(from_date);
    }
    
    if (to_date) {
      query += ` AND ml.maintenance_date <= $${paramIndex++}`;
      params.push(to_date);
    }
    
    if (search) {
      query += ` AND (
        e.equipment_id ILIKE $${paramIndex} OR 
        e.equipment_name ILIKE $${paramIndex} OR
        ml.description ILIKE $${paramIndex} OR
        ml.work_order_number ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ' ORDER BY ml.maintenance_date DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maintenance records:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get maintenance history for specific equipment
router.get('/equipment/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        ml.*,
        mt.name AS maintenance_type
      FROM maintenance_log ml
      JOIN maintenance_types mt ON ml.maintenance_type_id = mt.id
      WHERE ml.equipment_id = $1
      ORDER BY ml.maintenance_date DESC
    `, [equipmentId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching equipment maintenance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get maintenance due soon / overdue
router.get('/due', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        e.id,
        e.equipment_id,
        e.equipment_name,
        e.serial_number,
        e.next_maintenance_date,
        cat.name AS category,
        CASE 
          WHEN e.next_maintenance_date < CURRENT_DATE THEN 'overdue'
          WHEN e.next_maintenance_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL THEN 'due_soon'
          ELSE 'scheduled'
        END AS maintenance_status,
        e.next_maintenance_date - CURRENT_DATE AS days_until_due
      FROM equipment e
      JOIN categories cat ON e.category_id = cat.id
      WHERE e.next_maintenance_date IS NOT NULL
        AND e.next_maintenance_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
      ORDER BY e.next_maintenance_date
    `, [days]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maintenance due:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get maintenance summary
router.get('/summary', async (req, res) => {
  try {
    // By status
    const byStatus = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM maintenance_log
      GROUP BY status
    `);
    
    // Overdue count
    const overdue = await pool.query(`
      SELECT COUNT(*) as count
      FROM equipment
      WHERE next_maintenance_date IS NOT NULL
        AND next_maintenance_date < CURRENT_DATE
    `);
    
    // Due soon count (next 30 days)
    const dueSoon = await pool.query(`
      SELECT COUNT(*) as count
      FROM equipment
      WHERE next_maintenance_date IS NOT NULL
        AND next_maintenance_date >= CURRENT_DATE
        AND next_maintenance_date <= CURRENT_DATE + INTERVAL '30 days'
    `);
    
    // Total cost this month
    const costThisMonth = await pool.query(`
      SELECT COALESCE(SUM(cost), 0) as total
      FROM maintenance_log
      WHERE maintenance_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND cost IS NOT NULL
    `);
    
    // Total cost this year
    const costThisYear = await pool.query(`
      SELECT COALESCE(SUM(cost), 0) as total
      FROM maintenance_log
      WHERE maintenance_date >= DATE_TRUNC('year', CURRENT_DATE)
        AND cost IS NOT NULL
    `);
    
    res.json({
      by_status: byStatus.rows,
      overdue: parseInt(overdue.rows[0]?.count || 0),
      due_soon: parseInt(dueSoon.rows[0]?.count || 0),
      cost_this_month: parseFloat(costThisMonth.rows[0]?.total || 0),
      cost_this_year: parseFloat(costThisYear.rows[0]?.total || 0)
    });
  } catch (error) {
    console.error('Error fetching maintenance summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create maintenance record
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      equipment_id,
      maintenance_type_id,
      maintenance_date,
      completed_date,
      description,
      performed_by,
      external_provider,
      cost,
      cost_currency,
      downtime_days,
      next_maintenance_date,
      status,
      work_order_number,
      notes
    } = req.body;
    
    await client.query('BEGIN');
    
    const result = await client.query(`
      INSERT INTO maintenance_log 
        (equipment_id, maintenance_type_id, maintenance_date, completed_date,
         description, performed_by, external_provider, cost, cost_currency,
         downtime_days, next_maintenance_date, status, work_order_number, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      equipment_id, maintenance_type_id, maintenance_date, completed_date || null,
      description, performed_by || null, external_provider || null,
      cost || null, cost_currency || 'ZAR', downtime_days || 0,
      next_maintenance_date || null, status || 'scheduled',
      work_order_number || null, notes || null
    ]);
    
    // Update equipment's next maintenance date if provided
    if (next_maintenance_date) {
      await client.query(`
        UPDATE equipment 
        SET next_maintenance_date = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [next_maintenance_date, equipment_id]);
    }
    
    await client.query('COMMIT');
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating maintenance record:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Update maintenance record
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      maintenance_type_id,
      maintenance_date,
      completed_date,
      description,
      performed_by,
      external_provider,
      cost,
      cost_currency,
      downtime_days,
      next_maintenance_date,
      status,
      work_order_number,
      notes
    } = req.body;
    
    await client.query('BEGIN');
    
    const result = await client.query(`
      UPDATE maintenance_log 
      SET maintenance_type_id = $1, maintenance_date = $2, completed_date = $3,
          description = $4, performed_by = $5, external_provider = $6,
          cost = $7, cost_currency = $8, downtime_days = $9,
          next_maintenance_date = $10, status = $11, work_order_number = $12,
          notes = $13, updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
      RETURNING *
    `, [
      maintenance_type_id, maintenance_date, completed_date || null,
      description, performed_by || null, external_provider || null,
      cost || null, cost_currency || 'ZAR', downtime_days || 0,
      next_maintenance_date || null, status, work_order_number || null,
      notes || null, id
    ]);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Maintenance record not found' });
    }
    
    // Update equipment's next maintenance date if provided
    if (next_maintenance_date) {
      await client.query(`
        UPDATE equipment 
        SET next_maintenance_date = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [next_maintenance_date, result.rows[0].equipment_id]);
    }
    
    await client.query('COMMIT');
    
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating maintenance record:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Complete maintenance
router.patch('/:id/complete', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { completed_date, next_maintenance_date, notes } = req.body;
    
    await client.query('BEGIN');
    
    const result = await client.query(`
      UPDATE maintenance_log 
      SET status = 'completed', 
          completed_date = COALESCE($1, CURRENT_DATE),
          next_maintenance_date = $2,
          notes = COALESCE(notes || E'\\n' || $3, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [completed_date, next_maintenance_date || null, notes || null, id]);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Maintenance record not found' });
    }
    
    // Update equipment's next maintenance date
    if (next_maintenance_date) {
      await client.query(`
        UPDATE equipment 
        SET next_maintenance_date = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [next_maintenance_date, result.rows[0].equipment_id]);
    }
    
    await client.query('COMMIT');
    
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error completing maintenance:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Delete maintenance record
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM maintenance_log WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }
    
    res.json({ message: 'Maintenance record deleted', record: result.rows[0] });
  } catch (error) {
    console.error('Error deleting maintenance record:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
