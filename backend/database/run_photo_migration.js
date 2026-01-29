const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');
const fs = require('fs');

async function runMigration() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'add_movement_photos.sql'), 'utf8');
        await pool.query(sql);
        console.log('✓ Photo columns added to equipment_movements table');
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

runMigration();
