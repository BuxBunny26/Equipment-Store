/**
 * SBM Equipment Register Import Script
 * 
 * Imports equipment from SBM_Equipment_Register.xlsx into the database.
 * Creates vessels and areas as locations, and imports equipment with proper relationships.
 * 
 * Usage: node database/import_sbm_equipment.js
 */

const XLSX = require('xlsx');
const pool = require('./db');
const path = require('path');

// Configuration
const EXCEL_FILE = path.join(__dirname, 'SBM_Equipment_Register.xlsx');

// Default category/subcategory for SBM equipment (can be customized)
const DEFAULT_CATEGORY = 'Vibration Analysis';
const DEFAULT_SUBCATEGORY = 'Other Sensors';

// Dry run mode - set to false to actually insert data
const DRY_RUN = false;

async function importSBMEquipment() {
    console.log('========================================');
    console.log('SBM Equipment Register Import');
    console.log('========================================\n');
    
    const stats = {
        vesselsCreated: 0,
        vesselsExisting: 0,
        areasCreated: 0,
        areasExisting: 0,
        equipmentCreated: 0,
        equipmentSkipped: 0,
        errors: []
    };

    try {
        // 1. Read Excel file
        console.log(`Reading: ${EXCEL_FILE}`);
        const workbook = XLSX.readFile(EXCEL_FILE);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        console.log(`Found ${data.length} equipment records\n`);

        // 2. Get or create default category and subcategory
        const { categoryId, subcategoryId } = await getOrCreateDefaults();
        console.log(`Using Category ID: ${categoryId}, Subcategory ID: ${subcategoryId}\n`);

        // 3. Extract unique vessels and areas
        const vesselAreaMap = new Map(); // vessel -> Set of areas
        data.forEach(row => {
            const vessel = row.Vessel?.trim();
            const area = row.Area?.trim();
            if (vessel) {
                if (!vesselAreaMap.has(vessel)) {
                    vesselAreaMap.set(vessel, new Set());
                }
                if (area) {
                    vesselAreaMap.get(vessel).add(area);
                }
            }
        });

        console.log('Vessels found:');
        vesselAreaMap.forEach((areas, vessel) => {
            console.log(`  - ${vessel} (${areas.size} areas)`);
        });
        console.log('');

        // 4. Create/get vessel locations
        const vesselIdMap = new Map(); // vessel name -> location id
        for (const vessel of vesselAreaMap.keys()) {
            const vesselId = await getOrCreateLocation(vessel, 'Vessel', null, stats);
            vesselIdMap.set(vessel, vesselId);
        }
        console.log('');

        // 5. Create/get area locations (under each vessel)
        const areaIdMap = new Map(); // "vessel|area" -> location id
        for (const [vessel, areas] of vesselAreaMap) {
            for (const area of areas) {
                const areaKey = `${vessel}|${area}`;
                const areaId = await getOrCreateLocation(
                    `${vessel} - ${area}`,
                    'Area',
                    vessel,
                    stats
                );
                areaIdMap.set(areaKey, areaId);
            }
        }
        console.log('');

        // 6. Import equipment
        console.log('Importing equipment...');
        let counter = 0;
        
        for (const row of data) {
            counter++;
            const vessel = row.Vessel?.trim();
            const area = row.Area?.trim();
            const equipmentIdVal = row['Equipment ID']?.trim();
            const sapId = row['SAP ID']?.trim();
            const description = row.Description?.trim();

            if (!equipmentIdVal) {
                stats.errors.push(`Row ${counter}: Missing Equipment ID`);
                stats.equipmentSkipped++;
                continue;
            }

            // Get area location ID
            const areaKey = `${vessel}|${area}`;
            const locationId = areaIdMap.get(areaKey);

            // Check if equipment already exists
            const existing = await pool.query(
                'SELECT id FROM equipment WHERE equipment_id = $1',
                [equipmentIdVal]
            );

            if (existing.rows.length > 0) {
                stats.equipmentSkipped++;
                if (counter % 50 === 0) {
                    process.stdout.write(`  Processed ${counter}/${data.length}...\r`);
                }
                continue;
            }

            // Insert equipment
            if (!DRY_RUN) {
                try {
                    await pool.query(`
                        INSERT INTO equipment (
                            equipment_id,
                            equipment_name,
                            description,
                            category_id,
                            subcategory_id,
                            is_serialised,
                            serial_number,
                            current_location_id,
                            status,
                            notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    `, [
                        equipmentIdVal,                              // equipment_id
                        description || equipmentIdVal,               // equipment_name
                        `SAP ID: ${sapId || 'N/A'}`,                // description
                        categoryId,                                  // category_id
                        subcategoryId,                               // subcategory_id
                        true,                                        // is_serialised
                        equipmentIdVal,                              // serial_number (use Equipment ID to avoid duplicates)
                        locationId,                                  // current_location_id
                        'Available',                                 // status
                        `Imported from SBM Equipment Register. Vessel: ${vessel}, Area: ${area}. SAP ID: ${sapId || 'N/A'}`
                    ]);
                    stats.equipmentCreated++;
                } catch (err) {
                    stats.errors.push(`Row ${counter} (${equipmentIdVal}): ${err.message}`);
                    stats.equipmentSkipped++;
                }
            } else {
                stats.equipmentCreated++;
            }

            if (counter % 50 === 0) {
                process.stdout.write(`  Processed ${counter}/${data.length}...\r`);
            }
        }
        console.log(`  Processed ${counter}/${data.length}        `);

    } catch (err) {
        console.error('\nFatal error:', err.message);
        stats.errors.push(`Fatal: ${err.message}`);
    }

    // Print summary
    console.log('\n========================================');
    console.log('IMPORT SUMMARY');
    console.log('========================================');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes made)' : 'LIVE'}`);
    console.log(`Vessels created: ${stats.vesselsCreated}`);
    console.log(`Vessels existing: ${stats.vesselsExisting}`);
    console.log(`Areas created: ${stats.areasCreated}`);
    console.log(`Areas existing: ${stats.areasExisting}`);
    console.log(`Equipment imported: ${stats.equipmentCreated}`);
    console.log(`Equipment skipped: ${stats.equipmentSkipped}`);
    
    if (stats.errors.length > 0) {
        console.log(`\nErrors (${stats.errors.length}):`);
        stats.errors.slice(0, 20).forEach(e => console.log(`  - ${e}`));
        if (stats.errors.length > 20) {
            console.log(`  ... and ${stats.errors.length - 20} more errors`);
        }
    }
    console.log('========================================\n');

    await pool.end();
}

