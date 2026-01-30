const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Check status constraint
  const result = await pool.query(`
    SELECT pg_get_constraintdef(oid) as definition
    FROM pg_constraint 
    WHERE conname = 'equipment_status_check'
  `);
  
  console.log('Status constraint:');
  result.rows.forEach(r => console.log(r.definition));
  
  await pool.end();
}

main().catch(console.error);
