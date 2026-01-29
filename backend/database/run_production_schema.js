// Run features schema on production database
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runSchema() {
    console.log('Running features schema on production...\n');
    
    const schemaPath = path.join(__dirname, 'features_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    try {
        await pool.query(schema);
        console.log('✅ Features schema applied successfully!');
        
        // Check tables
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('\nTables in database:');
        result.rows.forEach(row => console.log('  -', row.table_name));
        
    } catch (error) {
        console.error('Error applying schema:', error.message);
    } finally {
        await pool.end();
    }
}

runSchema();
