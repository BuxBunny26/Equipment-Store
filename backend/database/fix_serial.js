const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

async function fixSerialNumbers() {
    console.log('Fixing serial numbers...\n');
    
    try {
        // Fix ATSX1119 -> AT5X1119
        const result = await pool.query(`
            UPDATE equipment 
            SET serial_number = 'AT5X1119' 
            WHERE serial_number = 'ATSX1119' 
            RETURNING equipment_name, serial_number
        `);
        
        if (result.rows.length > 0) {
            console.log('✓ Fixed:', result.rows[0]);
        } else {
            console.log('Already correct or not found');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixSerialNumbers();
