// Re-import personnel from employee information.csv
// Format: Department;Division;Employee Code;Gender;Race;First Names;Surname;Company E-Mail;Job Title;Direct Supervisor;Site

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function importPersonnel() {
    const filePath = path.join(__dirname, 'employee information.csv');
    
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
    
    // Header: Department;Division;Employee Code;Gender;Race;First Names;Surname;Company E-Mail;Job Title;Direct Supervisor;Site
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(';');
        if (cols.length < 7) {
            console.log(`Skipping line ${i}: insufficient columns (${cols.length})`);
            skipped++;
            continue;
        }
        
        const department = (cols[0] || '').trim() || 'Operations';
        const division = (cols[1] || '').trim() || null;
        const employeeCode = (cols[2] || '').trim();
        // cols[3] = Gender, cols[4] = Race - skip these
        const firstName = (cols[5] || '').trim();
        const lastName = (cols[6] || '').trim();
        const email = (cols[7] || '').trim().toLowerCase();
        const jobTitle = (cols[8] || '').trim() || null;
        const supervisor = (cols[9] || '').trim() || null;
        const site = (cols[10] || '').trim() || null;
        
        const fullName = `${firstName} ${lastName}`.trim();
        
        // Skip if no name or employee code
        if (!fullName || !employeeCode) {
            console.log(`Skipping line ${i}: no name or code - "${employeeCode}" "${fullName}"`);
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
    const sample = await pool.query('SELECT employee_id, full_name, email, job_title FROM personnel ORDER BY employee_id LIMIT 15');
    console.log('\nSample data:');
    sample.rows.forEach(r => console.log(`  ${r.employee_id}: ${r.full_name} - ${r.job_title || 'N/A'} (${r.email || 'no email'})`));
    
    const count = await pool.query('SELECT COUNT(*) FROM personnel');
    console.log(`\nTotal personnel in database: ${count.rows[0].count}`);
    
    await pool.end();
}

importPersonnel().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
