const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

async function addTypeColumn() {
  try {
    await pool.query("ALTER TABLE locations ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'internal'");
    console.log('Added type column to locations table');
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

addTypeColumn();
