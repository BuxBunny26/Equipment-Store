// Organize locations by region (Province for SA, Country for International)
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Mapping of sites to regions
const regionMapping = {
    // Gauteng
    'Longmeadow H/O': 'Gauteng',
    'Springs': 'Gauteng',
    'Neopak - Rosslyn': 'Gauteng',
    'Main Store': 'Gauteng',
    'Calibration Lab': 'Gauteng',
    'In Transit': 'In Transit',
    
    // KwaZulu Natal
    'KwaZulu Natal': 'KwaZulu Natal',
    'KwaZulu Natal - Hillside': 'KwaZulu Natal',
    'KwaZulu Natal - Tronox': 'KwaZulu Natal',
    
    // Limpopo
    'Steelpoort': 'Limpopo',
    'Valterra - Mototolo': 'Limpopo',
    'Valterra - Waterval': 'Limpopo',
    'Eskom - Matimba': 'Limpopo',
    'PMR': 'Limpopo',
    'RBMR and PMR': 'Limpopo',
    
    // Mpumalanga
    'Samancor - Doornbosch': 'Mpumalanga',
    'Samancor - ECM Tweefontein': 'Mpumalanga',
    'Samancor - MFC': 'Mpumalanga',
    'Samancor - Millcell': 'Mpumalanga',
    'Samancor - Mooinooi': 'North West',
    'Samancor - TAS': 'Mpumalanga',
    'Samancor Tweefontein / Samancor Doornbosch': 'Mpumalanga',
    'Seriti - Khutala': 'Mpumalanga',
    
    // Northern Cape
    'Kathu': 'Northern Cape',
    
    // Remote/Roaming
    'Remote Centre': 'Remote',
    'Roamer': 'Remote',
    
    // International
    'Mozambique': 'Mozambique',
    'Namibia': 'Namibia',
};

async function organizeLocations() {
    // Add region column if it doesn't exist
    await pool.query(`
        ALTER TABLE locations ADD COLUMN IF NOT EXISTS region VARCHAR(100);
        ALTER TABLE locations ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'South Africa';
    `);
    console.log('Added region and country columns');
    
    // Update each location with its region
    for (const [name, region] of Object.entries(regionMapping)) {
        // Determine country
        let country = 'South Africa';
        if (['Mozambique', 'Namibia'].includes(region)) {
            country = region;
        }
        
        const result = await pool.query(`
            UPDATE locations 
            SET region = $1, country = $2
            WHERE name = $3
        `, [region, country, name]);
        
        if (result.rowCount > 0) {
            console.log(`  ${name} -> ${region} (${country})`);
        }
    }
    
    // Show summary
    const summary = await pool.query(`
        SELECT country, region, COUNT(*) as count 
        FROM locations 
        WHERE region IS NOT NULL
        GROUP BY country, region 
        ORDER BY country, region
    `);
    
    console.log('\n📍 Location Summary:');
    let currentCountry = '';
    for (const row of summary.rows) {
        if (row.country !== currentCountry) {
            currentCountry = row.country;
            console.log(`\n${currentCountry}:`);
        }
        console.log(`  ${row.region}: ${row.count} locations`);
    }
    
    // Show any unassigned
    const unassigned = await pool.query(`
        SELECT name FROM locations WHERE region IS NULL
    `);
    if (unassigned.rows.length > 0) {
        console.log('\n⚠️ Unassigned locations:');
        unassigned.rows.forEach(r => console.log(`  - ${r.name}`));
    }
    
    await pool.end();
}

organizeLocations();
