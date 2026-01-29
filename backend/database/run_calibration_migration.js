const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

async function runMigration() {
    console.log('Starting calibration migration...\n');
    
    try {
        // Read and execute calibration_schema.sql
        console.log('1. Running calibration_schema.sql...');
        const schemaSQL = fs.readFileSync(
            path.join(__dirname, 'calibration_schema.sql'),
            'utf8'
        );
        await pool.query(schemaSQL);
        console.log('   ✓ Calibration schema created successfully\n');

        // Read and execute import_equipment_calibration.sql
        console.log('2. Running import_equipment_calibration.sql...');
        const importSQL = fs.readFileSync(
            path.join(__dirname, 'import_equipment_calibration.sql'),
            'utf8'
        );
        await pool.query(importSQL);
        console.log('   ✓ Equipment and calibration data imported successfully\n');

        // Verify the import
        console.log('3. Verifying import...');
        
        const equipmentCount = await pool.query(
            "SELECT COUNT(*) FROM equipment WHERE manufacturer IS NOT NULL"
        );
        console.log(`   - Equipment imported: ${equipmentCount.rows[0].count}`);

        const calibrationCount = await pool.query(
            "SELECT COUNT(*) FROM calibration_records"
        );
        console.log(`   - Calibration records: ${calibrationCount.rows[0].count}`);

        const statusSummary = await pool.query(`
            SELECT calibration_status, COUNT(*) as count
            FROM v_equipment_calibration_status
            WHERE requires_calibration = TRUE
            GROUP BY calibration_status
            ORDER BY 
                CASE calibration_status 
                    WHEN 'Expired' THEN 1 
                    WHEN 'Due Soon' THEN 2 
                    WHEN 'Valid' THEN 3
                    WHEN 'Not Calibrated' THEN 4
                END
        `);
        
        console.log('\n   Calibration Status Summary:');
        statusSummary.rows.forEach(row => {
            const icon = row.calibration_status === 'Valid' ? '🟢' :
                        row.calibration_status === 'Due Soon' ? '🟡' :
                        row.calibration_status === 'Expired' ? '🔴' : '⚫';
            console.log(`   ${icon} ${row.calibration_status}: ${row.count}`);
        });

        console.log('\n✅ Migration completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        if (error.position) {
            console.error('   Error at position:', error.position);
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
