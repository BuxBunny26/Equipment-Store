const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// Get all customers
router.get('/', async (req, res) => {
    try {
        const { region, search, active_only } = req.query;
        
        let query = `
            SELECT id, customer_number, display_name, region, country, 
                   province_state, city, email, is_active, created_at
            FROM customers
            WHERE 1=1
        `;
        const params = [];
        
        // Filter by active status (default: only active)
        if (active_only !== 'false') {
            query += ` AND is_active = TRUE`;
        }
        
        // Filter by region
        if (region) {
            params.push(region);
            query += ` AND region = $${params.length}`;
        }
        
        // Search by name or customer number
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (display_name ILIKE $${params.length} OR customer_number ILIKE $${params.length})`;
        }
        
        query += ` ORDER BY display_name`;
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Get customer by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM customers WHERE id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

// Create a new customer
router.post('/', async (req, res) => {
    try {
        const { 
            customer_number, display_name, region, country, 
            province_state, city, email, vat_number, vat_treatment, currency_code 
        } = req.body;
        
        const result = await pool.query(
            `INSERT INTO customers 
                (customer_number, display_name, region, country, province_state, city, email, vat_number, vat_treatment, currency_code)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [customer_number, display_name, region || 'Local', country, province_state, city, email, vat_number, vat_treatment, currency_code || 'ZAR']
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating customer:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Customer number already exists' });
        }
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

// Update customer
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            customer_number, display_name, region, country, 
            province_state, city, email, vat_number, vat_treatment, currency_code, is_active 
        } = req.body;
        
        const result = await pool.query(
            `UPDATE customers SET
                customer_number = COALESCE($1, customer_number),
                display_name = COALESCE($2, display_name),
                region = COALESCE($3, region),
                country = COALESCE($4, country),
                province_state = COALESCE($5, province_state),
                city = COALESCE($6, city),
                email = COALESCE($7, email),
                vat_number = COALESCE($8, vat_number),
                vat_treatment = COALESCE($9, vat_treatment),
                currency_code = COALESCE($10, currency_code),
                is_active = COALESCE($11, is_active),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $12
             RETURNING *`,
            [customer_number, display_name, region, country, province_state, city, email, vat_number, vat_treatment, currency_code, is_active, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// Get customer statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE is_active = TRUE) as active_customers,
                COUNT(*) FILTER (WHERE region = 'Local' AND is_active = TRUE) as local_customers,
                COUNT(*) FILTER (WHERE region = 'Overseas' AND is_active = TRUE) as overseas_customers,
                COUNT(DISTINCT country) as countries
            FROM customers
        `);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching customer stats:', error);
        res.status(500).json({ error: 'Failed to fetch customer statistics' });
    }
});

module.exports = router;
