// Test script to check calibration records
require('dotenv').config();
const pool = require('./database/db');

async function test() {
    try {
        // Test the exact query from the API
        const equipmentId = '41';
        const result = await pool.query(`
            SELECT 
                cr.id,
                cr.calibration_date,
                cr.expiry_date,
                cr.certificate_number,
                cr.certificate_file_path,
                cr.certificate_file_name,
                cr.certificate_mime_type,
                cr.calibration_provider,
                cr.notes,
                cr.created_at,
                cr.created_by,
                (cr.expiry_date - cr.calibration_date) as validity_days
            FROM calibration_records cr
            JOIN equipment e ON cr.equipment_id = e.id
            WHERE e.id = $1 OR e.equipment_id = $1
            ORDER BY cr.calibration_date DESC
        `, [equipmentId]);
        
        console.log('Calibration history for equipment 41:', result.rows);
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

test();
