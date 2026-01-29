const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// Get audit log with filters
router.get('/', async (req, res) => {
  try {
    const { table_name, record_id, action, user_id, from_date, to_date, limit = 100, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        al.*,
        u.full_name AS user_full_name,
        u.username
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (table_name) {
      query += ` AND al.table_name = $${paramIndex++}`;
      params.push(table_name);
    }
    
    if (record_id) {
      query += ` AND al.record_id = $${paramIndex++}`;
      params.push(record_id);
    }
    
    if (action) {
      query += ` AND al.action = $${paramIndex++}`;
      params.push(action);
    }
    
    if (user_id) {
      query += ` AND al.user_id = $${paramIndex++}`;
      params.push(user_id);
    }
    
    if (from_date) {
      query += ` AND al.created_at >= $${paramIndex++}`;
      params.push(from_date);
    }
    
    if (to_date) {
      query += ` AND al.created_at <= $${paramIndex++}`;
      params.push(to_date);
    }
    
    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) FROM audit_log al WHERE 1=1`;
    const countParams = [];
    let countIndex = 1;
    
    if (table_name) {
      countQuery += ` AND al.table_name = $${countIndex++}`;
      countParams.push(table_name);
    }
    if (record_id) {
      countQuery += ` AND al.record_id = $${countIndex++}`;
      countParams.push(record_id);
    }
    if (action) {
      countQuery += ` AND al.action = $${countIndex++}`;
      countParams.push(action);
    }
    if (user_id) {
      countQuery += ` AND al.user_id = $${countIndex++}`;
      countParams.push(user_id);
    }
    if (from_date) {
      countQuery += ` AND al.created_at >= $${countIndex++}`;
      countParams.push(from_date);
    }
    if (to_date) {
      countQuery += ` AND al.created_at <= $${countIndex++}`;
      countParams.push(to_date);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    
    res.json({
      items: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get audit history for specific record
router.get('/:tableName/:recordId', async (req, res) => {
  try {
    const { tableName, recordId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        al.*,
        u.full_name AS user_full_name,
        u.username
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.table_name = $1 AND al.record_id = $2
      ORDER BY al.created_at DESC
    `, [tableName, recordId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching record history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get audit summary statistics
router.get('/summary/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Actions by type
    const byAction = await pool.query(`
      SELECT action, COUNT(*) as count
      FROM audit_log
      WHERE created_at >= CURRENT_DATE - ($1 || ' days')::INTERVAL
      GROUP BY action
      ORDER BY count DESC
    `, [days]);
    
    // Actions by table
    const byTable = await pool.query(`
      SELECT table_name, COUNT(*) as count
      FROM audit_log
      WHERE created_at >= CURRENT_DATE - ($1 || ' days')::INTERVAL
      GROUP BY table_name
      ORDER BY count DESC
      LIMIT 10
    `, [days]);
    
    // Top users by activity
    const byUser = await pool.query(`
      SELECT 
        al.user_id,
        COALESCE(u.full_name, al.user_name, 'System') as user_name,
        COUNT(*) as count
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.created_at >= CURRENT_DATE - ($1 || ' days')::INTERVAL
      GROUP BY al.user_id, u.full_name, al.user_name
      ORDER BY count DESC
      LIMIT 10
    `, [days]);
    
    // Daily activity for chart
    const dailyActivity = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM audit_log
      WHERE created_at >= CURRENT_DATE - ($1 || ' days')::INTERVAL
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [days]);
    
    res.json({
      by_action: byAction.rows,
      by_table: byTable.rows,
      by_user: byUser.rows,
      daily_activity: dailyActivity.rows
    });
  } catch (error) {
    console.error('Error fetching audit summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create audit log entry (internal use)
router.post('/', async (req, res) => {
  try {
    const { table_name, record_id, action, user_id, user_name, old_values, new_values, changed_fields, ip_address, user_agent } = req.body;
    
    const result = await pool.query(`
      INSERT INTO audit_log 
        (table_name, record_id, action, user_id, user_name, old_values, new_values, changed_fields, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [table_name, record_id, action, user_id || null, user_name || null, 
        old_values ? JSON.stringify(old_values) : null, 
        new_values ? JSON.stringify(new_values) : null,
        changed_fields || null, ip_address || null, user_agent || null]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating audit entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to log audit (for use in other routes)
async function logAudit(tableName, recordId, action, userId, userName, oldValues, newValues, req) {
  try {
    const changedFields = newValues && oldValues ? 
      Object.keys(newValues).filter(key => JSON.stringify(newValues[key]) !== JSON.stringify(oldValues[key])) : 
      null;
    
    await pool.query(`
      INSERT INTO audit_log 
        (table_name, record_id, action, user_id, user_name, old_values, new_values, changed_fields, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      tableName, recordId, action, userId || null, userName || null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      changedFields,
      req?.ip || null,
      req?.get('User-Agent') || null
    ]);
  } catch (error) {
    console.error('Error logging audit:', error);
  }
}

module.exports = router;
module.exports.logAudit = logAudit;
