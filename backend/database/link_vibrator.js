const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

async function link() {
    const filePath = 'C:\\Users\\nadhi\\OneDrive - Wearcheck Reliability Solutions\\WearCheck ARC Documents\\RS\\Calibration Certificates\\ARC Calibration machine SN 11755.pdf';
    
    await pool.query(`
        UPDATE calibration_records 
        SET certificate_file_path = $1,
            certificate_file_name = 'ARC Calibration machine SN 11755.pdf',
            certificate_mime_type = 'application/pdf',
            updated_at = CURRENT_TIMESTAMP
        WHERE equipment_id = (SELECT id FROM equipment WHERE serial_number = '9110D')
    `, [filePath]);
    
    console.log('✓ Portable Vibration Calibrator linked (52/53)');
    await pool.end();
}

link();
