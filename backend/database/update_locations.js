const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');
const fs = require('fs');

async function updateLocations() {
  try {
    // Read the employee info file to get sites
    const filePath = path.join(__dirname, 'employee info.txt');
    const content = fs.readFileSync(filePath);
    const text = content.toString('utf16le').replace(/^\uFEFF/, '');
    const lines = text.split('\n').filter(l => l.trim());
    
    // Extract unique sites from column 11
    const sitesFromFile = new Set();
    lines.slice(1).forEach(l => {
      const cols = l.split('\t');
      if (cols[11] && cols[11].trim()) {
        sitesFromFile.add(cols[11].trim());
      }
    });
    
    console.log('Sites found in employee file:', [...sitesFromFile].sort());
    
    // Define internal ARC sites (these match entries from the file)
    const internalSiteNames = ['Longmeadow H/O', 'KwaZulu Natal', 'Springs'];
    
    // First, add ARC Longmeadow as default location if it doesn't exist
    let defaultLocResult = await pool.query("SELECT id FROM locations WHERE name = 'ARC Longmeadow (Head Office)'");
    let defaultLocationId;
    
    if (defaultLocResult.rows.length === 0) {
      const insertResult = await pool.query(
        "INSERT INTO locations (name, type, description) VALUES ('ARC Longmeadow (Head Office)', 'internal', 'Main ARC head office and primary equipment store') RETURNING id"
      );
      defaultLocationId = insertResult.rows[0].id;
      console.log('Created default location: ARC Longmeadow (Head Office), ID:', defaultLocationId);
    } else {
      defaultLocationId = defaultLocResult.rows[0].id;
      console.log('Using existing default location ID:', defaultLocationId);
    }
    
    // Update all equipment to point to the default location temporarily
    await pool.query('UPDATE equipment SET current_location_id = $1 WHERE current_location_id IS NOT NULL', [defaultLocationId]);
    console.log('Equipment locations updated to default');
    
    // Now delete old locations (except the default one)
    console.log('\nClearing old locations...');
    await pool.query('DELETE FROM locations WHERE id != $1', [defaultLocationId]);
    
    // Add other internal ARC sites
    const otherInternalLocations = [
      { name: 'ARC KwaZulu Natal', type: 'internal', description: 'ARC KZN regional office' },
      { name: 'ARC Springs', type: 'internal', description: 'ARC Springs regional office' },
      { name: 'Calibration Lab', type: 'internal', description: 'Equipment calibration facility' },
      { name: 'In Transit', type: 'internal', description: 'Equipment being transported' },
      { name: 'Repair - External', type: 'internal', description: 'Equipment sent for external repair' },
    ];
    
    console.log('\nAdding internal ARC locations...');
    for (const loc of otherInternalLocations) {
      const exists = await pool.query('SELECT id FROM locations WHERE name = $1', [loc.name]);
      if (exists.rows.length === 0) {
        await pool.query(
          'INSERT INTO locations (name, type, description) VALUES ($1, $2, $3)',
          [loc.name, loc.type, loc.description]
        );
        console.log('  Added internal:', loc.name);
      }
    }
    
    // Add client sites from the file (excluding internal ones)
    console.log('\nAdding client sites...');
    const clientSites = [...sitesFromFile]
      .filter(s => !internalSiteNames.includes(s))
      .filter(s => s && s.trim() !== '')
      .sort();
    
    for (const site of clientSites) {
      const exists = await pool.query('SELECT id FROM locations WHERE name = $1', [site]);
      if (exists.rows.length === 0) {
        await pool.query(
          'INSERT INTO locations (name, type, description) VALUES ($1, $2, $3)',
          [site, 'client', `Client site: ${site}`]
        );
        console.log('  Added client site:', site);
      }
    }
    
    // Show final count
    const result = await pool.query('SELECT type, COUNT(*) as count FROM locations GROUP BY type ORDER BY type');
    console.log('\n--- Location Summary ---');
    result.rows.forEach(r => console.log(`${r.type}: ${r.count}`));
    
    const allLocations = await pool.query('SELECT id, name, type FROM locations ORDER BY type, name');
    console.log('\n--- All Locations ---');
    allLocations.rows.forEach(l => console.log(`[${l.type}] ${l.name}`));
    
    await pool.end();
    console.log('\nLocations updated successfully!');
    
  } catch (error) {
    console.error('Error updating locations:', error);
    await pool.end();
    process.exit(1);
  }
}

updateLocations();
