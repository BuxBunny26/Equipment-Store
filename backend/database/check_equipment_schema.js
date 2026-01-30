const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const result = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'equipment' 
    ORDER BY ordinal_position
  `);
  
  console.log('Equipment table columns:');
  console.log('========================');
  result.rows.forEach(col => {
    console.log(`  ${col.column_name} (${col.data_type})`);
  });
  
  await pool.end();
}

main().catch(console.error);
