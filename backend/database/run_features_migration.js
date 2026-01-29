// Run features schema migration
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('./db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting features schema migration...\n');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'features_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by statements and execute
    await client.query('BEGIN');
    
    // Execute the entire script
    await client.query(sql);
    
    await client.query('COMMIT');
    
    console.log('✓ Features schema migration completed successfully!\n');
    
    // Show created tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('reservations', 'notifications', 'notification_settings', 
                         'maintenance_types', 'maintenance_log', 'audit_log', 
                         'roles', 'users', 'equipment_images')
      ORDER BY table_name
    `);
    
    console.log('Created/verified tables:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Show roles
    const roles = await client.query('SELECT name, description FROM roles ORDER BY id');
    console.log('\nUser roles:');
    roles.rows.forEach(row => {
      console.log(`  - ${row.name}: ${row.description}`);
    });
    
    // Show maintenance types
    const maintenanceTypes = await client.query('SELECT name FROM maintenance_types ORDER BY id');
    console.log('\nMaintenance types:');
    maintenanceTypes.rows.forEach(row => {
      console.log(`  - ${row.name}`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('\nMigration complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\nMigration failed:', err);
    process.exit(1);
  });
