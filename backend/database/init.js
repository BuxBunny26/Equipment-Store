/**
 * Equipment Store Database Initialization
 * 
 * This script will:
 * 1. Create the database schema (tables, indexes, triggers)
 * 2. Import Personnel from personnel_with_codes.tsv
 * 3. Import Customers from customers.tsv
 * 4. Import Calibration Records from ARC Equipment Calibration Register.csv
 * 
 * Usage: node init.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'equipment_store',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

// File paths
const FILES = {
    schema: path.join(__dirname, 'schema.sql'),
    personnel: path.join(__dirname, 'Employees Details.csv'),
    customers: path.join(__dirname, 'customers.tsv'),
    calibration: path.join(__dirname, 'ARC Equipment Calibration Register.csv'),
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;
    
    // Handle YYYY/MM/DD format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateStr;
}

function cleanString(str) {
    if (!str) return null;
    const cleaned = str.trim();
    return cleaned === '' ? null : cleaned;
}

function parseTSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const headers = lines[0].split('\t').map(h => h.trim());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        const row = {};
        headers.forEach((header, idx) => {
            row[header] = cleanString(values[idx]);
        });
        rows.push(row);
    }
    return rows;
}

function parseCSV(content, delimiter = ';') {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    // Remove 'v' prefix from first header if present
    let headerLine = lines[0];
    if (headerLine.startsWith('v')) {
        headerLine = headerLine.substring(1);
    }
    
    const headers = headerLine.split(delimiter).map(h => h.trim());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter);
        const row = {};
        headers.forEach((header, idx) => {
            row[header] = cleanString(values[idx]);
        });
        rows.push(row);
    }
    return rows;
}

// ============================================
// IMPORT FUNCTIONS
// ============================================

async function runSchema() {
    console.log('\n📋 Running schema.sql...');
    const schema = fs.readFileSync(FILES.schema, 'utf8');
    await pool.query(schema);
    console.log('✅ Schema created successfully');
}

async function importPersonnel() {
    console.log('\n👥 Importing Personnel...');
    const content = fs.readFileSync(FILES.personnel, 'utf8');
    const rows = parseCSV(content, ';');
    
    let imported = 0;
    let skipped = 0;
    
    for (const row of rows) {
        const employeeId = row['Employee Code'];
        const firstName = row['First Names'];
        const lastName = row['Surname'];
        const email = row['Company E-Mail'];
        const jobTitle = row['Job Title'];
        const supervisor = row['Direct Supervisor'];
        const site = row['Site'];
        const department = row['Department'];
        const division = row['Division'];
        
        if (!employeeId) {
            skipped++;
            continue;
        }
        
        const fullName = [firstName, lastName].filter(Boolean).join(' ') || employeeId;
        
        try {
            await pool.query(`
                INSERT INTO personnel (employee_id, first_name, last_name, full_name, email, job_title, supervisor, site, department, division)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (employee_id) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    full_name = EXCLUDED.full_name,
                    email = EXCLUDED.email,
                    job_title = EXCLUDED.job_title,
                    supervisor = EXCLUDED.supervisor,
                    site = EXCLUDED.site,
                    department = EXCLUDED.department,
                    division = EXCLUDED.division,
                    updated_at = CURRENT_TIMESTAMP
            `, [employeeId, firstName, lastName, fullName, email, jobTitle, supervisor, site, department, division]);
            imported++;
        } catch (err) {
            console.error(`  ❌ Error importing ${employeeId}:`, err.message);
            skipped++;
        }
    }
    
    console.log(`✅ Personnel: ${imported} imported, ${skipped} skipped`);
    
    // Also create locations from unique sites
    const sites = [...new Set(rows.map(r => r['Site']).filter(Boolean))];
    for (const site of sites) {
        try {
            await pool.query(`
                INSERT INTO locations (name, type) VALUES ($1, 'Site')
                ON CONFLICT (name) DO NOTHING
            `, [site]);
        } catch (err) {
            // Ignore duplicates
        }
    }
    console.log(`✅ Created ${sites.length} site locations`);
}

async function importCustomers() {
    console.log('\n🏢 Importing Customers...');
    const content = fs.readFileSync(FILES.customers, 'utf8');
    const rows = parseTSV(content);
    
    let imported = 0;
    let skipped = 0;
    
    for (const row of rows) {
        const customerNumber = row['Customer Number'];
        const displayName = row['Display Name'];
        
        if (!customerNumber || !displayName) {
            skipped++;
            continue;
        }
        
        try {
            await pool.query(`
                INSERT INTO customers (
                    customer_number, display_name, currency_code,
                    billing_city, billing_state, billing_country,
                    shipping_city, shipping_state, shipping_country,
                    tax_registration_number, vat_treatment, email
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (customer_number) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    currency_code = EXCLUDED.currency_code,
                    billing_city = EXCLUDED.billing_city,
                    billing_state = EXCLUDED.billing_state,
                    billing_country = EXCLUDED.billing_country,
                    shipping_city = EXCLUDED.shipping_city,
                    shipping_state = EXCLUDED.shipping_state,
                    shipping_country = EXCLUDED.shipping_country,
                    tax_registration_number = EXCLUDED.tax_registration_number,
                    vat_treatment = EXCLUDED.vat_treatment,
                    email = EXCLUDED.email,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                customerNumber,
                displayName,
                row['Currency Code'] || 'ZAR',
                row['Billing City'],
                row['Billing State'],
                row['Billing Country'],
                row['Shipping City'],
                row['Shipping State'],
                row['Shipping Country'],
                row['Tax Registration Number'],
                row['VAT Treatment'],
                row['EmailID']
            ]);
            imported++;
        } catch (err) {
            console.error(`  ❌ Error importing ${customerNumber}:`, err.message);
            skipped++;
        }
    }
    
    console.log(`✅ Customers: ${imported} imported, ${skipped} skipped`);
}

async function importCalibration() {
    console.log('\n🔧 Importing Calibration Records & Equipment...');
    const content = fs.readFileSync(FILES.calibration, 'utf8');
    const rows = parseCSV(content, ';');
    
    let equipmentImported = 0;
    let calibrationImported = 0;
    let skipped = 0;
    
    // Get category mappings
    const categoryResult = await pool.query('SELECT id, name FROM categories');
    const categories = {};
    categoryResult.rows.forEach(cat => {
        categories[cat.name.toLowerCase()] = cat.id;
    });
    
    // Get subcategory mappings
    const subcategoryResult = await pool.query('SELECT id, category_id, name FROM subcategories');
    const subcategories = {};
    subcategoryResult.rows.forEach(sub => {
        if (!subcategories[sub.category_id]) subcategories[sub.category_id] = sub.id;
    });
    
    for (const row of rows) {
        const category = row['Equipment Category'];
        const equipmentName = row['Equipment Name and Model'];
        const manufacturer = row['OEM / Manufacturer'];
        const serialNumber = row['Serial Number'];
        const calibrationDate = parseDate(row['Last Calibration Date']);
        const expiryDate = parseDate(row['Calibration Expiry Date']);
        const certificate = row['Certificate'];
        const calibrationStatus = row['Calibration Status'];
        const notes = row['Notes'];
        
        if (!serialNumber || !equipmentName) {
            skipped++;
            continue;
        }
        
        // Find category ID
        let categoryId = categories[category?.toLowerCase()];
        if (!categoryId) {
            // Try partial match
            for (const [name, id] of Object.entries(categories)) {
                if (category?.toLowerCase().includes(name) || name.includes(category?.toLowerCase())) {
                    categoryId = id;
                    break;
                }
            }
        }
        if (!categoryId) categoryId = 1; // Default to first category
        
        const subcategoryId = subcategories[categoryId] || 1;
        
        try {
            // Generate equipment_id from serial number
            const equipmentId = `EQ-${serialNumber}`;
            
            // Insert/update equipment
            const equipmentResult = await pool.query(`
                INSERT INTO equipment (
                    equipment_id, equipment_name, manufacturer, serial_number,
                    category_id, subcategory_id, status
                )
                VALUES ($1, $2, $3, $4, $5, $6, 'Available')
                ON CONFLICT (equipment_id) DO UPDATE SET
                    equipment_name = EXCLUDED.equipment_name,
                    manufacturer = EXCLUDED.manufacturer,
                    serial_number = EXCLUDED.serial_number,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id
            `, [equipmentId, equipmentName, manufacturer, serialNumber, categoryId, subcategoryId]);
            
            const equipmentDbId = equipmentResult.rows[0].id;
            equipmentImported++;
            
            // Insert calibration record
            await pool.query(`
                INSERT INTO calibration_records (
                    equipment_id, serial_number, calibration_date, expiry_date,
                    certificate_number, notes
                )
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [equipmentDbId, serialNumber, calibrationDate, expiryDate, certificate, notes]);
            
            calibrationImported++;
        } catch (err) {
            console.error(`  ❌ Error importing ${serialNumber}:`, err.message);
            skipped++;
        }
    }
    
    console.log(`✅ Equipment: ${equipmentImported} imported`);
    console.log(`✅ Calibration Records: ${calibrationImported} imported, ${skipped} skipped`);
}

// ============================================
// MAIN
// ============================================

async function main() {
    console.log('🚀 Equipment Store Database Initialization');
    console.log('==========================================');
    console.log(`Database: ${process.env.DB_NAME || 'equipment_store'}`);
    console.log(`Host: ${process.env.DB_HOST || 'localhost'}`);
    
    try {
        // Test connection
        await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful');
        
        // Run schema
        await runSchema();
        
        // Import data
        await importPersonnel();
        await importCustomers();
        await importCalibration();
        
        // Summary
        console.log('\n==========================================');
        console.log('📊 IMPORT SUMMARY');
        console.log('==========================================');
        
        const counts = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM personnel) as personnel,
                (SELECT COUNT(*) FROM customers) as customers,
                (SELECT COUNT(*) FROM equipment) as equipment,
                (SELECT COUNT(*) FROM calibration_records) as calibration,
                (SELECT COUNT(*) FROM locations) as locations,
                (SELECT COUNT(*) FROM categories) as categories
        `);
        
        const c = counts.rows[0];
        console.log(`  Personnel:     ${c.personnel}`);
        console.log(`  Customers:     ${c.customers}`);
        console.log(`  Equipment:     ${c.equipment}`);
        console.log(`  Calibration:   ${c.calibration}`);
        console.log(`  Locations:     ${c.locations}`);
        console.log(`  Categories:    ${c.categories}`);
        
        console.log('\n✅ Database initialization complete!');
        
    } catch (err) {
        console.error('\n❌ Error:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
