// Import Calibration Records from ARC Calibration Register CSV
// This populates the calibration_records table which is used by the calibration view

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

async function importCalibrationRecords() {
    const filePath = path.join(__dirname, 'ARC Equipment Calibration Register.csv');
    
    // Read the CSV file
    let data = fs.readFileSync(filePath, 'utf8');
    
    // Handle BOM if present
    if (data.charCodeAt(0) === 0xFEFF) {
        data = data.substring(1);
    }
    
    const lines = data.trim().split('\n');
    
    console.log('Total lines:', lines.length);
    console.log('Header:', lines[0]);
    
    // Clear existing calibration records
    await pool.query('TRUNCATE TABLE calibration_records RESTART IDENTITY');
    console.log('Cleared existing calibration records');
    
    let imported = 0;
    let skipped = 0;
    
    // Header: Equipment Category;Equipment Name and Model;OEM / Manufacturer;Serial Number;Last Calibration Date;Calibration Expiry Date;Certificate;Calibration Status;Notes
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(';');
        if (cols.length < 7) {
            console.log(`Skipping line ${i}: insufficient columns`);
            skipped++;
            continue;
        }
        
        const serialNumber = (cols[3] || '').trim();
        const lastCalibration = (cols[4] || '').trim();
        const calibrationExpiry = (cols[5] || '').trim();
        const certificate = (cols[6] || '').trim();
        const manufacturer = (cols[2] || '').trim();
        const notes = (cols[8] || '').trim();
        
        if (!serialNumber || !lastCalibration || !calibrationExpiry) {
            console.log(`Skipping line ${i}: missing required data`);
            skipped++;
            continue;
        }
        
        // Generate equipment_id from serial number (same as import_equipment.js)
        const equipmentId = `EQ-${serialNumber}`;
        
        // Parse dates (format: YYYY/MM/DD)
        let lastCalDate = null;
        let expiryDate = null;
        
        const lastParts = lastCalibration.split('/');
        if (lastParts.length === 3) {
            lastCalDate = `${lastParts[0]}-${lastParts[1].padStart(2, '0')}-${lastParts[2].padStart(2, '0')}`;
        }
        
        const expiryParts = calibrationExpiry.split('/');
        if (expiryParts.length === 3) {
            expiryDate = `${expiryParts[0]}-${expiryParts[1].padStart(2, '0')}-${expiryParts[2].padStart(2, '0')}`;
        }
        
        if (!lastCalDate || !expiryDate) {
            console.log(`Skipping line ${i}: invalid dates`);
            skipped++;
            continue;
        }
        
        // Find the equipment record
        const equipmentResult = await pool.query(
            'SELECT id FROM equipment WHERE equipment_id = $1',
            [equipmentId]
        );
        
        if (equipmentResult.rows.length === 0) {
            console.log(`Skipping ${equipmentId}: equipment not found`);
            skipped++;
            continue;
        }
        
        const dbEquipmentId = equipmentResult.rows[0].id;
        
        try {
            await pool.query(`
                INSERT INTO calibration_records (
                    equipment_id,
                    calibration_date,
                    expiry_date,
                    certificate_number,
                    calibration_provider,
                    notes,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            `, [
                dbEquipmentId,
                lastCalDate,
                expiryDate,
                certificate,
                manufacturer,
                notes || null
            ]);
            
            imported++;
            console.log(`${imported}. ${equipmentId} - Cal: ${lastCalDate}, Exp: ${expiryDate}, Cert: ${certificate}`);
        } catch (err) {
            console.error(`Error importing calibration for ${equipmentId}:`, err.message);
            skipped++;
        }
    }
    
    console.log('\n=== Calibration Import Complete ===');
    console.log(`Imported: ${imported}`);
    console.log(`Skipped: ${skipped}`);
    
    // Show calibration status summary
    const summary = await pool.query(`
        SELECT calibration_status, COUNT(*) as count 
        FROM v_equipment_calibration_status 
        WHERE requires_calibration = TRUE 
        GROUP BY calibration_status 
        ORDER BY 
            CASE calibration_status 
                WHEN 'Expired' THEN 1 
                WHEN 'Due Soon' THEN 2 
                WHEN 'Valid' THEN 3
                ELSE 4
            END
    `);
    
    console.log('\nCalibration Status Summary:');
    summary.rows.forEach(row => {
        console.log(`  ${row.calibration_status}: ${row.count}`);
    });
    
    await pool.end();
}

importCalibrationRecords().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
