// Personnel Import from TSV file
// Usage: node import_personnel_tsv.js personnel.tsv

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

async function importPersonnel(filePath) {
    // Read the TSV file
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.trim().split('\n');
    
    console.log('Total lines:', lines.length);
    
    // Add new columns if they don't exist
    await pool.query(`
        ALTER TABLE personnel ADD COLUMN IF NOT EXISTS job_title VARCHAR(150);
        ALTER TABLE personnel ADD COLUMN IF NOT EXISTS supervisor VARCHAR(150);
        ALTER TABLE personnel ADD COLUMN IF NOT EXISTS site VARCHAR(150);
    `);
    console.log('Schema updated with job_title, supervisor, site columns');
    
    // Clear existing personnel
    await pool.query('TRUNCATE TABLE personnel RESTART IDENTITY CASCADE');
    console.log('Cleared existing personnel data');
    
    let imported = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols.length < 2 || !cols[0].trim()) continue;
        
        const firstName = (cols[0] || '').trim();
        const lastName = (cols[1] || '').trim();
        const fullName = `${firstName} ${lastName}`.trim();
        const email = (cols[2] || '').trim();
        const jobTitle = (cols[3] || '').trim() || null;
        const supervisor = (cols[4] || '').trim() || null;
        const site = (cols[5] || '').trim() || null;
        
        // Skip if email is N/A or empty - create a placeholder
        const validEmail = (email && email !== 'N/A') ? email.toLowerCase() : null;
        
        // Generate employee_id from email or name
        let employeeId;
        if (validEmail) {
            employeeId = validEmail.split('@')[0].toUpperCase();
        } else {
            employeeId = (firstName.substring(0, 1) + lastName).toUpperCase().replace(/[^A-Z]/g, '');
        }
        // Ensure unique by adding counter if needed
        employeeId = `EMP-${String(i).padStart(3, '0')}`;
        
        // Determine department based on job title
        let department = 'Operations';
        if (jobTitle) {
            const title = jobTitle.toLowerCase();
            if (title.includes('admin') || title.includes('finance') || title.includes('manager')) {
                department = 'Administration';
            } else if (title.includes('inspector') || title.includes('rca') || title.includes('ndt')) {
                department = 'Inspection';
            } else if (title.includes('sales')) {
                department = 'Sales';
            } else if (title.includes('training')) {
                department = 'Training';
            }
        }
        
        try {
            await pool.query(`
                INSERT INTO personnel (employee_id, full_name, email, department, job_title, supervisor, site, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, true)
            `, [employeeId, fullName, validEmail, department, jobTitle, supervisor, site]);
            
            imported++;
            if (imported % 50 === 0) {
                console.log(`Imported ${imported}...`);
            }
        } catch (err) {
            console.error(`Error importing ${fullName}:`, err.message);
        }
    }
    
    console.log(`\nTotal imported: ${imported}`);
    
    // Show summary by department and site
    const deptSummary = await pool.query(`
        SELECT department, COUNT(*) as count 
        FROM personnel 
        GROUP BY department 
        ORDER BY count DESC
    `);
    console.log('\nBy Department:', deptSummary.rows);
    
    const siteSummary = await pool.query(`
        SELECT COALESCE(site, 'Not Assigned') as site, COUNT(*) as count 
        FROM personnel 
        GROUP BY site 
        ORDER BY count DESC
        LIMIT 10
    `);
    console.log('\nTop Sites:', siteSummary.rows);
    
    await pool.end();
}

// Run import
const filePath = process.argv[2] || 'personnel.tsv';
importPersonnel(filePath).catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
