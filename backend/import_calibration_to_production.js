/**
 * Import Calibration Data to Production Render Database
 * 
 * This script imports calibration records from the CSV file
 * to the production database using the existing db.js connection
 */

const pool = require('./database/db');
const fs = require('fs');
const path = require('path');

const calibrationFile = path.join(__dirname, 'database', 'ARC Equipment Calibration Register.csv');

function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateStr;
}

async function importCalibration() {
    console.log('🔄 Importing Calibration Records to Production...');
    
    const content = fs.readFileSync(calibrationFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    
    // Skip header
    const dataLines = lines.slice(1);
    
    let imported = 0;
    let skipped = 0;
    
    for (const line of dataLines) {
        const parts = line.split(';');
        if (parts.length < 7) {
            skipped++;
            continue;
        }
        
        const [category, equipmentName, manufacturer, serialNumber, calibrationDateStr, expiryDateStr, certificate, status, notes] = parts;
        
        if (!serialNumber || !calibrationDateStr || !expiryDateStr) {
            skipped++;
            continue;
        }
        
        const calibrationDate = parseDate(calibrationDateStr.trim());
        const expiryDate = parseDate(expiryDateStr.trim());
        
        if (!calibrationDate || !expiryDate) {
            console.log(`  ⚠️ Skipping ${serialNumber}: invalid dates`);
            skipped++;
            continue;
        }
        
        try {
            // Find equipment by serial number
            const equipmentResult = await pool.query(
                `SELECT id FROM equipment WHERE serial_number = $1`,
                [serialNumber.trim()]
            );
            
            if (equipmentResult.rows.length === 0) {
                console.log(`  ⚠️ Equipment not found for serial: ${serialNumber}`);
                skipped++;
                continue;
            }
            
            const equipmentId = equipmentResult.rows[0].id;
            
            // Check if calibration record already exists
            const existingResult = await pool.query(
                `SELECT id FROM calibration_records WHERE equipment_id = $1 AND calibration_date = $2`,
                [equipmentId, calibrationDate]
            );
            
            if (existingResult.rows.length > 0) {
                console.log(`  ⏭️ Calibration already exists for ${serialNumber} on ${calibrationDate}`);
                skipped++;
                continue;
            }
            
            // Insert calibration record (using production schema)
            await pool.query(`
                INSERT INTO calibration_records (
                    equipment_id, calibration_date, expiry_date,
                    certificate_number, calibration_provider, notes
                )
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                equipmentId, 
                calibrationDate, 
                expiryDate, 
                certificate?.trim() || null,
                manufacturer?.trim() || null,
                notes?.trim() || null
            ]);
            
            imported++;
            console.log(`  ✅ Imported calibration for ${serialNumber}`);
            
        } catch (err) {
            console.error(`  ❌ Error importing ${serialNumber}:`, err.message);
            skipped++;
        }
    }
    
    console.log(`\n📊 Import Summary:`);
    console.log(`   ✅ Imported: ${imported}`);
    console.log(`   ⏭️ Skipped: ${skipped}`);
}

async function main() {
    console.log('🚀 Calibration Data Migration to Production\n');
    
    try {
        // Test connection
        const testResult = await pool.query('SELECT NOW()');
        console.log('✅ Connected to production database');
        console.log(`   Time: ${testResult.rows[0].now}\n`);
        
        // Check current calibration count
        const countBefore = await pool.query('SELECT COUNT(*) as count FROM calibration_records');
        console.log(`📊 Current calibration records: ${countBefore.rows[0].count}\n`);
        
        await importCalibration();
        
        // Check final count
        const countAfter = await pool.query('SELECT COUNT(*) as count FROM calibration_records');
        console.log(`\n📊 Final calibration records: ${countAfter.rows[0].count}`);
        
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
        console.log('\n✅ Done!');
    }
}

main();
