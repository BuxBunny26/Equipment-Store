const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function initDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('Initializing database...');
        
        // Read and execute schema
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('Creating schema...');
        await client.query(schema);
        console.log('Schema created successfully.');
        
        // Read and execute seed data
        const seedPath = path.join(__dirname, 'seed.sql');
        const seed = fs.readFileSync(seedPath, 'utf8');
        
        console.log('Inserting seed data...');
        await client.query(seed);
        console.log('Seed data inserted successfully.');
        
        console.log('Database initialization complete!');
        
    } catch (error) {
        console.error('Error initializing database:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    initDatabase()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = initDatabase;
