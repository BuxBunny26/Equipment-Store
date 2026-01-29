// Equipment Import from ARC Calibration Register CSV
// Usage: node import_equipment.js

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

async function importEquipment() {
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
    
    // Get existing categories and subcategories
    const categoriesResult = await pool.query('SELECT id, name FROM categories');
    const categories = {};
    categoriesResult.rows.forEach(row => {
        categories[row.name.toLowerCase()] = row.id;
    });
    
    const subcatsResult = await pool.query('SELECT id, name, category_id FROM subcategories');
    const subcategories = {};
    subcatsResult.rows.forEach(row => {
        const key = `${row.category_id}-${row.name.toLowerCase()}`;
        subcategories[key] = row.id;
    });
    
    // Map CSV categories to existing categories
    const categoryMapping = {
        'laser alignment': 'Calibration & Alignment Tools',
        'thermal camera': 'Data Loggers & Instruments',
        'thermal equipment': 'Data Loggers & Instruments',
        'motor circuit analysis': 'Data Loggers & Instruments',
        'vibration analysis': 'Data Loggers & Instruments',
        'electrical / electronic test instrumentation': 'Data Loggers & Instruments'
    };
    
    // Map to subcategories
    const subcategoryMapping = {
        'laser alignment': 'Laser Alignment',
        'thermal camera': 'Thermal Cameras',
        'thermal equipment': 'Thermal Cameras',
        'motor circuit analysis': 'Multimeters',
        'vibration analysis': 'Vibration Analyzers',
        'electrical / electronic test instrumentation': 'Signal Generators'
    };
    
    // Create missing subcategories if needed
    for (const csvCat of Object.keys(categoryMapping)) {
        const mainCatName = categoryMapping[csvCat];
        const subCatName = subcategoryMapping[csvCat];
        const catId = categories[mainCatName.toLowerCase()];
        
        if (catId) {
            const key = `${catId}-${subCatName.toLowerCase()}`;
            if (!subcategories[key]) {
                // Create the subcategory
                const result = await pool.query(
                    'INSERT INTO subcategories (category_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
                    [catId, subCatName]
                );
                if (result.rows.length > 0) {
                    subcategories[key] = result.rows[0].id;
                    console.log(`Created subcategory: ${subCatName}`);
                } else {
                    // Get existing
                    const existing = await pool.query(
                        'SELECT id FROM subcategories WHERE category_id = $1 AND name = $2',
                        [catId, subCatName]
                    );
                    if (existing.rows.length > 0) {
                        subcategories[key] = existing.rows[0].id;
                    }
                }
            }
        }
    }
    
    let imported = 0;
    let skipped = 0;
    
    // Header: Equipment Category;Equipment Name and Model;OEM / Manufacturer;Serial Number;Last Calibration Date;Calibration Expiry Date;Certificate;Calibration Status;Notes
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(';');
        if (cols.length < 4) {
            console.log(`Skipping line ${i}: insufficient columns`);
            skipped++;
            continue;
        }
        
        const csvCategory = (cols[0] || '').trim().toLowerCase();
        const equipmentName = (cols[1] || '').trim();
        const manufacturer = (cols[2] || '').trim();
        const serialNumber = (cols[3] || '').trim();
        const lastCalibration = (cols[4] || '').trim();
        const calibrationExpiry = (cols[5] || '').trim();
        const certificate = (cols[6] || '').trim();
        const calibrationStatus = (cols[7] || '').trim();
        const notes = (cols[8] || '').trim();
        
        if (!equipmentName || !serialNumber) {
            console.log(`Skipping line ${i}: no name or serial`);
            skipped++;
            continue;
        }
        
        // Find category and subcategory
        const mainCatName = categoryMapping[csvCategory] || 'Data Loggers & Instruments';
        const subCatName = subcategoryMapping[csvCategory] || 'Vibration Analyzers';
        
        const categoryId = categories[mainCatName.toLowerCase()];
        if (!categoryId) {
            console.log(`Skipping ${equipmentName}: category not found (${mainCatName})`);
            skipped++;
            continue;
        }
        
        const subKey = `${categoryId}-${subCatName.toLowerCase()}`;
        let subcategoryId = subcategories[subKey];
        
        if (!subcategoryId) {
            // Find any subcategory in this category
            const fallback = await pool.query(
                'SELECT id FROM subcategories WHERE category_id = $1 LIMIT 1',
                [categoryId]
            );
            if (fallback.rows.length > 0) {
                subcategoryId = fallback.rows[0].id;
            } else {
                console.log(`Skipping ${equipmentName}: no subcategory found`);
                skipped++;
                continue;
            }
        }
        
        // Generate equipment_id from serial number
        const equipmentId = `EQ-${serialNumber}`;
        
        // Get the first available location (default store/warehouse)
        const locResult = await pool.query('SELECT id FROM locations ORDER BY id LIMIT 1');
        const defaultLocationId = locResult.rows.length > 0 ? locResult.rows[0].id : null;
        
        // Parse dates (format: YYYY/MM/DD)
        let lastCalDate = null;
        let nextCalDate = null;
        
        if (lastCalibration) {
            const parts = lastCalibration.split('/');
            if (parts.length === 3) {
                lastCalDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
        }
        
        if (calibrationExpiry) {
            const parts = calibrationExpiry.split('/');
            if (parts.length === 3) {
                nextCalDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
        }
        
        // Determine if requires calibration based on status
        const requiresCalibration = calibrationStatus ? true : false;
        
        try {
            // Build description with all info
            const fullDescription = `Manufacturer: ${manufacturer}. Certificate: ${certificate}. Status: ${calibrationStatus}. ${notes || ''}`.trim();
            
            // Determine if requires calibration based on having calibration dates
            const requiresCalibration = !!(lastCalDate || nextCalDate);
            
            await pool.query(`
                INSERT INTO equipment (
                    equipment_id, equipment_name, description, category_id, subcategory_id,
                    is_serialised, serial_number, manufacturer,
                    requires_calibration, calibration_frequency_months, last_calibration_date, next_calibration_date, calibration_certificate,
                    status, current_location_id, notes
                ) VALUES (
                    $1, $2, $3, $4, $5,
                    true, $6, $7,
                    $8, 12, $9, $10, $11,
                    'Available', $13, $12
                )
                ON CONFLICT (equipment_id) DO UPDATE SET
                    equipment_name = EXCLUDED.equipment_name,
                    description = EXCLUDED.description,
                    manufacturer = EXCLUDED.manufacturer,
                    requires_calibration = EXCLUDED.requires_calibration,
                    last_calibration_date = EXCLUDED.last_calibration_date,
                    next_calibration_date = EXCLUDED.next_calibration_date,
                    calibration_certificate = EXCLUDED.calibration_certificate,
                    notes = EXCLUDED.notes
            `, [
                equipmentId,
                equipmentName,
                `${manufacturer} - ${csvCategory}`,
                categoryId,
                subcategoryId,
                serialNumber,
                manufacturer,
                requiresCalibration,
                lastCalDate,
                nextCalDate,
                certificate,
                fullDescription,
                defaultLocationId
            ]);
            
            imported++;
            console.log(`${imported}. ${equipmentId} - ${equipmentName} (${serialNumber})`);
        } catch (err) {
            console.error(`Error importing ${equipmentName}:`, err.message);
            skipped++;
        }
    }
    
    console.log('\n=== Import Complete ===');
    console.log(`Imported: ${imported}`);
    console.log(`Skipped: ${skipped}`);
    
    // Show sample data
    const result = await pool.query('SELECT equipment_id, equipment_name, serial_number FROM equipment ORDER BY equipment_id LIMIT 10');
    console.log('\nSample data:');
    result.rows.forEach(row => {
        console.log(`  ${row.equipment_id} - ${row.equipment_name} (S/N: ${row.serial_number})`);
    });
    
    await pool.end();
}

importEquipment().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
