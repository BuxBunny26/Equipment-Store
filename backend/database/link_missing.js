const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

async function linkMissingCertificates() {
    console.log('Linking missing certificates...\n');
    
    try {
        // 1. Fix Flir T530 serial number and link certificate
        console.log('1. Flir T530...');
        await pool.query(`UPDATE equipment SET serial_number = '79302627' WHERE serial_number = '79302027'`);
        
        const flirPath = 'C:\\Users\\nadhi\\OneDrive - Wearcheck Reliability Solutions\\WearCheck ARC Documents\\RS\\Calibration Certificates\\Flir Cameras\\79302627 - Flir T530 Exp Oct 2026.pdf';
        await pool.query(`
            UPDATE calibration_records 
            SET certificate_file_path = $1,
                certificate_file_name = '79302627 - Flir T530 Exp Oct 2026.pdf',
                certificate_mime_type = 'application/pdf',
                updated_at = CURRENT_TIMESTAMP
            WHERE equipment_id = (SELECT id FROM equipment WHERE serial_number = '79302627')
        `, [flirPath]);
        console.log('   ✓ Flir T530 linked\n');

        // Verify
        const result = await pool.query(`
            SELECT e.equipment_name, e.serial_number, cr.certificate_file_path
            FROM equipment e
            JOIN calibration_records cr ON e.id = cr.equipment_id
            WHERE e.serial_number IN ('79302627', 'C0206541485411', '9110D')
        `);
        
        console.log('Current status:');
        result.rows.forEach(row => {
            const status = row.certificate_file_path ? '✓ Linked' : '✗ Missing';
            console.log(`   ${status}: ${row.equipment_name} (${row.serial_number})`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

linkMissingCertificates();
