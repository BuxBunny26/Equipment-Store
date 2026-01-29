const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// Get all reservations with filters
router.get('/', async (req, res) => {
  try {
    const { status, equipment_id, personnel_id, customer_id, start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        r.id,
        r.equipment_id,
        e.equipment_id AS equipment_code,
        e.equipment_name,
        e.serial_number,
        r.personnel_id,
        p.full_name AS personnel_name,
        r.customer_id,
        c.display_name AS customer_name,
        r.start_date,
        r.end_date,
        r.purpose,
        r.status,
        r.notes,
        r.created_at,
        r.approved_at,
        cat.name AS category
      FROM reservations r
      JOIN equipment e ON r.equipment_id = e.id
      JOIN personnel p ON r.personnel_id = p.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN categories cat ON e.category_id = cat.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND r.status = $${paramIndex++}`;
      params.push(status);
    }
    
    if (equipment_id) {
      query += ` AND r.equipment_id = $${paramIndex++}`;
      params.push(equipment_id);
    }
    
    if (personnel_id) {
      query += ` AND r.personnel_id = $${paramIndex++}`;
      params.push(personnel_id);
    }
    
    if (customer_id) {
      query += ` AND r.customer_id = $${paramIndex++}`;
      params.push(customer_id);
    }
    
    if (start_date) {
      query += ` AND r.end_date >= $${paramIndex++}`;
      params.push(start_date);
    }
    
    if (end_date) {
      query += ` AND r.start_date <= $${paramIndex++}`;
      params.push(end_date);
    }
    
    query += ' ORDER BY r.start_date DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get calendar view (for a date range)
router.get('/calendar', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    const query = `
      SELECT 
        r.id,
        r.equipment_id,
        e.equipment_id AS equipment_code,
        e.equipment_name,
        r.personnel_id,
        p.full_name AS personnel_name,
        r.start_date,
        r.end_date,
        r.status,
        r.purpose
      FROM reservations r
      JOIN equipment e ON r.equipment_id = e.id
      JOIN personnel p ON r.personnel_id = p.id
      WHERE r.status NOT IN ('cancelled')
        AND r.start_date <= $2
        AND r.end_date >= $1
      ORDER BY r.start_date
    `;
    
    const result = await pool.query(query, [start, end]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching calendar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check equipment availability for date range
router.get('/check-availability', async (req, res) => {
  try {
    const { equipment_id, start_date, end_date, exclude_id } = req.query;
    
    let query = `
      SELECT 
        r.id,
        r.start_date,
        r.end_date,
        r.status,
        p.full_name AS reserved_by
      FROM reservations r
      JOIN personnel p ON r.personnel_id = p.id
      WHERE r.equipment_id = $1
        AND r.status NOT IN ('cancelled', 'completed')
        AND r.start_date <= $3
        AND r.end_date >= $2
    `;
    
    const params = [equipment_id, start_date, end_date];
    
    if (exclude_id) {
      query += ` AND r.id != $4`;
      params.push(exclude_id);
    }
    
    const result = await pool.query(query, params);
    
    res.json({
      available: result.rows.length === 0,
      conflicts: result.rows
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new reservation
router.post('/', async (req, res) => {
  try {
    const { equipment_id, personnel_id, customer_id, start_date, end_date, purpose, notes } = req.body;
    
    // Check for conflicts
    const conflictCheck = await pool.query(`
      SELECT id FROM reservations 
      WHERE equipment_id = $1 
        AND status NOT IN ('cancelled', 'completed')
        AND start_date <= $3 
        AND end_date >= $2
    `, [equipment_id, start_date, end_date]);
    
    if (conflictCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Equipment is already reserved for this period',
        conflicts: conflictCheck.rows
      });
    }
    
    const result = await pool.query(`
      INSERT INTO reservations 
        (equipment_id, personnel_id, customer_id, start_date, end_date, purpose, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING *
    `, [equipment_id, personnel_id, customer_id || null, start_date, end_date, purpose, notes]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update reservation status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approved_by } = req.body;
    
    let query = `
      UPDATE reservations 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
    `;
    const params = [status];
    let paramIndex = 2;
    
    if (status === 'approved' && approved_by) {
      query += `, approved_by = $${paramIndex++}, approved_at = CURRENT_TIMESTAMP`;
      params.push(approved_by);
    }
    
    query += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update reservation
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { equipment_id, personnel_id, customer_id, start_date, end_date, purpose, notes } = req.body;
    
    // Check for conflicts (excluding this reservation)
    const conflictCheck = await pool.query(`
      SELECT id FROM reservations 
      WHERE equipment_id = $1 
        AND id != $5
        AND status NOT IN ('cancelled', 'completed')
        AND start_date <= $3 
        AND end_date >= $2
    `, [equipment_id, start_date, end_date, id]);
    
    if (conflictCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Equipment is already reserved for this period',
        conflicts: conflictCheck.rows
      });
    }
    
    const result = await pool.query(`
      UPDATE reservations 
      SET equipment_id = $1, personnel_id = $2, customer_id = $3, 
          start_date = $4, end_date = $5, purpose = $6, notes = $7,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [equipment_id, personnel_id, customer_id || null, start_date, end_date, purpose, notes, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete reservation
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM reservations WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    res.json({ message: 'Reservation deleted', reservation: result.rows[0] });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get upcoming reservations summary
router.get('/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM reservations
      WHERE start_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY status
    `);
    
    const upcoming = await pool.query(`
      SELECT COUNT(*) as count
      FROM reservations
      WHERE status IN ('pending', 'approved')
        AND start_date <= CURRENT_DATE + INTERVAL '7 days'
        AND start_date >= CURRENT_DATE
    `);
    
    res.json({
      by_status: result.rows,
      upcoming_week: parseInt(upcoming.rows[0]?.count || 0)
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
