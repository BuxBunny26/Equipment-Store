// Re-import personnel from personnel_with_codes.tsv
// Format: Employee Code | First Names | Surname | Company E-Mail | Job Title | Direct Supervisor | Site | Department | Division

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function importPersonnel() {
    const filePath = path.join(__dirname, 'personnel_with_codes.tsv');
    
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.trim().split('\n');
    
    console.log('Total lines:', lines.length);
    console.log('Header:', lines[0]);
    
    // Ensure columns exist
    await pool.query(`
        ALTER TABLE personnel ADD COLUMN IF NOT EXISTS job_title VARCHAR(150);
        ALTER TABLE personnel ADD COLUMN IF NOT EXISTS supervisor VARCHAR(150);
        ALTER TABLE personnel ADD COLUMN IF NOT EXISTS site VARCHAR(150);
        ALTER TABLE personnel ADD COLUMN IF NOT EXISTS division VARCHAR(100);
    `);
    console.log('Schema updated');
    
    // Clear existing personnel
    await pool.query('TRUNCATE TABLE personnel RESTART IDENTITY CASCADE');
    console.log('Cleared existing personnel data');
    
    let imported = 0;
    let skipped = 0;
    
    // Header: Employee Code | First Names | Surname | Company E-Mail | Job Title | Direct Supervisor | Site | Department | Division
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols.length < 3) {
            console.log(`Skipping line ${i}: insufficient columns (${cols.length})`);
            skipped++;
            continue;
        }
        
        const employeeCode = (cols[0] || '').trim();
        const firstName = (cols[1] || '').trim();
        const lastName = (cols[2] || '').trim();
        const email = (cols[3] || '').trim().toLowerCase();
        const jobTitle = (cols[4] || '').trim() || null;
        const supervisor = (cols[5] || '').trim() || null;
        const site = (cols[6] || '').trim() || null;
        const department = (cols[7] || '').trim() || 'Operations';
        const division = (cols[8] || '').trim() || null;
        
        const fullName = `${firstName} ${lastName}`.trim();
        
        // Skip if no name or employee code
        if (!fullName || !employeeCode) {
            console.log(`Skipping line ${i}: no name or code`);
            skipped++;
            continue;
        }
        
        // Validate email
        const validEmail = email && email.includes('@') ? email : null;
        
        try {
            await pool.query(`
                INSERT INTO personnel (employee_id, full_name, email, department, job_title, supervisor, site, division, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
                ON CONFLICT (employee_id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    email = EXCLUDED.email,
                    department = EXCLUDED.department,
                    job_title = EXCLUDED.job_title,
                    supervisor = EXCLUDED.supervisor,
                    site = EXCLUDED.site,
                    division = EXCLUDED.division
            `, [employeeCode, fullName, validEmail, department, jobTitle, supervisor, site, division]);
            
            imported++;
            if (imported % 20 === 0) {
                console.log(`Imported ${imported}...`);
            }
        } catch (err) {
            console.error(`Error on line ${i}:`, err.message);
            console.log(`  Data: ${employeeCode} | ${fullName} | ${validEmail}`);
            skipped++;
        }
    }
    
    console.log(`\n✅ Import complete: ${imported} imported, ${skipped} skipped`);
    
    // Show sample
    const sample = await pool.query('SELECT employee_id, full_name, email FROM personnel ORDER BY employee_id LIMIT 10');
    console.log('\nSample data:');
    sample.rows.forEach(r => console.log(`  ${r.employee_id}: ${r.full_name} (${r.email})`));
    
    await pool.end();
}

importPersonnel().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
