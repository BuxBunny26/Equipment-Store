const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function clean() {
    const result = await pool.query(`UPDATE locations SET description = NULL WHERE description LIKE 'Personnel site:%'`);
    console.log('Updated', result.rowCount, 'locations');
    await pool.end();
}
clean();
