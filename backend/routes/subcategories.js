const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// GET all subcategories (optionally filtered by category)
router.get('/', async (req, res, next) => {
    try {
        const { category_id } = req.query;
        
        let query = `
            SELECT s.id, s.name, s.category_id, c.name as category_name
            FROM subcategories s
            JOIN categories c ON s.category_id = c.id
        `;
        const params = [];
        
        if (category_id) {
            query += ' WHERE s.category_id = $1';
            params.push(category_id);
        }
        
        query += ' ORDER BY c.name, s.name';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET single subcategory
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            `SELECT s.*, c.name as category_name
             FROM subcategories s
             JOIN categories c ON s.category_id = c.id
             WHERE s.id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: { message: 'Subcategory not found' } });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// POST create subcategory
router.post('/', async (req, res, next) => {
    try {
        const { name, category_id } = req.body;
        
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: { message: 'Subcategory name is required' } });
        }
        
        if (!category_id) {
            return res.status(400).json({ error: { message: 'Category ID is required' } });
        }
        
        // Verify category exists
        const categoryCheck = await pool.query(
            'SELECT id FROM categories WHERE id = $1',
            [category_id]
        );
        
        if (categoryCheck.rows.length === 0) {
            return res.status(400).json({ error: { message: 'Category not found' } });
        }
        
        const result = await pool.query(
            `INSERT INTO subcategories (name, category_id)
             VALUES ($1, $2)
             RETURNING *`,
            [name.trim(), category_id]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: { message: 'Subcategory already exists in this category' } });
        }
        next(error);
    }
});

// PUT update subcategory
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        
        const result = await pool.query(
            `UPDATE subcategories 
             SET name = COALESCE($1, name),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [name, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: { message: 'Subcategory not found' } });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