async function getOrCreateDefaults() {
    // Get or create the default category
    let catResult = await pool.query(
        'SELECT id FROM categories WHERE name = $1',
        [DEFAULT_CATEGORY]
    );
    
    let categoryId;
    if (catResult.rows.length === 0) {
        // Create category
        const insertCat = await pool.query(
            'INSERT INTO categories (name) VALUES ($1) RETURNING id',
            [DEFAULT_CATEGORY]
        );
        categoryId = insertCat.rows[0].id;
        console.log(`Created category: ${DEFAULT_CATEGORY}`);
    } else {
        categoryId = catResult.rows[0].id;
    }

    // Get or create the default subcategory
    let subResult = await pool.query(
        'SELECT id FROM subcategories WHERE category_id = $1 AND name = $2',
        [categoryId, DEFAULT_SUBCATEGORY]
    );

    let subcategoryId;
    if (subResult.rows.length === 0) {
        const insertSub = await pool.query(
            'INSERT INTO subcategories (category_id, name) VALUES ($1, $2) RETURNING id',
            [categoryId, DEFAULT_SUBCATEGORY]
        );
        subcategoryId = insertSub.rows[0].id;
        console.log(`Created subcategory: ${DEFAULT_SUBCATEGORY}`);
    } else {
        subcategoryId = subResult.rows[0].id;
    }

    return { categoryId, subcategoryId };
}

async function getOrCreateLocation(name, type, parentVessel, stats) {
    // Check if location exists
    const existing = await pool.query(
        'SELECT id FROM locations WHERE name = $1',
        [name]
    );

    if (existing.rows.length > 0) {
        if (type === 'Vessel') {
            stats.vesselsExisting++;
        } else {
            stats.areasExisting++;
        }
        return existing.rows[0].id;
    }

    // Create new location
    if (!DRY_RUN) {
        const description = parentVessel 
            ? `Area under ${parentVessel}`
            : `SBM ${type}`;
        
        const result = await pool.query(`
            INSERT INTO locations (name, description, type, is_active)
            VALUES ($1, $2, $3, true)
            RETURNING id
        `, [name, description, type]);

        if (type === 'Vessel') {
            stats.vesselsCreated++;
            console.log(`  Created vessel: ${name}`);
        } else {
            stats.areasCreated++;
            console.log(`  Created area: ${name}`);
        }

        return result.rows[0].id;
    } else {
        if (type === 'Vessel') {
            stats.vesselsCreated++;
        } else {
            stats.areasCreated++;
        }
        return -1; // Placeholder for dry run
    }
}

// Run the import
importSBMEquipment().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
