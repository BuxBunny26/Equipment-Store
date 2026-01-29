// Personnel Import with Actual Employee Codes
// Usage: node import_employee_codes.js

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

async function importPersonnel() {
    const filePath = path.join(__dirname, 'employee info.txt');
    
    // Read the TSV file - handle UTF-16 LE encoding (common from Excel)
    let rawData = fs.readFileSync(filePath);
    
    // Check for BOM and convert from UTF-16 LE if needed
    let data;
    if (rawData[0] === 0xFF && rawData[1] === 0xFE) {
        // UTF-16 LE BOM detected
        data = rawData.toString('utf16le').substring(1); // Remove BOM
    } else if (rawData[0] === 0xEF && rawData[1] === 0xBB && rawData[2] === 0xBF) {
        // UTF-8 BOM
        data = rawData.toString('utf8').substring(1);
    } else {
        data = rawData.toString('utf8');
    }
    
    // Remove any null characters that may have slipped in
    data = data.replace(/\0/g, '');
    
    const lines = data.trim().split('\n');
    
    console.log('Total lines:', lines.length);
    console.log('Header:', lines[0]);
    
    // Ensure columns exist
    await pool.query(`
        ALTER TABLE personnel ADD COLUMN IF NOT EXISTS job_title VARCHAR(150);
        ALTER TABLE personnel ADD COLUMN IF NOT EXISTS supervisor VARCHAR(150);
        ALTER TABLE personnel ADD COLUMN IF NOT EXISTS site VARCHAR(150);
        ALTER TABLE personnel ADD COLUMN IF NOT EXISTS division VARCHAR(100);
        ALTER TABLE personnel ADD COLUMN IF NOT EXISTS nick_name VARCHAR(100);
    `);
    console.log('Schema updated with additional columns');
    
    // Clear existing personnel
    await pool.query('TRUNCATE TABLE personnel RESTART IDENTITY CASCADE');
    console.log('Cleared existing personnel data');
    
    let imported = 0;
    let skipped = 0;
    
    // Header: Department, Division, Employee Code, Gender, Race, Nick Name, First Names, Surname, Company E-Mail, Job Title, Direct Supervisor, Site
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols.length < 8) {
            console.log(`Skipping line ${i}: insufficient columns`);
            skipped++;
            continue;
        }
        
        const department = (cols[0] || '').trim();
        const division = (cols[1] || '').trim();
        let employeeCode = (cols[2] || '').trim();
        const nickName = (cols[5] || '').trim();
        const firstName = (cols[6] || '').trim();
        const lastName = (cols[7] || '').trim();
        const email = (cols[8] || '').trim();
        const jobTitle = (cols[9] || '').trim() || null;
        const supervisor = (cols[10] || '').trim() || null;
        const site = (cols[11] || '').trim() || null;
        
        const fullName = `${firstName} ${lastName}`.trim();
        
        // Skip if no name
        if (!fullName || fullName === ' ') {
            console.log(`Skipping line ${i}: no name`);
            skipped++;
            continue;
        }
        
        // Handle "Unknown" employee codes - generate a unique one
        if (!employeeCode || employeeCode === 'Unknown' || employeeCode === '') {
            // Generate from email or name
            if (email && email !== 'N/A') {
                employeeCode = 'WC-' + email.split('@')[0].toUpperCase().substring(0, 6);
            } else {
                employeeCode = 'WC-' + (firstName.substring(0, 2) + lastName.substring(0, 4)).toUpperCase();
            }
            // Add line number to ensure uniqueness
            employeeCode = employeeCode + '-' + String(i).padStart(3, '0');
        }
        
        // Clean email
        const validEmail = (email && email !== 'N/A') ? email.toLowerCase().trim() : null;
        
        try {
            await pool.query(`
                INSERT INTO personnel (employee_id, full_name, email, department, job_title, supervisor, site, division, nick_name, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
                ON CONFLICT (employee_id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    email = EXCLUDED.email,
                    department = EXCLUDED.department,
                    job_title = EXCLUDED.job_title,
                    supervisor = EXCLUDED.supervisor,
                    site = EXCLUDED.site,
                    division = EXCLUDED.division,
                    nick_name = EXCLUDED.nick_name
            `, [employeeCode, fullName, validEmail, department, jobTitle, supervisor, site, division, nickName]);
            
            imported++;
            console.log(`${imported}. ${employeeCode} - ${fullName}`);
        } catch (err) {
            console.error(`Error importing ${employeeCode} - ${fullName}:`, err.message);
            skipped++;
        }
    }
    
    console.log('\n=== Import Complete ===');
    console.log(`Imported: ${imported}`);
    console.log(`Skipped: ${skipped}`);
    
    // Show sample data
    const result = await pool.query('SELECT employee_id, full_name, email, site FROM personnel ORDER BY employee_id LIMIT 10');
    console.log('\nSample data:');
    result.rows.forEach(row => {
        console.log(`  ${row.employee_id} - ${row.full_name} (${row.site || 'No site'})`);
    });
    
    await pool.end();
}

importPersonnel().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
