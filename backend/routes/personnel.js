const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// GET all personnel
router.get('/', async (req, res, next) => {
    try {
        const { active_only, search } = req.query;
        
        let query = 'SELECT * FROM personnel';
        const conditions = [];
        const params = [];
        
        if (active_only === 'true') {
            conditions.push('is_active = TRUE');
        }
        
        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(full_name ILIKE $${params.length} OR employee_id ILIKE $${params.length} OR email ILIKE $${params.length})`);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY full_name';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET single personnel
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM personnel WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: { message: 'Personnel not found' } });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// POST create personnel
router.post('/', async (req, res, next) => {
    try {
        const { employee_id, full_name, email, department } = req.body;
        
        if (!employee_id || employee_id.trim() === '') {
            return res.status(400).json({ error: { message: 'Employee ID is required' } });
        }
        
        if (!full_name || full_name.trim() === '') {
            return res.status(400).json({ error: { message: 'Full name is required' } });
        }
        
        const result = await pool.query(
            `INSERT INTO personnel (employee_id, full_name, email, department)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [employee_id.trim(), full_name.trim(), email, department]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: { message: 'Employee ID already exists' } });
        }
        next(error);
    }
});

// PUT update personnel
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { employee_id, full_name, email, department, is_active } = req.body;
        
        const result = await pool.query(
            `UPDATE personnel 
             SET employee_id = COALESCE($1, employee_id),
                 full_name = COALESCE($2, full_name),
                 email = COALESCE($3, email),
                 department = COALESCE($4, department),
                 is_active = COALESCE($5, is_active),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`,
            [employee_id, full_name, email, department, is_active, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: { message: 'Personnel not found' } });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: { message: 'Employee ID already exists' } });
        }
        next(error);
    }
});

module.exports = router;
