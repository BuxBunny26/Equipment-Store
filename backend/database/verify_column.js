require('dotenv').config();
const pool = require('./db');

async function verify() {
    try {
        console.log('Connecting to database...');
        
        // List all columns in equipment table
        const allColumns = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'equipment' 
            ORDER BY ordinal_position
        `);
        
        console.log('\nEquipment table columns:');
        allColumns.rows.forEach(row => console.log('  -', row.column_name));
        
        const hasCustomerId = allColumns.rows.some(r => r.column_name === 'current_customer_id');
        
        if (hasCustomerId) {
            console.log('\n✓ SUCCESS: current_customer_id column EXISTS!');
        } else {
            console.log('\n✗ ERROR: current_customer_id column is MISSING!');
            console.log('\nRun this SQL in Supabase SQL Editor:');
            console.log('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS current_customer_id INTEGER REFERENCES customers(id);');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

verify();
