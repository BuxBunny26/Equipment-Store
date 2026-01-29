// Quick Customer Import from TSV file
// Usage: node import_customers_tsv.js customers.tsv

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

async function importCustomers(filePath) {
    // Read the TSV file
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.trim().split('\n');
    
    console.log('Total lines:', lines.length);
    
    // Prepare schema
    await pool.query(`
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_state VARCHAR(100);
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_country VARCHAR(100);
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS shipping_state VARCHAR(100);
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(100);
    `);
    
    // Clear existing
    await pool.query('TRUNCATE TABLE customers RESTART IDENTITY CASCADE');
    
    let imported = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols.length < 2 || !cols[0].trim()) continue;
        
        const displayName = (cols[0] || '').trim().replace(/'/g, "''");
        const customerNumber = (cols[1] || '').trim();
        const currencyCode = (cols[2] || 'ZAR').trim();
        const billingCity = (cols[3] || '').trim() || null;
        const billingState = (cols[4] || '').trim() || null;
        const billingCountry = (cols[5] || '').trim() || null;
        const shippingCity = (cols[6] || '').trim() || null;
        const shippingState = (cols[7] || '').trim() || null;
        const shippingCountry = (cols[8] || '').trim() || null;
        const vatNumber = (cols[9] || '').trim() || null;
        const vatTreatment = (cols[10] || 'vat_not_registered').trim();
        const email = (cols[11] || '').trim() || null;
        
        const region = (currencyCode !== 'ZAR' || vatTreatment === 'overseas') ? 'Overseas' : 'Local';
        
        if (!customerNumber) continue;
        
        try {
            await pool.query(`
                INSERT INTO customers (customer_number, display_name, currency_code, city, province_state, country, shipping_city, vat_number, vat_treatment, email, region)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (customer_number) DO UPDATE SET display_name = EXCLUDED.display_name
            `, [customerNumber, displayName, currencyCode, billingCity, billingState, billingCountry, shippingCity, vatNumber, vatTreatment, email, region]);
            imported++;
            if (imported % 100 === 0) console.log(`Imported ${imported}...`);
        } catch (err) {
            console.error(`Row ${i}: ${err.message}`);
        }
    }
    
    console.log(`\nTotal imported: ${imported}`);
    
    const result = await pool.query('SELECT region, COUNT(*) as count FROM customers GROUP BY region');
    console.log('Summary:', result.rows);
    
    await pool.end();
}

const filePath = process.argv[2] || './customers.tsv';
importCustomers(filePath).catch(console.error);
