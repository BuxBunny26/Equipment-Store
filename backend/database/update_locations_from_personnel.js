// Update locations from personnel sites
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function updateLocations() {
    // Get unique sites from personnel
    const sites = await pool.query(`
        SELECT DISTINCT site FROM personnel 
        WHERE site IS NOT NULL AND site != ''
        ORDER BY site
    `);
    
    console.log('Sites found in personnel data:');
    sites.rows.forEach(r => console.log(`  - ${r.site}`));
    
    // Clear existing locations except base ones
    await pool.query(`DELETE FROM locations WHERE name NOT IN ('Main Store', 'In Transit', 'Calibration Lab')`);
    console.log('\nCleared old locations');
    
    // Insert sites as locations
    let added = 0;
    for (const row of sites.rows) {
        const site = row.site.trim();
        if (!site) continue;
        
        try {
            await pool.query(`
                INSERT INTO locations (name, description, is_active)
                VALUES ($1, $2, true)
                ON CONFLICT (name) DO NOTHING
            `, [site, `Personnel site: ${site}`]);
            added++;
        } catch (err) {
            console.log(`  Skipped: ${site} - ${err.message}`);
        }
    }
    
    console.log(`Added ${added} locations from personnel sites`);
    
    // Show all locations
    const all = await pool.query('SELECT name, description FROM locations ORDER BY name');
    console.log('\nAll locations:');
    all.rows.forEach(r => console.log(`  ${r.name}`));
    
    await pool.end();
}

updateLocations();
