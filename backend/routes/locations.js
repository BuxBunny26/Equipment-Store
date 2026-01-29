const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// GET all locations
router.get('/', async (req, res, next) => {
    try {
        const { active_only } = req.query;
        
        let query = 'SELECT * FROM locations';
        if (active_only === 'true') {
            query += ' WHERE is_active = TRUE';
        }
        query += ' ORDER BY name';
        
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET single location
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM locations WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: { message: 'Location not found' } });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// POST create location
router.post('/', async (req, res, next) => {
    try {
        const { name, description } = req.body;
        
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: { message: 'Location name is required' } });
        }
        
        const result = await pool.query(
            `INSERT INTO locations (name, description)
             VALUES ($1, $2)
             RETURNING *`,
            [name.trim(), description]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: { message: 'Location already exists' } });
        }
        next(error);
    }
});

// PUT update location
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, is_active } = req.body;
        
        const result = await pool.query(
            `UPDATE locations 
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 is_active = COALESCE($3, is_active),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [name, description, is_active, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: { message: 'Location not found' } });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: { message: 'Location name already exists' } });
        }
        next(error);
    }
});

module.exports = router;
