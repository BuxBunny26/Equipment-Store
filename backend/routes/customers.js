const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// Get all customers
router.get('/', async (req, res) => {
    try {
        const { country, search, active_only } = req.query;
        
        let query = `
            SELECT id, customer_number, display_name, currency_code,
                   billing_city, shipping_city, country,
                   city, province_state, region,
                   vat_number, vat_treatment, email, 
                   is_active, created_at
            FROM customers
            WHERE 1=1
        `;
        const params = [];
        
        // Filter by active status (default: only active)
        if (active_only !== 'false') {
            query += ` AND is_active = TRUE`;
        }
        
        // Filter by country
        if (country) {
            params.push(country);
            query += ` AND country = $${params.length}`;
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
            customer_number, display_name, currency_code,
            billing_city, billing_state, billing_country,
            shipping_city, shipping_state, shipping_country,
            tax_registration_number, vat_treatment, email
        } = req.body;
        
        const result = await pool.query(
            `INSERT INTO customers 
                (customer_number, display_name, currency_code, 
                 billing_city, billing_state, billing_country,
                 shipping_city, shipping_state, shipping_country,
                 tax_registration_number, vat_treatment, email)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [customer_number, display_name, currency_code || 'ZAR',
             billing_city, billing_state, billing_country,
             shipping_city, shipping_state, shipping_country,
             tax_registration_number, vat_treatment, email]
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
            customer_number, display_name, currency_code,
            billing_city, billing_state, billing_country,
            shipping_city, shipping_state, shipping_country,
            tax_registration_number, vat_treatment, email, is_active
        } = req.body;
        
        const result = await pool.query(
            `UPDATE customers SET
                customer_number = COALESCE($1, customer_number),
                display_name = COALESCE($2, display_name),
                currency_code = COALESCE($3, currency_code),
                billing_city = COALESCE($4, billing_city),
                billing_state = COALESCE($5, billing_state),
                billing_country = COALESCE($6, billing_country),
                shipping_city = COALESCE($7, shipping_city),
                shipping_state = COALESCE($8, shipping_state),
                shipping_country = COALESCE($9, shipping_country),
                tax_registration_number = COALESCE($10, tax_registration_number),
                vat_treatment = COALESCE($11, vat_treatment),
                email = COALESCE($12, email),
                is_active = COALESCE($13, is_active),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $14
             RETURNING *`,
            [customer_number, display_name, currency_code,
             billing_city, billing_state, billing_country,
             shipping_city, shipping_state, shipping_country,
             tax_registration_number, vat_treatment, email, is_active, id]
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
                COUNT(*) FILTER (WHERE billing_country = 'South Africa' AND is_active = TRUE) as local_customers,
                COUNT(*) FILTER (WHERE billing_country != 'South Africa' AND is_active = TRUE) as overseas_customers,
                COUNT(DISTINCT billing_country) as countries
            FROM customers
        `);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching customer stats:', error);
        res.status(500).json({ error: 'Failed to fetch customer statistics' });
    }
});

// Import customers from TSV data (one-time migration)
router.post('/import-data', async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        
        // Read TSV file
        const tsvPath = path.join(__dirname, '../database/customers.tsv');
        const tsvContent = fs.readFileSync(tsvPath, 'utf8');
        const lines = tsvContent.split('\n').filter(line => line.trim());
        
        // Skip header
        const dataLines = lines.slice(1);
        
        let imported = 0;
        let skipped = 0;
        const errors = [];
        
        for (const line of dataLines) {
            try {
                const fields = line.split('\t');
                if (fields.length < 11) continue;
                
                const [
                    display_name, customer_number, currency_code,
                    billing_city, billing_state, billing_country,
                    shipping_city, shipping_state, shipping_country,
                    tax_registration_number, vat_treatment, email
                ] = fields.map(f => {
                    const val = f?.trim();
                    return val && val !== '' ? val : null;
                });
                
                if (!display_name || !customer_number) {
                    skipped++;
                    continue;
                }
                
                // Check if exists
                const existing = await pool.query(
                    'SELECT id FROM customers WHERE customer_number = $1',
                    [customer_number]
                );
                
                if (existing.rows.length > 0) {
                    skipped++;
                    continue;
                }
                
                // Compute region - use billing_state, then billing_country, then 'Other'
                const region = billing_state || billing_country || 'Other';
                const country = billing_country || 'Unknown';
                
                // Insert
                await pool.query(`
                    INSERT INTO customers (
                        customer_number, display_name, currency_code,
                        billing_city, shipping_city, country,
                        city, province_state, region,
                        vat_number, vat_treatment, email,
                        is_active
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)
                `, [
                    customer_number, display_name, currency_code,
                    billing_city, shipping_city, country,
                    billing_city, billing_state, region,
                    tax_registration_number, vat_treatment, email
                ]);
                
                imported++;
            } catch (err) {
                errors.push(err.message);
                skipped++;
            }
        }
        
        res.json({
            success: true,
            imported,
            skipped,
            total: dataLines.length,
            errors: errors.slice(0, 10)
        });
    } catch (error) {
        console.error('Error importing customers:', error);
        res.status(500).json({ error: 'Failed to import customers', details: error.message });
    }
});

module.exports = router;
