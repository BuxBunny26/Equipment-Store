// Import Equipment to Production Database
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function importEquipment() {
    const filePath = path.join(__dirname, 'ARC Equipment Calibration Register.csv');
    
    let data = fs.readFileSync(filePath, 'utf8');
    if (data.charCodeAt(0) === 0xFEFF) data = data.substring(1);
    
    const lines = data.trim().split('\n');
    console.log('Total lines:', lines.length);
    
    // Get existing categories
    const categoriesResult = await pool.query('SELECT id, name FROM categories');
    const categories = {};
    categoriesResult.rows.forEach(row => {
        categories[row.name.toLowerCase()] = row.id;
    });
    console.log('Categories:', Object.keys(categories));
    
    // Get default category
    let defaultCategoryId = categories['data loggers & instruments'] || categories['vibration'] || Object.values(categories)[0];
    if (!defaultCategoryId) {
        // Create a default category
        const result = await pool.query(`INSERT INTO categories (name, is_checkout_allowed) VALUES ('Calibration Equipment', true) RETURNING id`);
        defaultCategoryId = result.rows[0].id;
        console.log('Created default category with id:', defaultCategoryId);
    }
    
    // Get subcategories
    const subcategoriesResult = await pool.query('SELECT id, name FROM subcategories');
    const subcategories = {};
    subcategoriesResult.rows.forEach(row => {
        subcategories[row.name.toLowerCase()] = row.id;
    });
    
    // Default subcategory mappings - based on equipment name patterns
    // 70: Laser Alignment Systems, 81: Vibration Analyzers, 73/19: Thermal Cameras, 78: Motor Testers
    const defaultSubcategoryId = subcategories['data collectors'] || subcategories['vibration analyzers'] || 16;
    
    // Get locations
    const locationsResult = await pool.query('SELECT id, name FROM locations');
    const locations = {};
    locationsResult.rows.forEach(row => {
        locations[row.name.toLowerCase()] = row.id;
    });
    const defaultLocationId = locations['main store'] || locations['longmeadow h/o'] || Object.values(locations)[0];
    
    let imported = 0;
    let skipped = 0;
    
    // Header: Equipment Category;Equipment Name and Model;OEM / Manufacturer;Serial Number;Last Calibration Date;Calibration Expiry Date;Certificate;Calibration Status;Notes
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';');
        if (cols.length < 4) continue;
        
        const category = (cols[0] || '').trim();
        const equipmentName = (cols[1] || '').trim();
        const manufacturer = (cols[2] || '').trim();
        const serialNumber = (cols[3] || '').trim();
        const lastCalibrationDate = (cols[4] || '').trim();
        const calibrationExpiryDate = (cols[5] || '').trim();
        const certificate = (cols[6] || '').trim();
        const calibrationStatus = (cols[7] || '').trim();
        const notes = (cols[8] || '').trim();
        
        if (!equipmentName || !serialNumber) {
            skipped++;
            continue;
        }
        
        // Generate equipment ID using loop counter to ensure uniqueness
        const equipmentId = `EQ-${String(i).padStart(4, '0')}`;
        
        // Map category and subcategory based on equipment name
        let categoryId = defaultCategoryId;
        let subcategoryId = defaultSubcategoryId;
        const catLower = category.toLowerCase();
        const nameLower = equipmentName.toLowerCase();
        
        if (catLower.includes('laser') || nameLower.includes('fixturlaser') || nameLower.includes('sensalign')) {
            categoryId = categories['calibration & alignment tools'] || categories['laser alignment'] || defaultCategoryId;
            subcategoryId = subcategories['laser alignment systems'] || subcategories['alignment systems'] || 70;
        } else if (catLower.includes('thermal') || nameLower.includes('flir')) {
            categoryId = categories['thermal camera'] || categories['thermal equipment'] || defaultCategoryId;
            subcategoryId = subcategories['thermal imaging cameras'] || subcategories['thermal cameras'] || 73;
        } else if (catLower.includes('vibration') || nameLower.includes('ams2140') || nameLower.includes('analyzer')) {
            categoryId = categories['vibration analysis'] || categories['vibration'] || defaultCategoryId;
            subcategoryId = subcategories['vibration analyzers'] || 81;
        } else if (nameLower.includes('calibrator') || nameLower.includes('9110d')) {
            categoryId = categories['calibration & alignment tools'] || defaultCategoryId;
            subcategoryId = subcategories['vibration calibrators'] || subcategories['calibration standards'] || 82;
        } else if (nameLower.includes('multimeter')) {
            categoryId = categories['data loggers & instruments'] || defaultCategoryId;
            subcategoryId = subcategories['multimeters'] || 76;
        } else if (catLower.includes('motor') || nameLower.includes('all test') || nameLower.includes('attp') || nameLower.includes('mca')) {
            categoryId = categories['motor circuit analysis'] || defaultCategoryId;
            subcategoryId = subcategories['motor testers'] || subcategories['circuit analyzers'] || 78;
        } else if (nameLower.includes('generator') || nameLower.includes('agilent') || nameLower.includes('nova')) {
            categoryId = categories['calibration & alignment tools'] || defaultCategoryId;
            subcategoryId = subcategories['signal generators'] || subcategories['calibration standards'] || 69;
        }
        
        // Parse dates
        const parseDate = (dateStr) => {
            if (!dateStr) return null;
            // Format: YYYY/MM/DD
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
            return null;
        };
        
        const lastCalDate = parseDate(lastCalibrationDate);
        const expiryDate = parseDate(calibrationExpiryDate);
        
        try {
            // Insert equipment - using actual column names from equipment table
            const result = await pool.query(`
                INSERT INTO equipment (
                    equipment_id, equipment_name, description, serial_number, manufacturer,
                    category_id, subcategory_id, current_location_id, status, notes,
                    requires_calibration, calibration_interval_months,
                    is_serialised
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING id
            `, [
                equipmentId,
                equipmentName,
                `${category} - ${manufacturer}`.trim(),
                serialNumber,
                manufacturer,
                categoryId,
                subcategoryId,
                defaultLocationId,
                'Available',
                notes || null,
                true,
                12,
                true
            ]);
            
            imported++;
            if (imported % 20 === 0) {
                console.log(`Imported ${imported}...`);
            }
        } catch (err) {
            console.error(`Error on line ${i}:`, err.message);
            console.log(`  Data: ${equipmentId} | ${equipmentName} | ${serialNumber}`);
            skipped++;
        }
    }
    
    console.log(`\n✅ Import complete: ${imported} imported, ${skipped} skipped`);
    
    // Show sample
    const sample = await pool.query('SELECT equipment_id, equipment_name, serial_number FROM equipment ORDER BY id LIMIT 10');
    console.log('\nSample equipment:');
    sample.rows.forEach(r => console.log(`  ${r.equipment_id}: ${r.equipment_name} (${r.serial_number})`));
    
    await pool.end();
}

importEquipment().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
