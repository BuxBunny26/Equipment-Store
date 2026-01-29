const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

async function link() {
    const filePath = 'C:\\Users\\nadhi\\OneDrive - Wearcheck Reliability Solutions\\WearCheck ARC Documents\\RS\\Calibration Certificates\\Strobe light Serial number - 2822301 Exp. 28.02.2026.pdf';
    
    await pool.query(`
        UPDATE calibration_records 
        SET certificate_file_path = $1,
            certificate_file_name = 'Strobe light Serial number - 2822301 Exp. 28.02.2026.pdf',
            certificate_mime_type = 'application/pdf',
            updated_at = CURRENT_TIMESTAMP
        WHERE equipment_id = (SELECT id FROM equipment WHERE serial_number = 'C0206541485411')
    `, [filePath]);
    
    console.log('✓ NOVA-PRO 300 linked (53/53)');
    
    // Show final status
    const result = await pool.query(`
        SELECT COUNT(*) FILTER (WHERE certificate_file_path IS NOT NULL) as linked,
               COUNT(*) as total
        FROM calibration_records
    `);
    console.log(`\nFinal status: ${result.rows[0].linked}/${result.rows[0].total} certificates linked`);
    
    await pool.end();
}

link();
