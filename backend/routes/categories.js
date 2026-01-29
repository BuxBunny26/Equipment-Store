const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// GET all categories
router.get('/', async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT id, name, is_checkout_allowed, is_consumable, 
                   COALESCE(requires_calibration, FALSE) as requires_calibration,
                   default_calibration_interval_months,
                   created_at, updated_at
            FROM categories
            ORDER BY name
        `);
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET single category with subcategories
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const categoryResult = await pool.query(
            'SELECT * FROM categories WHERE id = $1',
            [id]
        );
        
        if (categoryResult.rows.length === 0) {
            return res.status(404).json({ error: { message: 'Category not found' } });
        }
        
        const subcategoriesResult = await pool.query(
            'SELECT id, name FROM subcategories WHERE category_id = $1 ORDER BY name',
            [id]
        );
        
        res.json({
            ...categoryResult.rows[0],
            subcategories: subcategoriesResult.rows
        });
    } catch (error) {
        next(error);
    }
});

// POST create category
router.post('/', async (req, res, next) => {
    try {
        const { name, is_checkout_allowed = true, is_consumable = false } = req.body;
        
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: { message: 'Category name is required' } });
        }
        
        const result = await pool.query(
            `INSERT INTO categories (name, is_checkout_allowed, is_consumable)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [name.trim(), is_checkout_allowed, is_consumable]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: { message: 'Category already exists' } });
        }
        next(error);
    }
});

// PUT update category
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, is_checkout_allowed, is_consumable } = req.body;
        
        const result = await pool.query(
            `UPDATE categories 
             SET name = COALESCE($1, name),
                 is_checkout_allowed = COALESCE($2, is_checkout_allowed),
                 is_consumable = COALESCE($3, is_consumable),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [name, is_checkout_allowed, is_consumable, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: { message: 'Category not found' } });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: { message: 'Category name already exists' } });
        }
        next(error);
    }
});

module.exports = router;
