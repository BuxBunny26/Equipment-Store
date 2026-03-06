const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// POST add consumable with verification
router.post('/add', async (req, res) => {
    const { name, category_id, unit, description } = req.body;
    if (!name || !category_id || !unit) {
        return res.status(400).json({ error: 'Name, category, and unit are required.' });
    }
    // Standardize name and unit
    const stdName = name.trim().toLowerCase();
    const stdUnit = unit.trim().toLowerCase();
    try {
        // Check for duplicate
        const dupCheck = await pool.query(
            `SELECT id FROM equipment WHERE LOWER(equipment_name) = $1 AND category_id = $2 AND LOWER(unit) = $3 AND is_consumable = TRUE`,
            [stdName, category_id, stdUnit]
        );
        if (dupCheck.rows.length > 0) {
            return res.status(409).json({ error: 'Duplicate consumable exists. Please check your entry.' });
        }
        // Insert new consumable
        const result = await pool.query(
            `INSERT INTO equipment (equipment_name, category_id, unit, description, is_consumable, status, available_quantity, total_quantity)
             VALUES ($1, $2, $3, $4, TRUE, 'Available', 0, 0) RETURNING id`,
            [stdName, category_id, stdUnit, description || '']
        );
        // Optionally log to audit_log
        await pool.query(
            `INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by, changed_at)
             VALUES ('equipment', $1, 'INSERT', $2, $3, NOW())`,
            [result.rows[0].id, JSON.stringify({ name: stdName, category_id, unit: stdUnit, description }), req.user?.email || 'System']
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
