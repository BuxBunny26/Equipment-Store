const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

async function removeCalibrationLab() {
  try {
    const result = await pool.query("DELETE FROM locations WHERE name = 'Calibration Lab'");
    console.log('Deleted Calibration Lab:', result.rowCount, 'row(s)');
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

removeCalibrationLab();
