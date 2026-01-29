const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// Get all notifications for a user
router.get('/', async (req, res) => {
  try {
    const { user_id, is_read, type, limit = 50 } = req.query;
    
    let query = `
      SELECT * FROM notifications
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (user_id) {
      query += ` AND (user_id = $${paramIndex++} OR user_id IS NULL)`;
      params.push(user_id);
    }
    
    if (is_read !== undefined) {
      query += ` AND is_read = $${paramIndex++}`;
      params.push(is_read === 'true');
    }
    
    if (type) {
      query += ` AND type = $${paramIndex++}`;
      params.push(type);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get unread count
router.get('/unread-count', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE is_read = false
        AND (user_id = $1 OR user_id IS NULL)
    `, [user_id || null]);
    
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      UPDATE notifications 
      SET is_read = true
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', async (req, res) => {
  try {
    const { user_id } = req.body;
    
    await pool.query(`
      UPDATE notifications 
      SET is_read = true
      WHERE is_read = false
        AND (user_id = $1 OR user_id IS NULL)
    `, [user_id || null]);
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all read:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete notification
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM notifications WHERE id = $1', [id]);
    
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate system notifications (run periodically)
router.post('/generate', async (req, res) => {
  try {
    const notifications = [];
    
    // 1. Calibration expiry alerts
    const calibrationDue = await pool.query(`
      SELECT 
        e.id, e.equipment_id, e.equipment_name,
        c.expiry_date,
        c.expiry_date - CURRENT_DATE as days_until_expiry
      FROM equipment e
      JOIN (
        SELECT DISTINCT ON (equipment_id) 
          equipment_id, expiry_date
        FROM calibration_records
        WHERE expiry_date IS NOT NULL
        ORDER BY equipment_id, calibration_date DESC
      ) c ON e.id = c.equipment_id
      WHERE c.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
        AND c.expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    `);
    
    for (const item of calibrationDue.rows) {
      const daysLeft = item.days_until_expiry;
      let title, message;
      
      if (daysLeft < 0) {
        title = `Calibration EXPIRED: ${item.equipment_id}`;
        message = `${item.equipment_name} calibration expired ${Math.abs(daysLeft)} days ago.`;
      } else if (daysLeft === 0) {
        title = `Calibration expires TODAY: ${item.equipment_id}`;
        message = `${item.equipment_name} calibration expires today!`;
      } else {
        title = `Calibration due soon: ${item.equipment_id}`;
        message = `${item.equipment_name} calibration expires in ${daysLeft} days.`;
      }
      
      // Check if notification already exists today
      const existing = await pool.query(`
        SELECT id FROM notifications 
        WHERE type = 'calibration_expiry' 
          AND reference_type = 'equipment'
          AND reference_id = $1
          AND DATE(created_at) = CURRENT_DATE
      `, [item.id]);
      
      if (existing.rows.length === 0) {
        await pool.query(`
          INSERT INTO notifications (type, title, message, reference_type, reference_id)
          VALUES ('calibration_expiry', $1, $2, 'equipment', $3)
        `, [title, message, item.id]);
        notifications.push({ type: 'calibration_expiry', equipment_id: item.equipment_id });
      }
    }
    
    // 2. Overdue checkout alerts
    const overdueCheckouts = await pool.query(`
      SELECT 
        e.id, e.equipment_id, e.equipment_name,
        p.full_name,
        e.last_action_timestamp,
        CURRENT_DATE - e.last_action_timestamp::date as days_out
      FROM equipment e
      LEFT JOIN personnel p ON e.current_holder_id = p.id
      WHERE e.status = 'Checked Out'
        AND e.last_action_timestamp < CURRENT_DATE - INTERVAL '14 days'
    `);
    
    for (const item of overdueCheckouts.rows) {
      const existing = await pool.query(`
        SELECT id FROM notifications 
        WHERE type = 'overdue_checkout' 
          AND reference_type = 'equipment'
          AND reference_id = $1
          AND DATE(created_at) = CURRENT_DATE
      `, [item.id]);
      
      if (existing.rows.length === 0) {
        await pool.query(`
          INSERT INTO notifications (type, title, message, reference_type, reference_id)
          VALUES ('overdue_checkout', $1, $2, 'equipment', $3)
        `, [
          `Overdue: ${item.equipment_id}`,
          `${item.equipment_name} has been checked out for ${item.days_out} days by ${item.full_name || 'Unknown'}.`,
          item.id
        ]);
        notifications.push({ type: 'overdue_checkout', equipment_id: item.equipment_id });
      }
    }
    
    // 3. Low stock alerts
    const lowStock = await pool.query(`
      SELECT id, equipment_id, equipment_name, available_quantity, reorder_level, unit
      FROM equipment
      WHERE is_quantity_tracked = true
        AND available_quantity <= reorder_level
        AND reorder_level > 0
    `);
    
    for (const item of lowStock.rows) {
      const existing = await pool.query(`
        SELECT id FROM notifications 
        WHERE type = 'low_stock' 
          AND reference_type = 'equipment'
          AND reference_id = $1
          AND DATE(created_at) = CURRENT_DATE
      `, [item.id]);
      
      if (existing.rows.length === 0) {
        await pool.query(`
          INSERT INTO notifications (type, title, message, reference_type, reference_id)
          VALUES ('low_stock', $1, $2, 'equipment', $3)
        `, [
          `Low Stock: ${item.equipment_id}`,
          `${item.equipment_name} has only ${item.available_quantity} ${item.unit} remaining (reorder level: ${item.reorder_level}).`,
          item.id
        ]);
        notifications.push({ type: 'low_stock', equipment_id: item.equipment_id });
      }
    }
    
    // 4. Maintenance due alerts
    const maintenanceDue = await pool.query(`
      SELECT id, equipment_id, equipment_name, next_maintenance_date,
             next_maintenance_date - CURRENT_DATE as days_until_due
      FROM equipment
      WHERE next_maintenance_date IS NOT NULL
        AND next_maintenance_date <= CURRENT_DATE + INTERVAL '14 days'
    `);
    
    for (const item of maintenanceDue.rows) {
      const existing = await pool.query(`
        SELECT id FROM notifications 
        WHERE type = 'maintenance_due' 
          AND reference_type = 'equipment'
          AND reference_id = $1
          AND DATE(created_at) = CURRENT_DATE
      `, [item.id]);
      
      if (existing.rows.length === 0) {
        const daysLeft = item.days_until_due;
        let title = daysLeft < 0 ? 
          `Maintenance OVERDUE: ${item.equipment_id}` :
          `Maintenance due: ${item.equipment_id}`;
        
        await pool.query(`
          INSERT INTO notifications (type, title, message, reference_type, reference_id)
          VALUES ('maintenance_due', $1, $2, 'equipment', $3)
        `, [
          title,
          `${item.equipment_name} maintenance is ${daysLeft < 0 ? 'overdue by ' + Math.abs(daysLeft) + ' days' : 'due in ' + daysLeft + ' days'}.`,
          item.id
        ]);
        notifications.push({ type: 'maintenance_due', equipment_id: item.equipment_id });
      }
    }
    
    res.json({
      message: 'Notifications generated',
      created: notifications.length,
      notifications
    });
  } catch (error) {
    console.error('Error generating notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get notification settings
router.get('/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    let result = await pool.query(`
      SELECT * FROM notification_settings WHERE user_id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      // Create default settings
      result = await pool.query(`
        INSERT INTO notification_settings (user_id)
        VALUES ($1)
        RETURNING *
      `, [userId]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update notification settings
router.put('/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      email_enabled,
      email_address,
      calibration_expiry_days,
      calibration_alert_enabled,
      overdue_checkout_alert_enabled,
      overdue_checkout_days,
      low_stock_alert_enabled,
      reservation_alert_enabled
    } = req.body;
    
    const result = await pool.query(`
      INSERT INTO notification_settings 
        (user_id, email_enabled, email_address, calibration_expiry_days,
         calibration_alert_enabled, overdue_checkout_alert_enabled,
         overdue_checkout_days, low_stock_alert_enabled, reservation_alert_enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id) DO UPDATE SET
        email_enabled = EXCLUDED.email_enabled,
        email_address = EXCLUDED.email_address,
        calibration_expiry_days = EXCLUDED.calibration_expiry_days,
        calibration_alert_enabled = EXCLUDED.calibration_alert_enabled,
        overdue_checkout_alert_enabled = EXCLUDED.overdue_checkout_alert_enabled,
        overdue_checkout_days = EXCLUDED.overdue_checkout_days,
        low_stock_alert_enabled = EXCLUDED.low_stock_alert_enabled,
        reservation_alert_enabled = EXCLUDED.reservation_alert_enabled,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [userId, email_enabled, email_address, calibration_expiry_days,
        calibration_alert_enabled, overdue_checkout_alert_enabled,
        overdue_checkout_days, low_stock_alert_enabled, reservation_alert_enabled]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
